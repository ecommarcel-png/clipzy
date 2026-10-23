import "server-only";
import { writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BUCKET, signedUrls } from "@/lib/storage";
import { getBrand, getProduct, getProductImages } from "@/lib/data";
import { getProviderKey } from "@/lib/api-keys";
import { probe, sceneCuts, silences, normalizeVoice, poster } from "@/lib/media/ffmpeg";
import { posterPathFor, saveToLibrary } from "@/lib/clips/library-store";
import { analyzeClip, reviewRender, type ClipAnalysis, type RenderReview } from "@/lib/ai/gemini";
import { transcribe } from "@/lib/ai/scribe";
import { submitShot, shotStatus } from "@/lib/ai/fal";
import { missingShots, planEdit, reviewPlan, scriptFeedback, interpretFeedback, type ClipsContext, type ScriptFeedback } from "@/lib/ai/clips";
import { controlLoop, type ControlReport } from "@/lib/ai/control";
import { tighten, captionChunks, type TightTimeline, type CaptionChunk, type Word } from "@/lib/clips/timeline";
import { cleanIntervals, sanitizePlan, type AssetInfo, type EditPlan } from "@/lib/clips/plan";
import { library } from "@/lib/clips/library";
import type { Mix } from "@/lib/clips/edit";
import { fixBrandName } from "@/lib/clips/names";
import { UserError } from "@/lib/errors";

export type ClipAssetRow = {
  id: string;
  project_id: string;
  kind: "clip" | "voiceover" | "generated" | "render";
  path: string | null;
  name: string;
  status: string;
  meta: Record<string, unknown>;
  analysis: unknown;
  error: string | null;
  created_at: string;
  library_id?: string | null;
};

export type ClipSettings = {
  voiceover: boolean;
  music: string;
  formats: string[];
  notes: string;
  generated?: "pending" | "done";
  /** upload = the user's own file; generate = Clipzy writes the script and voices it */
  voiceover_mode?: "upload" | "generate";
  voice?: string;
  voice_id?: string;
  target_seconds?: number;
};

export type VoiceoverData = {
  asset_id: string;
  text: string;
  words: Word[];
  timeline: TightTimeline;
  captions: CaptionChunk[];
  feedback: ScriptFeedback | null;
};

export type ClipProjectRow = {
  id: string;
  brand_id: string;
  product_id: string | null;
  name: string;
  status: string;
  settings: ClipSettings;
  voiceover: VoiceoverData | null;
  plan: {
    plan: EditPlan;
    notes: string[];
    aliases: Record<string, string>;
    report: ControlReport | null;
    missing_notes?: string;
    mix?: Mix; // manual volumes from the quick-edit panel — kept across new plans
    director?: EditPlan; // the Reżyser's version before manual edits
    edited_at?: string;
  } | null;
  review: unknown;
  feedback: Array<{ at: string; text: string; changes: string }>;
  error: string | null;
};

export async function loadProject(supabase: SupabaseClient, id: string) {
  const { data: project } = await supabase.from("clip_projects").select("*").eq("id", id).maybeSingle();
  if (!project) return null;
  const { data: assets } = await supabase.from("clip_assets").select("*").eq("project_id", id).order("created_at");
  return { project: project as ClipProjectRow, assets: (assets ?? []) as ClipAssetRow[] };
}

async function toTmp(supabase: SupabaseClient, storagePath: string): Promise<{ file: string; data: Buffer; mime: string }> {
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
  if (error || !data) throw new UserError(`Nie udało się pobrać pliku (${error?.message ?? "brak"}).`);
  const buf = Buffer.from(await data.arrayBuffer());
  const file = path.join(/* turbopackIgnore: true */ os.tmpdir(), `${randomUUID()}${path.extname(storagePath) || ".bin"}`);
  await writeFile(file, buf);
  return { file, data: buf, mime: data.type || "application/octet-stream" };
}

function mimeFor(p: string, fallback: string) {
  if (/\.mp4$/i.test(p)) return "video/mp4";
  if (/\.mov$/i.test(p)) return "video/quicktime";
  if (/\.webm$/i.test(p)) return "video/webm";
  if (/\.mp3$/i.test(p)) return "audio/mpeg";
  if (/\.wav$/i.test(p)) return "audio/wav";
  if (/\.m4a$/i.test(p)) return "audio/mp4";
  return fallback;
}

