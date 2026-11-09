// Captions that flash: the same text overlay shown for one or two frames at a time, scattered
// through the film (a common trick against reuse detection). Sampling at 2 fps misses most of
// them, so these are found frame by frame on small grayscale frames, and each one is covered
// with the same area from the neighbouring clean frame — no model needed. Pure, so it can be tested.

export type Box = { x: number; y: number; w: number; h: number };
/** Where the overlay's pixels are inside `box`, at w×h (bits packed, base64). */
export type OverlayMask = { w: number; h: number; bits: string };
/**
 * One flash: frames [start, start+len) show the overlay; `source` is the clean frame whose
 * pixels cover it — only under `mask` (the letters and a few pixels around), so a moving scene
 * does not show a rectangular patch.
 */
export type Flash = { start: number; len: number; source: number; box: Box; mask?: OverlayMask };
type Seed = { i: number; len: number; box: Box };

/** a pixel "changed" between two frames */
const CHANGED = 40;
/** a pixel stayed the same between the two reference frames */
const STABLE = 18;
/** a template pixel matches */
const MATCH = 16;
/** share of template pixels that must match for a frame to show the overlay */
export const HIT = 0.75;
/** longer runs are ordinary captions (Gemini + the model handle those) */
export const MAX_RUN = 3;

/** Size of the small frames used for the search: the long side 256 px, even numbers. */
export function smallSize(width: number, height: number): { w: number; h: number } {
  const s = 256 / Math.max(width, height);
  const even = (n: number) => Math.max(2, Math.round((n * s) / 2) * 2);
  return { w: even(width), h: even(height) };
}

function percentile(hist: Uint32Array, total: number, p: number): number {
  const goal = total * p;
  let acc = 0;
  for (let k = 0; k < hist.length; k++) {
    acc += hist[k];
    if (acc >= goal) return k;
  }
  return hist.length - 1;
}

/**
 * Frames where a compact, dense patch appears that is not in a steady reference pair next to it,
 * while the rest of the frame matches that reference: the candidate flashes.
 */
export function findSeeds(frames: Uint8Array[], w: number, h: number): Seed[] {
  const n = frames.length;
  const px = w * h;
  const minPix = Math.max(24, Math.round(0.004 * px));
  const mask = new Uint8Array(px);
  const xs = new Uint32Array(w);
  const ys = new Uint32Array(h);
  const seeds: Seed[] = [];

  // `a`,`b`: the steady reference pair; `other`: the frame on the run's other side, which must
  // differ too — otherwise the change belongs to the reference side (a caption that starts or a
  // flash next door), not to this run
  const test = (i: number, len: number, a: number, b: number, both: boolean, other: number): Seed | null => {
    const A = frames[a];
    const B = frames[b];
    const O = other >= 0 && other < n ? frames[other] : null;
    xs.fill(0);
    ys.fill(0);
    let count = 0;
    for (let p = 0; p < px; p++) {
      mask[p] = 0;
      if (Math.abs(A[p] - B[p]) >= STABLE) continue;
      let ok = true;
      for (let j = i; j < i + len && ok; j++) {
        const v = frames[j][p];
        if (Math.abs(v - A[p]) <= CHANGED || (both && Math.abs(v - B[p]) <= CHANGED) || (O && Math.abs(v - O[p]) <= CHANGED)) ok = false;
      }
      if (!ok) continue;
      mask[p] = 1;
      count++;
      xs[p % w]++;
      ys[(p / w) | 0]++;
    }
    if (count < minPix) return null;
    const x0 = percentile(xs, count, 0.02);
    const x1 = percentile(xs, count, 0.98);
    const y0 = percentile(ys, count, 0.02);
    const y1 = percentile(ys, count, 0.98);
    const area = (x1 - x0 + 1) * (y1 - y0 + 1);
    if (count / area < 0.2 || area / px > 0.15) return null;
    // outside the patch the flash frame is the reference frame
    let diff = 0;
    let outside = 0;
    const F = frames[i];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (x >= x0 && x <= x1 && y >= y0 && y <= y1) continue;
        diff += Math.abs(F[y * w + x] - A[y * w + x]);
        outside++;
      }
    }
    if (!outside || diff / outside >= 3) return null;
    return { i, len, box: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } };
  };

  for (let i = 0; i < n; i++) {
    let hit: Seed | null = null;
    for (let len = 1; len <= 2 && !hit && i + len <= n; len++) {
      const a = i - 1;
      const b = i + len;
      // both neighbours, or two frames on one side (the flash may sit right at a cut)
      if (a >= 0 && b < n) hit = test(i, len, a, b, true, -1);
      if (!hit && b + 1 < n) hit = test(i, len, b, b + 1, false, a);
      if (!hit && a - 1 >= 0) hit = test(i, len, a, a - 1, false, b);
    }
    if (hit) {
      seeds.push(hit);
      i += hit.len - 1;
    }
  }
  return seeds;
}

