import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BUCKET } from "@/lib/storage";
import { getProviderKey } from "@/lib/api-keys";
import { probe, sceneCuts } from "@/lib/media/ffmpeg";
import { checkCleanFilm, scanCaptions } from "@/lib/ai/gemini";
import { falUpload, submitVoid, voidStatus } from "@/lib/ai/fal-video";
import type { ImageJob } from "@/lib/ai/fal-image";
import { FalError } from "@/lib/ai/fal";
import { CHUNK_FRAMES, SAMPLE_FPS, planChunks, textBand, textSegments, type Band, type Chunk, type TextSegment } from "./plan";
import { chunkMask, compose, cutChunk, findFlashes, maskFiles, sampleFrames, sourceFrames } from "./media";
import type { Flash } from "./flash";
import { tick, type JobStage } from "./steps";

// Text remover pipeline: every server action moves all of the user's jobs one step on
// (bulk upload = many films at once), state lives in text_jobs.

export const MAX_SECONDS = 60;

export type Piece = Chunk & { prompt: string; state: "pending" | "running" | "done" | "error"; job?: ImageJob; url?: string; attempts?: number; error?: string; inputs?: { video: string; mask: string } };
export type TextJob = {
  id: string; user_id: string; name: string; src_path: string; stage: JobStage;
  info: { width?: number; height?: number; fps?: number; duration?: number; frames?: number; hasAudio?: boolean; warning?: string };
  /** checks: how many times the finished film went back to Gemini to look for leftover text */
  plan: { band?: Band; segments?: TextSegment[]; pieces?: Piece[]; checks?: number; flashes?: Flash[] };
  out_path: string | null; file_id: string | null; error: string | null; created_at: string;
};

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);
const isAccount = (e: unknown) => e instanceof FalError && /środków|odrzucony/.test(e.message);