async function productLine(supabase: SupabaseClient, project: ClipProjectRow) {
  if (!project.product_id) return "produkt marki";
  const product = await getProduct(supabase, project.brand_id, project.product_id).catch(() => null);
  return product ? `${product.name} — ${product.profile.one_liner || product.profile.problem || ""}` : "produkt marki";
}

// 1) Probe + hard cuts (ffmpeg) + what's in the clip (Gemini) for an uploaded or generated video.
export async function analyzeAsset(supabase: SupabaseClient, project: ClipProjectRow, asset: ClipAssetRow) {
  if (!asset.path) throw new UserError("Plik nie został jeszcze wgrany.");
  await supabase.from("clip_assets").update({ status: "analyzing", error: null }).eq("id", asset.id);
  const tmp = await toTmp(supabase, asset.path);
  try {
    const info = await probe(tmp.file);
    if (!info.hasVideo) throw new UserError("To nie jest plik wideo.");
    const cuts = await sceneCuts(tmp.file);
    const geminiKey = await getProviderKey(supabase, "gemini");
    const brief = asset.kind === "generated" ? String(asset.meta.prompt ?? "") : null;
    const analysis: ClipAnalysis = await analyzeClip(geminiKey, tmp.data, mimeFor(asset.path, tmp.mime), await productLine(supabase, project), brief);
    const meta: Record<string, unknown> = { ...asset.meta, duration: info.duration, width: info.width, height: info.height, fps: info.fps, has_audio: info.hasAudio, cuts, mirrored: analysis.text_mirrored };
    // thumbnail for the library and the picker — a frame from the longest clean part
    try {
      const jpg = tmp.file + ".jpg";
      const ints = cleanIntervals({ id: asset.id, duration: info.duration, cuts });
      const best = ints.length ? ints.reduce((b, x) => (x[1] - x[0] > b[1] - b[0] ? x : b)) : [0, info.duration];
      await poster(tmp.file, jpg, Math.max(0, (best[0] + best[1]) / 2));
      const target = posterPathFor(asset.path);
      const up = await supabase.storage.from(BUCKET).upload(target, await readFile(jpg), { contentType: "image/jpeg", upsert: true });
      if (!up.error) meta.poster = target;
      unlink(jpg).catch(() => {});
    } catch {
      // no thumbnail is fine
    }
    await supabase.from("clip_assets").update({ status: "ready", meta, analysis, error: null }).eq("id", asset.id);
    await saveToLibrary(supabase, project, { ...asset, meta, analysis });
  } catch (e) {
    await supabase.from("clip_assets").update({ status: "error", error: e instanceof Error ? e.message : String(e) }).eq("id", asset.id);
    throw e;
  } finally {
    unlink(tmp.file).catch(() => {});
  }
}

async function brandAndProduct(supabase: SupabaseClient, project: ClipProjectRow): Promise<Pick<ClipsContext, "brand" | "product">> {
  const brand = await getBrand(supabase, project.brand_id);
  const p = brand.profile;
  const product = project.product_id ? await getProduct(supabase, project.brand_id, project.product_id).catch(() => null) : null;
  const pp = product?.profile;
  return {
    brand: {
      name: brand.name,
      audience: `${p.target_audience.gender}, ${p.target_audience.age_from}–${p.target_audience.age_to} lat. ${p.target_audience.description}`,
      personas: p.personas.map((x) => `${x.name}: ${x.who}`),
      tone: p.tone_of_voice.description,
      caption_profile: p.caption_profile,
      colors: { ...p.colors } as Record<string, string>,
      preferences: p.learned_preferences ?? [],
    },
    product: {
      name: product?.name ?? brand.name,
      problem: pp?.problem ?? "",
      problems: pp?.problems?.slice(0, 8) ?? [],
      mechanism: pp?.mechanism ?? "",
      benefits: pp?.benefits?.slice(0, 6) ?? [],
      angles: (pp?.ad_angles ?? []).slice(0, 6).map((a) => `${a.angle} — hook: ${a.hook}`),
      offer: pp?.offer ?? "",
    },
  };
}