function iou(p: Box, q: Box): number {
  const ix = Math.max(0, Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x));
  const iy = Math.max(0, Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y));
  const inter = ix * iy;
  const union = p.w * p.h + q.w * q.h - inter;
  return union > 0 ? inter / union : 0;
}

/** Seeds in the same place, at least two of them — one patch alone could be anything. */
export function groupSeeds(seeds: Seed[]): Array<{ box: Box; frames: number[] }> {
  const groups: Seed[][] = [];
  for (const s of seeds) {
    const g = groups.find((g) => iou(g[0].box, s.box) > 0.5);
    if (g) g.push(s);
    else groups.push([s]);
  }
  return groups
    .filter((g) => new Set(g.map((s) => s.i)).size >= 2)
    .map((g) => {
      const x0 = Math.min(...g.map((s) => s.box.x));
      const y0 = Math.min(...g.map((s) => s.box.y));
      const x1 = Math.max(...g.map((s) => s.box.x + s.box.w));
      const y1 = Math.max(...g.map((s) => s.box.y + s.box.h));
      return { box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, frames: [...new Set(g.map((s) => s.i))] };
    });
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  return s[s.length >> 1];
}

/**
 * The overlay is the same every time it appears, the scene behind it is not: pixels that agree
 * across the seed frames form a template, and every frame is scored against it. Returns the
 * frames that show the overlay (score per frame for checks).
 */
export function matchOverlay(crops: Uint8Array[], seedFrames: number[]): { hits: number[]; scores: number[]; use: Uint8Array } {
  const px = crops[0]?.length ?? 0;
  let frames = seedFrames.filter((f) => f < crops.length);
  let scores: number[] = new Array(crops.length).fill(0);
  let use = new Uint8Array(px);
  for (let round = 0; round < 3 && frames.length >= 2; round++) {
    const tmpl = new Int16Array(px);
    use = new Uint8Array(px);
    let used = 0;
    for (let p = 0; p < px; p++) {
      const vals = frames.map((f) => crops[f][p]);
      const m = median(vals);
      tmpl[p] = m;
      const agree = vals.filter((v) => Math.abs(v - m) < MATCH).length / vals.length;
      if (agree >= 0.8) {
        use[p] = 1;
        used++;
      }
    }
    // too little in common: not one overlay
    if (used < 0.02 * px) return { hits: [], scores, use };
    scores = crops.map((c) => {
      let ok = 0;
      for (let p = 0; p < px; p++) if (use[p] && Math.abs(c[p] - tmpl[p]) < MATCH) ok++;
      return ok / used;
    });
    frames = scores.map((s, k) => [s, k] as const).filter(([s]) => s > HIT).map(([, k]) => k);
  }
  return { hits: frames, scores, use };
}

/** The overlay pixels grown by `r` (outline, shadow, compression fringe). */
export function dilate(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      for (let dy = -r; dy <= r; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx;
          if (xx >= 0 && xx < w) out[yy * w + xx] = 1;
        }
      }
    }
  }
  return out;
}