async function update(supabase: SupabaseClient, id: string, patch: Partial<TextJob>) {
  const { error } = await supabase.from("text_jobs").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

async function withTmp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = path.join(/* turbopackIgnore: true */ os.tmpdir(), `tr-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function download(supabase: SupabaseClient, storagePath: string, file: string) {
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
  if (error || !data) throw new Error(`Nie udało się pobrać filmu (${error?.message ?? "brak"}).`);
  await writeFile(file, Buffer.from(await data.arrayBuffer()));
}

// ---------- 1) find the captions ----------

async function detect(supabase: SupabaseClient, job: TextJob) {
  const gemini = await getProviderKey(supabase, "gemini");
  await withTmp(async (dir) => {
    const src = path.join(dir, "src.mp4");
    await download(supabase, job.src_path, src);
    const p = await probe(src);
    if (!p.hasVideo || !p.width || !p.height) throw new Error("To nie wygląda na film.");
    if (p.duration > MAX_SECONDS + 0.5) throw new Error(`Film ma ${Math.round(p.duration)} s — maksymalnie ${MAX_SECONDS} s.`);
    const fps = p.fps && p.fps > 1 && p.fps <= 120 ? p.fps : 30;
    const frames = Math.max(1, Math.round(p.duration * fps));
    const size = { width: p.width!, height: p.height! };
    // Gemini looks at 2 frames a second; captions that flash for a frame are found frame by frame
    const [cuts, shotsFrames, flashes] = await Promise.all([sceneCuts(src, 0.2), sampleFrames(src, dir), findFlashes(src, size)]);
    const bounds = [0, ...cuts.filter((c) => c > 0.05 && c < p.duration - 0.05), p.duration];
    const shots = bounds.slice(0, -1).map((start, k) => ({ start, end: bounds[k + 1] }));
    const scan = await scanCaptions(gemini, await Promise.all(shotsFrames.map((f) => readFile(f))), SAMPLE_FPS, shots);
    // a sample that caught a flash is not a caption on screen: the flash fix covers it
    // ffmpeg's fps filter gives sample k the last frame before (k + 0.5) / SAMPLE_FPS: any flash
    // in that half second may be what Gemini saw (a real caption shows in the samples around too)
    const onFlash = (i: number) => {
      const from = Math.floor(((i - 1.5) / SAMPLE_FPS) * fps);
      const to = Math.ceil(((i - 0.5) / SAMPLE_FPS) * fps);
      return flashes.some((f) => f.start + f.len - 1 >= from && f.start <= to);
    };
    const segments = textSegments(scan.frames.filter((f) => !onFlash(f.i)).map((f) => ({ i: f.i, boxes: f.boxes as [number, number, number, number][] })), size);
    const band = textBand(segments, p.height!);
    const info = { width: p.width!, height: p.height!, fps, duration: p.duration, frames, hasAudio: p.hasAudio };
    if (!band || !segments.length) {
      // nothing for the model: only flashes to cover (or nothing at all)
      await update(supabase, job.id, { info, plan: { segments: [], pieces: [], flashes }, stage: "compose" });
      return;
    }
    const shotOf = (frame: number) => Math.max(0, shots.findIndex((s) => frame / fps >= s.start - 1e-3 && frame / fps < s.end - 1e-3));
    const pieces: Piece[] = planChunks(frames, fps, cuts, segments).map((c) => {
      const bg = scan.scenes.find((s) => s.shot === shotOf(c.start))?.background;
      return { ...c, prompt: bg?.trim() || "the same scene without any overlaid text or captions, clean natural background, no text", state: "pending" };
    });
    await update(supabase, job.id, { info, plan: { band, segments, pieces, flashes }, stage: "submit" });
  });
}

// ---------- 2) send the caption strips to fal ----------

async function submit(supabase: SupabaseClient, job: TextJob) {
  const fal = await getProviderKey(supabase, "fal");
  const { band, segments = [], pieces = [] } = job.plan;
  const { width = 0, fps = 30 } = job.info;
  if (!band) throw new Error("Brak planu — spróbuj ponownie.");
  const next = [...pieces];
  await withTmp(async (dir) => {
    const src = path.join(dir, "src.mp4");
    const todo = next.map((p, i) => [p, i] as const).filter(([p]) => p.state === "pending");
    if (todo.some(([p]) => !p.inputs)) await download(supabase, job.src_path, src);
    // a few at a time: cutting decodes the film
    for (let k = 0; k < todo.length; k += 3) {
      await Promise.all(todo.slice(k, k + 3).map(async ([p, i]) => {
        let inputs = p.inputs;
        if (!inputs) {
          const v = path.join(dir, `c${i}.mp4`);
          const m = path.join(dir, `m${i}.mp4`);
          await Promise.all([cutChunk(src, v, band, width, p), chunkMask(m, band, width, segments, p, fps)]);
          const [video, mask] = await Promise.all([falUpload(fal, await readFile(v), `c${i}.mp4`, "video/mp4"), falUpload(fal, await readFile(m), `m${i}.mp4`, "video/mp4")]);
          inputs = { video, mask };
        }
        // a retry gets another seed: the same input with the same seed would repaint the same way
        const j = await submitVoid(fal, { videoUrl: inputs.video, maskUrl: inputs.mask, prompt: p.prompt, frames: CHUNK_FRAMES, ...(p.attempts ? { seed: 1000 + p.attempts * 7919 + i } : {}) });
        next[i] = { ...p, inputs, job: j, state: "running", attempts: (p.attempts ?? 0) + 1 };
      }));
    }
  });
  await update(supabase, job.id, { plan: { ...job.plan, pieces: next }, stage: "running" });
}

// ---------- 3) wait for fal ----------

async function poll(supabase: SupabaseClient, job: TextJob) {
  const fal = await getProviderKey(supabase, "fal");
  const pieces = [...(job.plan.pieces ?? [])];
  let retry = false;
  await Promise.all(pieces.map(async (p, i) => {
    if (p.state !== "running" || !p.job) return;
    const s = await voidStatus(fal, p.job);
    if (s.state === "done") pieces[i] = { ...p, state: "done", url: s.url };
    else if (s.state === "failed") {
      // one more try, then the job reports the error
      if ((p.attempts ?? 1) < 2) {
        pieces[i] = { ...p, state: "pending", error: s.error };
        retry = true;
      } else pieces[i] = { ...p, state: "error", error: s.error };
    }
  }));
  const failed = pieces.find((p) => p.state === "error");
  const stage: JobStage = failed ? "error" : retry ? "submit" : pieces.every((p) => p.state === "done") ? "compose" : "running";
  await update(supabase, job.id, { plan: { ...job.plan, pieces }, stage, ...(failed ? { error: `fal.ai: ${failed.error ?? "błąd"}` } : {}) });
}

// ---------- 4) put the film back together ----------

function formatOf(w: number, h: number): string | null {
  const r = w / h;
  if (Math.abs(r - 9 / 16) < 0.03) return "9x16";
  if (Math.abs(r - 4 / 5) < 0.03) return "4x5";
  if (Math.abs(r - 1) < 0.03) return "1x1";
  if (Math.abs(r - 16 / 9) < 0.03) return "16x9";
  return null;
}

/**
 * Kontroler: Gemini compares the finished film with the original, frame by frame. Pieces where
 * text is still visible go back to fal. Objects the model painted in are only reported: retries
 * with another seed did not remove them in tests (3 rounds, same result) and cost minutes each.
 */
async function badPieces(supabase: SupabaseClient, src: string, film: string, dir: string, pieces: Piece[], fps: number, band: Band, height: number): Promise<{ redo: number[]; artifacts: string[] }> {
  const gemini = await getProviderKey(supabase, "gemini");
  const a = path.join(dir, "check-src");
  const b = path.join(dir, "check-out");
  await Promise.all([mkdir(a, { recursive: true }), mkdir(b, { recursive: true })]);
  const [orig, clean] = await Promise.all([sampleFrames(src, a), sampleFrames(film, b)]);
  const n = Math.min(orig.length, clean.length);
  const pairs = await Promise.all(Array.from({ length: n }, async (_, k) => ({ original: await readFile(orig[k]), cleaned: await readFile(clean[k]) })));
  const r = await checkCleanFilm(gemini, pairs, SAMPLE_FPS, { from: band.y / height, to: (band.y + band.h) / height });
  const redo = pieces.map((p, i) => [p, i] as const).filter(([p]) => r.text.some((t) => t >= p.start / fps - 0.25 && t < (p.start + p.len) / fps + 0.25)).map(([, i]) => i);
  const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
  const artifacts = [...new Set(r.artifacts.map((a) => fmt(a.t)))];
  return { redo, artifacts };
}

const MAX_CHECKS = 1;

async function finish(supabase: SupabaseClient, job: TextJob) {
  const { band, segments = [], pieces = [], flashes = [] } = job.plan;
  const { width = 0, height = 0, fps = 30, duration = 0, hasAudio = false } = job.info;
  const outPath = `${job.user_id}/text-remover/${job.id}/bez-napisow.mp4`;
  let warning: string | undefined;
  const ready = await withTmp(async (dir) => {
    const src = path.join(dir, "src.mp4");
    const out = path.join(dir, "out.mp4");
    await download(supabase, job.src_path, src);
    const [sources, masks] = await Promise.all([sourceFrames(src, dir, flashes.map((f) => f.source)), maskFiles(dir, flashes)]);
    const flashFiles = flashes.map((f) => ({ ...f, file: sources.get(f.source)!, maskFile: f.mask ? masks.get(f.mask.bits) : undefined }));
    if (!band || !pieces.length) {
      if (flashes.length) await compose({ src, out, pieces: [], band: null, width, fps, duration, segments: [], hasAudio, flashes: flashFiles });
      else await writeFile(out, await readFile(src));
    } else {
      const files = await Promise.all(pieces.map(async (p, i) => {
        const res = await fetch(p.url!, { signal: AbortSignal.timeout(120_000) });
        if (!res.ok) throw new Error(`pobieranie wyniku z fal.ai (${res.status})`);
        const f = path.join(dir, `o${i}.mp4`);
        await writeFile(f, Buffer.from(await res.arrayBuffer()));
        return { ...p, file: f };
      }));
      await compose({ src, out, pieces: files, band, width, fps, duration, segments, hasAudio, flashes: flashFiles });
      // Kontroler: Gemini looks at the finished film; pieces where text is still visible go back to fal
      const check = await badPieces(supabase, src, out, dir, pieces, fps, band, height);
      if (check.redo.length) {
        if ((job.plan.checks ?? 0) < MAX_CHECKS) {
          const next = pieces.map((p, i) => (check.redo.includes(i) ? { ...p, state: "pending" as const, job: undefined, url: undefined } : p));
          await update(supabase, job.id, { plan: { ...job.plan, pieces: next, checks: (job.plan.checks ?? 0) + 1 }, stage: "submit" });
          return false;
        }
        warning = "W kilku miejscach mógł zostać ślad napisu — sprawdź film.";
      }
      if (check.artifacts.length) {
        warning = `${warning ? `${warning} ` : ""}Model mógł dorysować coś w miejscu napisu (${check.artifacts.slice(0, 6).join(", ")}${check.artifacts.length > 6 ? "…" : ""}) — obejrzyj te momenty.`;
      }
    }
    const { error } = await supabase.storage.from(BUCKET).upload(outPath, await readFile(out), { contentType: "video/mp4", upsert: true });
    if (error) throw new Error(error.message);
    return true;
  });
  if (!ready) return;
  // "Twoje pliki"
  let fileId = job.file_id;
  if (!fileId) {
    const id = randomUUID();
    const { error } = await supabase.from("ad_files").insert({
      id, user_id: job.user_id, tool: "text-remover", kind: "video", path: outPath, format: formatOf(width, height),
      name: `${job.name.replace(/\.[a-z0-9]+$/i, "")} — bez napisów`.slice(0, 80), meta: { link: "/text-remover", source: job.name },
    });
    if (!error) fileId = id;
  }
  await update(supabase, job.id, { out_path: outPath, file_id: fileId, stage: "done", error: null, info: { ...job.info, ...(warning ? { warning } : {}) } });
}

// ---------- tick ----------

export async function loadJobs(supabase: SupabaseClient, ids?: string[]) {
  let q = supabase.from("text_jobs").select("*").order("created_at", { ascending: false }).limit(100);
  if (ids?.length) q = q.in("id", ids);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as TextJob[];
}

export type TickResult = { active: number; worked: number; wait: boolean };

/** Move every unfinished job one step (heavy steps a few at a time). Errors stay with their job. */
export async function advanceJobs(supabase: SupabaseClient): Promise<TickResult> {
  const jobs = await loadJobs(supabase);
  const plan = tick(jobs.map((j) => ({ id: j.id, stage: j.stage })));
  const byId = new Map(jobs.map((j) => [j.id, j]));
  const run = async (id: string, fn: (s: SupabaseClient, j: TextJob) => Promise<void>) => {
    try {
      await fn(supabase, byId.get(id)!);
    } catch (e) {
      if (isAccount(e)) throw e;
      await update(supabase, id, { stage: "error", error: errText(e) }).catch(() => {});
    }
  };
  await Promise.all([
    ...plan.detect.map((id) => run(id, detect)),
    ...plan.submit.map((id) => run(id, submit)),
    ...plan.poll.map((id) => run(id, poll)),
    ...plan.compose.map((id) => run(id, finish)),
  ]);
  return { active: plan.active, worked: plan.detect.length + plan.submit.length + plan.compose.length, wait: plan.onlyWaiting };
}
