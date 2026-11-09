// Text remover: from the boxes Gemini saw (2 fps) to the pieces fal repaints. Pure, so it can be tested.

/** Boxes on one sampled frame, normalised 0–1000: [ymin, xmin, ymax, xmax]. */
export type SampledFrame = { i: number; boxes: Array<[number, number, number, number]> };
/** A caption on screen: from `start` to `end` (s), boxes in pixels. */
export type TextSegment = { start: number; end: number; boxes: Array<{ x: number; y: number; w: number; h: number }> };
export type Band = { y: number; h: number };
export type Chunk = { start: number; len: number };

export const SAMPLE_FPS = 2;
/** frames fal's VOID model repaints per request */
export const CHUNK_FRAMES = 77;
/** shots shorter than this are merged into the previous piece */
export const MIN_SHOT = 8;

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

/** Consecutive samples with the same boxes become one caption; boxes get a margin for the outline/shadow. */
export function textSegments(frames: SampledFrame[], size: { width: number; height: number }, sampleFps = SAMPLE_FPS): TextSegment[] {
  const step = 1 / sampleFps;
  const sorted = [...frames].sort((a, b) => a.i - b.i);
  const groups: Array<{ start: number; end: number; boxes: SampledFrame["boxes"] }> = [];
  for (const f of sorted) {
    const t = (f.i - 1) * step;
    const boxes = f.boxes.filter((b) => b.length === 4 && b[2] > b[0] && b[3] > b[1]);
    const last = groups[groups.length - 1];
    if (!boxes.length) continue;
    if (last && Math.abs(last.end - t) < step / 2 + 1e-6 && JSON.stringify(last.boxes) === JSON.stringify(boxes)) last.end = t + step;
    else groups.push({ start: t, end: t + step, boxes });
  }
  const padY = 0.012 * size.height;
  const padX = 0.015 * size.width;
  return groups.map((g) => ({
    // a caption appears somewhere in the half second before its first sample and may stay a bit after the last
    start: Math.max(0, g.start - step),
    end: g.end + step / 2,
    boxes: g.boxes.map(([y0, x0, y1, x1]) => {
      const x = Math.max(0, (x0 / 1000) * size.width - padX);
      const y = Math.max(0, (y0 / 1000) * size.height - padY);
      return { x: Math.round(x), y: Math.round(y), w: Math.round(Math.min(size.width, (x1 / 1000) * size.width + padX) - x), h: Math.round(Math.min(size.height, (y1 / 1000) * size.height + padY) - y) };
    }),
  }));
}

/** The horizontal strip of the frame that holds every caption, with room around it for the model to see the scene. */
export function textBand(segments: TextSegment[], height: number, context = 150): Band | null {
  const ys = segments.flatMap((s) => s.boxes.flatMap((b) => [b.y, b.y + b.h]));
  if (!ys.length) return null;
  const top = Math.max(0, Math.min(...ys) - context);
  const bottom = Math.min(height, Math.max(...ys) + context);
  const y = even(top) > top ? even(top) - 2 : even(top);
  return { y: Math.max(0, y), h: Math.min(even(bottom - Math.max(0, y)), height - Math.max(0, y)) };
}

/**
 * Pieces of at most CHUNK_FRAMES frames that never cross a hard cut (the model mixes two shots
 * otherwise) and only where a caption is on screen.
 */
export function planChunks(totalFrames: number, fps: number, cuts: number[], segments: TextSegment[]): Chunk[] {
  const bounds = [0, ...cuts.map((c) => Math.round(c * fps)).filter((f) => f > 0 && f < totalFrames), totalFrames];
  const uniq = [...new Set(bounds)].sort((a, b) => a - b);
  const hasText = (a: number, b: number) => segments.some((s) => s.start * fps < b && s.end * fps > a);
  const out: Chunk[] = [];
  for (let k = 0; k < uniq.length - 1; k++) {
    for (let s = uniq[k]; s < uniq[k + 1]; s += CHUNK_FRAMES) {
      const len = Math.min(CHUNK_FRAMES, uniq[k + 1] - s);
      if (!hasText(s, s + len)) continue;
      // a flash of a few frames is not worth its own request: it joins the piece before it
      const prev = out[out.length - 1];
      if (len < MIN_SHOT && prev && prev.start + prev.len === s && prev.len + len <= CHUNK_FRAMES) prev.len += len;
      else out.push({ start: s, len });
    }
  }
  return out;
}

/** ffmpeg drawbox filters that paint the caption boxes (offset into the band, times relative to `t0`). */
export function boxFilters(segments: TextSegment[], band: Band, color: string, t0 = 0): string[] {
  return segments.flatMap((s) =>
    s.boxes.map((b) => `drawbox=x=${b.x}:y=${b.y - band.y}:w=${b.w}:h=${b.h}:color=${color}:t=fill:enable='between(t,${(s.start - t0).toFixed(3)},${(s.end - t0).toFixed(3)})'`),
  );
}