/** Bounding box of the set pixels (rows/columns with a single stray pixel ignored). */
export function maskBounds(mask: Uint8Array, w: number, h: number): Box | null {
  const cols = new Uint32Array(w);
  const rows = new Uint32Array(h);
  for (let p = 0; p < mask.length; p++) if (mask[p]) { cols[p % w]++; rows[(p / w) | 0]++; }
  const first = (a: Uint32Array) => a.findIndex((v) => v > 1);
  const last = (a: Uint32Array) => a.length - 1 - [...a].reverse().findIndex((v) => v > 1);
  const x0 = first(cols);
  const y0 = first(rows);
  if (x0 < 0 || y0 < 0) return null;
  return { x: x0, y: y0, w: last(cols) - x0 + 1, h: last(rows) - y0 + 1 };
}

export function packMask(mask: Uint8Array, w: number, h: number, area: Box): OverlayMask {
  const bytes = new Uint8Array(Math.ceil((area.w * area.h) / 8));
  let k = 0;
  for (let y = area.y; y < area.y + area.h; y++) {
    for (let x = area.x; x < area.x + area.w; x++, k++) if (mask[y * w + x]) bytes[k >> 3] |= 1 << (k & 7);
  }
  return { w: area.w, h: area.h, bits: Buffer.from(bytes).toString("base64") };
}

/** Binary PGM (white = overlay) that ffmpeg reads as the copy mask. */
export function maskPgm(m: OverlayMask): Buffer {
  const bytes = Buffer.from(m.bits, "base64");
  const head = Buffer.from(`P5\n${m.w} ${m.h}\n255\n`);
  const body = Buffer.alloc(m.w * m.h);
  for (let k = 0; k < body.length; k++) body[k] = bytes[k >> 3] & (1 << (k & 7)) ? 255 : 0;
  return Buffer.concat([head, body]);
}

/** Consecutive hit frames → runs; runs longer than MAX_RUN are ordinary captions and stay out. */
export function hitRuns(hits: number[]): Array<{ start: number; len: number }> {
  const sorted = [...new Set(hits)].sort((a, b) => a - b);
  const runs: Array<{ start: number; len: number }> = [];
  for (const f of sorted) {
    const last = runs[runs.length - 1];
    if (last && last.start + last.len === f) last.len++;
    else runs.push({ start: f, len: 1 });
  }
  return runs.filter((r) => r.len <= MAX_RUN);
}

/** The clean neighbour (before or after the run) that looks most like the flash frame outside the box. */
export function pickSource(frames: Uint8Array[], w: number, run: { start: number; len: number }, box: Box): number {
  const n = frames.length;
  const before = run.start - 1;
  const after = run.start + run.len;
  if (before < 0) return Math.min(after, n - 1);
  if (after >= n) return before;
  const F = frames[run.start];
  const d = (k: number) => {
    let s = 0;
    for (let p = 0; p < F.length; p++) {
      const x = p % w;
      const y = (p / w) | 0;
      if (x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h) continue;
      s += Math.abs(F[p] - frames[k][p]);
    }
    return s;
  };
  return d(before) <= d(after) ? before : after;
}

/** Small-frame box → film pixels, with a margin, on even numbers inside the frame. */
export function toFilm(box: Box, small: { w: number; h: number }, film: { width: number; height: number }, margin = 2): Box {
  const sx = film.width / small.w;
  const sy = film.height / small.h;
  const x0 = Math.max(0, Math.floor(((box.x - margin) * sx) / 2) * 2);
  const y0 = Math.max(0, Math.floor(((box.y - margin) * sy) / 2) * 2);
  const x1 = Math.min(film.width, Math.ceil(((box.x + box.w + margin) * sx) / 2) * 2);
  const y1 = Math.min(film.height, Math.ceil(((box.y + box.h + margin) * sy) / 2) * 2);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