// 2) Voiceover: word timings (ElevenLabs), cut the dead air, caption chunks, script feedback.
export async function processVoiceover(supabase: SupabaseClient, project: ClipProjectRow, asset: ClipAssetRow) {
  if (!asset.path) throw new UserError("Lektor nie został wgrany.");
  await supabase.from("clip_assets").update({ status: "analyzing", error: null }).eq("id", asset.id);
  const source = (asset.meta.original_path as string | undefined) ?? asset.path; // always transcribe the original
  const tmp = await toTmp(supabase, source);
  try {
    const info = await probe(tmp.file);
    const key = await getProviderKey(supabase, "elevenlabs");
    const raw = await transcribe(key, tmp.data, path.basename(source), mimeFor(source, tmp.mime));
    const brandName = (await getBrand(supabase, project.brand_id)).name;
    const text = fixBrandName(raw.text, brandName);
    const words = raw.words.map((w) => ({ ...w, text: fixBrandName(w.text, brandName) }));
    const timeline = tighten(words, info.duration);
    const captions = captionChunks(timeline.phrases);
    const sil = await silences(tmp.file, info.duration).catch(() => []);
    let feedback: ScriptFeedback | null = null;
    try {
      const anthropic = await getProviderKey(supabase, "anthropic");
      feedback = await scriptFeedback(anthropic, text, await brandAndProduct(supabase, project), timeline.duration);
    } catch {
      feedback = null; // feedback is a bonus — never block the edit
    }
    // Steady loudness for the browser mix; the original stays in storage.
    let playPath = asset.path;
    const meta: Record<string, unknown> = { ...asset.meta, duration: info.duration, silences: sil.length };
    if (!asset.meta.original_path) {
      const norm = tmp.file + ".norm.wav";
      try {
        await normalizeVoice(tmp.file, norm);
        const target = source.replace(/\.[^./]+$/, "") + ".norm.wav";
        const { error } = await supabase.storage.from(BUCKET).upload(target, await readFile(norm), { contentType: "audio/wav", upsert: true });
        if (!error) {
          playPath = target;
          meta.original_path = source;
        }
      } catch {
        // not critical — the edit just plays the original level
      } finally {
        unlink(norm).catch(() => {});
      }
    }
    const voiceover: VoiceoverData = { asset_id: asset.id, text, words, timeline, captions, feedback };
    await supabase.from("clip_assets").update({ status: "ready", path: playPath, meta, error: null }).eq("id", asset.id);
    await supabase.from("clip_projects").update({ voiceover }).eq("id", project.id);
    return voiceover;
  } catch (e) {
    await supabase.from("clip_assets").update({ status: "error", error: e instanceof Error ? e.message : String(e) }).eq("id", asset.id);
    throw e;
  } finally {
    unlink(tmp.file).catch(() => {});
  }
}

export function assetInfo(a: ClipAssetRow): AssetInfo {
  return { id: a.id, duration: Number(a.meta.duration ?? 0), cuts: (a.meta.cuts as number[]) ?? [], mirrored: Boolean(a.meta.mirrored) };
}

export async function buildContext(supabase: SupabaseClient, project: ClipProjectRow, assets: ClipAssetRow[]) {
  const bp = await brandAndProduct(supabase, project);
  const usable = assets.filter((a) => (a.kind === "clip" || a.kind === "generated") && a.status === "ready" && Number(a.meta.duration) > 0);
  const aliases: Record<string, string> = {};
  let c = 0;
  let g = 0;
  const ctxAssets: ClipsContext["assets"] = usable.map((a) => {
    const alias = a.kind === "generated" ? `g${++g}` : `c${++c}`;
    aliases[alias] = a.id;
    const info = { ...assetInfo(a), id: alias };
    return { alias, kind: a.kind as "clip" | "generated", info, analysis: (a.analysis as ClipAnalysis) ?? null, brief: (a.meta.purpose as string) ?? null };
  });
  const images = project.product_id ? await getProductImages(supabase, project.product_id) : [];
  const ctx: ClipsContext = {
    ...bp,
    voiceover: project.voiceover ? { phrases: project.voiceover.timeline.phrases, duration: project.voiceover.timeline.duration } : null,
    assets: ctxAssets,
    library: { music: library.music.map((m) => m.file), sfx: library.sfx.map((s) => ({ file: s.file, category: s.category })) },
    settings: { music: project.settings.music || "auto", formats: project.settings.formats ?? ["4x5"], notes: project.settings.notes ?? "" },
    hasPackshot: images.length > 0,
  };
  return { ctx, aliases, images };
}

