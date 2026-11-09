import "server-only";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { readdir } from "node:fs/promises";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { CHUNK_FRAMES, SAMPLE_FPS, boxFilters, type Band, type Chunk, type TextSegment } from "./plan";
import { dilate, groupSeeds, findSeeds, hitRuns, maskBounds, maskPgm, matchOverlay, packMask, pickSource, smallSize, toFilm, type Box, type Flash } from "./flash";
import { writeFile } from "node:fs/promises";

// ffmpeg for the text remover: frames for Gemini, the caption strip + mask for fal,
// and the final film where only the repainted caption areas replace the original.

const run = promisify(execFile);

async function ff(args: string[], timeout = 240_000) {
  if (!ffmpegPath) throw new Error("Brak ffmpeg na serwerze.");
  try {
    await run(ffmpegPath as unknown as string, ["-hide_banner", "-v", "error", "-y", ...args], { timeout, maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    const err = e as { stderr?: string; killed?: boolean };
    if (err.killed) throw new Error("Przetwarzanie wideo trwało za długo.");
    throw new Error(`ffmpeg: ${(err.stderr ?? String(e)).slice(-400)}`);
  }
}

/** JPEG frames at 2 fps, 540 px wide — what Gemini looks at. Returns paths in order. */
export async function sampleFrames(src: string, dir: string): Promise<string[]> {
  await ff(["-i", src, "-vf", `fps=${SAMPLE_FPS},scale=540:-2`, "-q:v", "4", path.join(dir, "f%04d.jpg")]);
  return (await readdir(dir)).filter((f) => /^f\d+\.jpg$/.test(f)).sort().map((f) => path.join(dir, f));
}

/** Every frame as raw grayscale bytes (optionally a crop), scaled to w×h — for the flash search. */
export function grayFrames(src: string, w: number, h: number, crop?: Box): Promise<Uint8Array[]> {
  if (!ffmpegPath) throw new Error("Brak ffmpeg na serwerze.");
  const vf = `${crop ? `crop=${crop.w}:${crop.h}:${crop.x}:${crop.y},` : ""}scale=${w}:${h}:flags=area,format=gray`;
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath as unknown as string, ["-hide_banner", "-v", "error", "-i", src, "-an", "-vf", vf, "-fps_mode", "passthrough", "-f", "rawvideo", "-"]);
    const chunks: Buffer[] = [];
    let err = "";
    const timer = setTimeout(() => p.kill("SIGKILL"), 120_000);
    p.stdout.on("data", (d: Buffer) => chunks.push(d));
    p.stderr.on("data", (d: Buffer) => (err += d.toString()));
    p.on("error", reject);
    p.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`ffmpeg: ${err.slice(-300) || `kod ${code}`}`));
      const all = Buffer.concat(chunks);
      const size = w * h;
      const out: Uint8Array[] = [];
      for (let o = 0; o + size <= all.length; o += size) out.push(new Uint8Array(all.buffer, all.byteOffset + o, size));
      resolve(out);
    });
  });
}

/**
 * Captions that flash for a frame or two (see flash.ts): found on small frames, confirmed by
 * matching the overlay at half resolution, each with the clean neighbour frame to copy from.
 */
export async function findFlashes(src: string, film: { width: number; height: number }): Promise<Flash[]> {
  const small = smallSize(film.width, film.height);
  const frames = await grayFrames(src, small.w, small.h);
  const groups = groupSeeds(findSeeds(frames, small.w, small.h)).slice(0, 3);
  const out: Flash[] = [];
  for (const g of groups) {
    // a wide crop: the seed box trims the ends of the text, the overlay mask finds the real edges
    const wide = toFilm(g.box, small, film, 8);
    if (wide.w < 8 || wide.h < 8) continue;
    const half = { w: Math.max(2, Math.round(wide.w / 4) * 2), h: Math.max(2, Math.round(wide.h / 4) * 2) };
    const crops = await grayFrames(src, half.w, half.h, wide);
    const { hits, use } = matchOverlay(crops, g.frames);
    const runs = hitRuns(hits);
    if (!runs.length) continue;
    // letters + outline + compression fringe (≈ 6 px of the film around every letter pixel)
    const grown = dilate(use, half.w, half.h, 3);
    const area = maskBounds(grown, half.w, half.h);
    if (!area) continue;
    const sx = wide.w / half.w;
    const sy = wide.h / half.h;
    const box = { x: wide.x + Math.round(area.x * sx), y: wide.y + Math.round(area.y * sy), w: Math.round(area.w * sx), h: Math.round(area.h * sy) };
    const mask = packMask(grown, half.w, half.h, area);
    for (const run of runs) out.push({ ...run, source: pickSource(frames, small.w, run, g.box), box, mask });
  }
  return out.sort((a, b) => a.start - b.start);
}

