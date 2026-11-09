import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readdir } from "node:fs/promises";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { CHUNK_FRAMES, SAMPLE_FPS, boxFilters, type Band, type Chunk, type TextSegment } from "./plan";

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
  src: string; out: string; pieces: Array<{ file: string } & Chunk>; band: Band; width: number; fps: number; duration: number; segments: TextSegment[]; hasAudio: boolean;
}) {
  const { band, width, fps } = o;
  const k = o.pieces.length;
  const parts: string[] = [];
  parts.push(`color=c=black:s=${width}x${band.h}:r=${fps}:d=${o.duration.toFixed(3)},${[...boxFilters(o.segments, band, "white"), "gblur=sigma=6", "format=gray"].join(",")}${k > 1 ? `,split=${k}${o.pieces.map((_, i) => `[m${i}]`).join("")}` : "[m0]"}`);
  let base = "[0:v]";
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
  if (!k) parts.push("[0:v]null[v]");
  await ff(
    [
      "-i", o.src, ...o.pieces.flatMap((p) => ["-i", p.file]),
      "-filter_complex", parts.join(";"),
      "-map", "[v]", ...(o.hasAudio ? ["-map", "0:a", "-c:a", "copy"] : []),
      "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-movflags", "+faststart", o.out,
    ],
    280_000,
  );
}