// 3) What's missing → submit generations to fal (Seedance 2.5) with the user's key.
export async function requestMissing(supabase: SupabaseClient, userId: string, project: ClipProjectRow, assets: ClipAssetRow[]) {
  const { ctx, images } = await buildContext(supabase, project, assets);
  const anthropic = await getProviderKey(supabase, "anthropic");
  const missing = await missingShots(anthropic, ctx);
  let submitted = 0;
  if (missing.shots.length) {
    const fal = await getProviderKey(supabase, "fal");
    const urls = await signedUrls(supabase, images.map((i) => i.storage_path).slice(0, 4), 7200);
    for (const shot of missing.shots) {
      const id = randomUUID();
      const request_id = await submitShot(fal, { prompt: shot.prompt, duration: shot.duration, mode: shot.mode, imageUrls: Object.values(urls) });
      await supabase.from("clip_assets").insert({
        id,
        user_id: userId,
        project_id: project.id,
        kind: "generated",
        name: shot.purpose.slice(0, 80),
        status: "generating",
        meta: { request_id, prompt: shot.prompt, purpose: shot.purpose, mode: shot.mode, duration_req: shot.duration, attempts: 1 },
      });
      submitted++;
    }
  }
  await supabase
    .from("clip_projects")
    .update({ settings: { ...project.settings, generated: "done" }, plan: project.plan ? { ...project.plan, missing_notes: missing.notes } : null, review: { missing_notes: missing.notes } })
    .eq("id", project.id);
  return { submitted, notes: missing.notes };
}

// 4) Poll fal; finished videos are copied into the user's storage (then analysed like uploads).
export async function pollGenerations(supabase: SupabaseClient, userId: string, project: ClipProjectRow, assets: ClipAssetRow[]) {
  const pending = assets.filter((a) => a.kind === "generated" && a.status === "generating");
  if (!pending.length) return { pending: 0 };
  const fal = await getProviderKey(supabase, "fal");
  let left = 0;
  for (const a of pending) {
    const st = await shotStatus(fal, String(a.meta.request_id));
    if (st.state === "queued" || st.state === "running") {
      left++;
      continue;
    }
    if (st.state === "failed" || !st.url) {
      const attempts = Number(a.meta.attempts ?? 1);
      if (attempts < 2) {
        const request_id = await submitShot(fal, { prompt: String(a.meta.prompt), duration: Number(a.meta.duration_req ?? 5), mode: "t2v" });
        await supabase.from("clip_assets").update({ meta: { ...a.meta, request_id, attempts: attempts + 1 } }).eq("id", a.id);
        left++;
      } else {
        await supabase.from("clip_assets").update({ status: "error", error: `Generowanie nie powiodło się (${st.error ?? "fal"}).` }).eq("id", a.id);
      }
      continue;
    }
    const res = await fetch(st.url, { signal: AbortSignal.timeout(120_000) });
    const buf = Buffer.from(await res.arrayBuffer());
    const storagePath = `${userId}/clips/${project.id}/${a.id}.mp4`;
    const up = await supabase.storage.from(BUCKET).upload(storagePath, buf, { contentType: "video/mp4", upsert: true });
    if (up.error) throw new UserError(`Nie udało się zapisać wygenerowanego ujęcia: ${up.error.message}`);
    await supabase.from("clip_assets").update({ path: storagePath, status: "uploaded" }).eq("id", a.id);
  }
  return { pending: left };
}

const REVISE_BUDGET_MS = 170_000;
const FINAL_REVIEW_BUDGET_MS = 230_000;