/** The clean frames the flashes copy from, as PNG files (index → file). */
export async function sourceFrames(src: string, dir: string, indices: number[]): Promise<Map<number, string>> {
  const uniq = [...new Set(indices)].sort((a, b) => a - b);
  const files = new Map<number, string>();
  if (!uniq.length) return files;
  await ff(["-i", src, "-an", "-vf", `select='${uniq.map((i) => `eq(n,${i})`).join("+")}'`, "-fps_mode", "passthrough", path.join(dir, "s%04d.png")]);
  uniq.forEach((i, k) => files.set(i, path.join(dir, `s${String(k + 1).padStart(4, "0")}.png`)));
  return files;
}

/** Mask files for the flashes (one per distinct mask). */
export async function maskFiles(dir: string, flashes: Flash[]): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  for (const f of flashes) {
    if (!f.mask || files.has(f.mask.bits)) continue;
    const file = path.join(dir, `mask${files.size}.pgm`);
    await writeFile(file, maskPgm(f.mask));
    files.set(f.mask.bits, file);
  }
  return files;
}

/** The caption strip of one piece, padded to the frame count the model takes. */
export async function cutChunk(src: string, out: string, band: Band, width: number, c: Chunk) {
  const pad = CHUNK_FRAMES - c.len;
  await ff([
    "-i", src, "-an",
    // trim (not select) keeps the frame rate, so tpad really adds `pad` copies of the last frame:
    // the piece must have exactly as many frames as the mask, or the mask drifts off the text
    "-vf", `crop=${width}:${band.h}:0:${band.y},trim=start_frame=${c.start}:end_frame=${c.start + c.len},setpts=PTS-STARTPTS${pad > 0 ? `,tpad=stop_mode=clone:stop=${pad}` : ""}`,
    "-frames:v", String(CHUNK_FRAMES), "-fps_mode", "passthrough", "-c:v", "libx264", "-crf", "12", "-preset", "veryfast", "-pix_fmt", "yuv420p", out,
  ]);
}

/**
 * Mask for the model: white = keep, black = caption to remove (that is how VOID reads it).
 * Padded exactly like the piece (copies of its last frame): the padded frames still show the
 * caption, and an unmasked caption there makes the model paint it back into the whole piece.
 */
export async function chunkMask(out: string, band: Band, width: number, segments: TextSegment[], c: Chunk, fps: number) {
  const pad = CHUNK_FRAMES - c.len;
  const dur = ((c.len + 1) / fps).toFixed(4);
  const boxes = boxFilters(segments, band, "black", c.start / fps);
  await ff([
    "-f", "lavfi", "-i", `color=c=white:s=${width}x${band.h}:r=${fps}:d=${dur}`,
    "-vf", [...boxes, `trim=end_frame=${c.len}`, ...(pad > 0 ? [`tpad=stop_mode=clone:stop=${pad}`] : []), "format=gray"].join(","),
    "-frames:v", String(CHUNK_FRAMES), "-fps_mode", "passthrough", "-c:v", "libx264", "-crf", "10", "-preset", "veryfast", "-pix_fmt", "yuv420p", out,
  ]);
}

/**
 * The finished film: each repainted piece goes back into its place, but only inside the
 * (softened) caption boxes — everything else, and the sound, stays original.
 */