// 5) Edit plan with the Kontroler loop, then the deterministic sanitizer.
export async function makePlan(supabase: SupabaseClient, project: ClipProjectRow, assets: ClipAssetRow[], feedback?: string) {
  const started = Date.now();
  const { ctx, aliases } = await buildContext(supabase, project, assets);
  if (!ctx.assets.length) throw new UserError("Brak przeanalizowanych nagrań do montażu.");
  const anthropic = await getProviderKey(supabase, "anthropic");
  const previous = feedback && project.plan ? project.plan.plan : undefined;
  const { result, report } = await controlLoop<EditPlan>({
    draft: await planEdit(anthropic, ctx, { feedback, previous }),
    review: (p) => reviewPlan(anthropic, ctx, p),
    revise: (p, issues) => planEdit(anthropic, ctx, { issues, previous: p, feedback }),
    canRevise: () => Date.now() - started < REVISE_BUDGET_MS,
    hasTimeFor: () => Date.now() - started < FINAL_REVIEW_BUDGET_MS,
  });
  // aliases (c1, g1…) → real asset ids; music start from the library manifest
  const mapSrc = <T extends { asset: string }>(s: T): T => ({ ...s, asset: aliases[s.asset] ?? s.asset });
  const mapped: EditPlan = {
    ...result,
    shots: result.shots.map((s) => (s.type === "clip" ? { ...s, src: mapSrc(s.src) } : s.type === "split" ? { ...s, top: mapSrc(s.top), bottom: mapSrc(s.bottom) } : s)),
    original_audio: result.original_audio.map(mapSrc),
  };
  const chosen = project.settings.music && project.settings.music !== "auto" && project.settings.music !== "none" ? project.settings.music : mapped.music.file;
  const track = library.music.find((m) => m.file === chosen);
  mapped.music = project.settings.music === "none" || !track ? { ...mapped.music, file: null } : { ...mapped.music, file: track.file, start_at: track.start ?? 0 };
  mapped.sfx = mapped.sfx.filter((x) => library.sfx.some((s) => s.file === x.file));
  const infos = assets.filter((a) => a.kind === "clip" || a.kind === "generated").map(assetInfo);
  const brandName = (await getBrand(supabase, project.brand_id)).name;
  const fix = (t: string) => fixBrandName(t, brandName);
  mapped.shots = mapped.shots.map((s) => (s.type === "packshot" ? { ...s, headline: fix(s.headline), cta: fix(s.cta), chips: s.chips.map(fix) } : s));
  mapped.text_plates = mapped.text_plates.map((t) => ({ ...t, text: fix(t.text) }));
  const { plan, notes } = sanitizePlan(mapped, infos);
  const stored = { plan, notes, aliases, report, missing_notes: (project.review as { missing_notes?: string } | null)?.missing_notes, mix: project.plan?.mix };
  await supabase.from("clip_projects").update({ plan: stored, status: "ready", error: null }).eq("id", project.id);
  return stored;
}

// 6) Feedback after a finished sklejka: lasting brand preferences + a new plan.
export async function applyFeedback(supabase: SupabaseClient, project: ClipProjectRow, assets: ClipAssetRow[], text: string) {
  const anthropic = await getProviderKey(supabase, "anthropic");
  const brand = await getBrand(supabase, project.brand_id);
  const existing = brand.profile.learned_preferences ?? [];
  const fb = await interpretFeedback(anthropic, text, existing);
  const merged = [...existing, ...fb.brand_preferences.filter((p) => !existing.includes(p))];
  await supabase.from("brands").update({ profile: { ...brand.profile, learned_preferences: merged } }).eq("id", brand.id);
  const history = [...(project.feedback ?? []), { at: new Date().toISOString(), text, changes: fb.video_changes }];
  await supabase.from("clip_projects").update({ feedback: history }).eq("id", project.id);
  const fresh = { ...project, feedback: history };
  const plan = await makePlan(supabase, fresh, assets, `${text}\n\nInterpretacja: ${fb.video_changes}`);
  return { plan, preferences: fb.brand_preferences };
}

// 7) Kontroler on the finished render (Gemini watches the whole video).
export async function reviewRendered(supabase: SupabaseClient, project: ClipProjectRow, render: ClipAssetRow): Promise<RenderReview> {
  if (!render.path) throw new UserError("Brak pliku renderu.");
  const tmp = await toTmp(supabase, render.path);
  try {
    const { brand, product } = await brandAndProduct(supabase, project);
    const key = await getProviderKey(supabase, "gemini");
    const review = await reviewRender(key, tmp.data, { product: product.name, audience: brand.audience, preferences: brand.preferences });
    await supabase.from("clip_assets").update({ analysis: review }).eq("id", render.id);
    return review;
  } finally {
    unlink(tmp.file).catch(() => {});
  }
}