export async function compose(o: {
  src: string; out: string; pieces: Array<{ file: string } & Chunk>; band: Band | null; width: number; fps: number; duration: number; segments: TextSegment[]; hasAudio: boolean;
  /** flashing captions and the clean frame (PNG) each one copies its box from */
  flashes?: Array<Flash & { file: string; maskFile?: string }>;
}) {
  const { width, fps } = o;
  const band = o.band ?? { y: 0, h: 2 };
  const k = o.pieces.length;
  const flashes = o.flashes ?? [];
  const parts: string[] = [];
  // inputs: 0 = film, 1..k = repainted pieces, then one image per distinct source frame
  const images = [...new Set(flashes.map((f) => f.file))];
  // one mask image per distinct mask (usually one per film)
  const masks = [...new Set(flashes.map((f) => f.maskFile).filter((m): m is string => Boolean(m)))];
  const maskUses = new Map<string, string[]>();
  masks.forEach((file, j) => {
    const users = flashes.filter((f) => f.maskFile === file);
    const names = users.map((_, u) => `k${j}_${u}`);
    maskUses.set(file, names);
    const { w, h } = users[0].box;
    parts.push(`[${k + 1 + images.length + j}:v]scale=${w}:${h}:flags=bilinear,gblur=sigma=1.5,format=gray${names.length > 1 ? `,split=${names.length}` : ""}${names.map((l) => `[${l}]`).join("")}`);
  });
  const uses = new Map<string, number>();
  for (const f of flashes) uses.set(f.file, (uses.get(f.file) ?? 0) + 1);
  const labels = new Map<string, string[]>();
  images.forEach((file, j) => {
    const n = uses.get(file)!;
    const names = Array.from({ length: n }, (_, u) => `i${j}_${u}`);
    labels.set(file, names);
    parts.push(`[${k + 1 + j}:v]format=yuv420p${n > 1 ? `,split=${n}` : ""}${names.map((l) => `[${l}]`).join("")}`);
  });
  let base = "[0:v]";
  flashes.forEach((f, j) => {
    const l = labels.get(f.file)!.shift()!;
    const mk = f.maskFile ? maskUses.get(f.maskFile)!.shift()! : null;
    parts.push(mk ? `[${l}]crop=${f.box.w}:${f.box.h}:${f.box.x}:${f.box.y},format=yuva420p[fc${j}];[fc${j}][${mk}]alphamerge[fp${j}]` : `[${l}]crop=${f.box.w}:${f.box.h}:${f.box.x}:${f.box.y}[fp${j}]`);
    parts.push(`${base}[fp${j}]overlay=${f.box.x}:${f.box.y}:enable='between(n,${f.start},${f.start + f.len - 1})'[fb${j}]`);
    base = `[fb${j}]`;
  });
  if (k) parts.push(`color=c=black:s=${width}x${band.h}:r=${fps}:d=${o.duration.toFixed(3)},${[...boxFilters(o.segments, band, "white"), "gblur=sigma=6", "format=gray"].join(",")}${k > 1 ? `,split=${k}${o.pieces.map((_, i) => `[m${i}]`).join("")}` : "[m0]"}`);
  o.pieces.forEach((p, i) => {
    const s = (p.start / fps).toFixed(4);
    const e = ((p.start + p.len) / fps).toFixed(4);
    parts.push(`[${i + 1}:v]trim=end_frame=${p.len},scale=${width}:${band.h},setpts=N/(${fps}*TB)+${s}/TB,format=yuv420p[c${i}]`);
    parts.push(`[m${i}]trim=start=${s}:end=${e},setpts=PTS-STARTPTS+${s}/TB[a${i}]`);
    parts.push(`[c${i}][a${i}]alphamerge[p${i}]`);
    const next = i === k - 1 ? "[v]" : `[b${i}]`;
    parts.push(`${base}[p${i}]overlay=0:${band.y}:eof_action=pass:enable='between(t,${s},${e})'${next}`);
    base = `[b${i}]`;
  });
  if (!k) parts.push(`${base}null[v]`);
  await ff(
    [
      "-i", o.src, ...o.pieces.flatMap((p) => ["-i", p.file]), ...images.flatMap((f) => ["-i", f]), ...masks.flatMap((f) => ["-i", f]),
      "-filter_complex", parts.join(";"),
      "-map", "[v]", ...(o.hasAudio ? ["-map", "0:a", "-c:a", "copy"] : []),
      "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-movflags", "+faststart", o.out,
    ],
    280_000,
  );
}

