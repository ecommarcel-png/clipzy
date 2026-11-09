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
/** a template pixel matches */
const MATCH = 16;
/** share of template pixels that must match for a frame to show the overlay */
export const HIT = 0.75;
/** longer runs are ordinary captions (Gemini + the model handle those) */
export const MAX_RUN = 3;
/** gradient that counts as a sharp edge (letters, outlines) */
const EDGE = 40;
/** edge counts are kept per TILE×TILE square */
const TILE = 12;
/** the most suspicious frames compared pairwise */
const MAX_CANDIDATES = 60;
/** sharp-edge pixels two flashes must share, at the same place and value */
const MIN_SHARED = 40;

/** Size of the small frames used for the search: the long side 384 px, even numbers. */
export function smallSize(width: number, height: number): { w: number; h: number } {
  const s = 384 / Math.max(width, height);
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

/** 1 where the frame has a sharp edge (to the right or below). */
function edgeMap(f: Uint8Array, w: number, h: number): Uint8Array {
  const e = new Uint8Array(w * h);
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const p = y * w + x;
      if (Math.abs(f[p + 1] - f[p]) > EDGE || Math.abs(f[p + w] - f[p]) > EDGE) e[p] = 1;
    }
  }
  return e;
}

function tileCounts(e: Uint8Array, w: number, h: number): Uint16Array {
  const tw = Math.floor(w / TILE);
  const th = Math.floor(h / TILE);
  const t = new Uint16Array(tw * th);
  for (let y = 0; y < th * TILE; y++) {
    const row = ((y / TILE) | 0) * tw;
    for (let x = 0; x < tw * TILE; x++) if (e[y * w + x]) t[row + ((x / TILE) | 0)]++;
  }
  return t;
}

type Candidate = { i: number; score: number; tiles: Uint8Array };

/**
 * Where an overlay flashes. Step 1: frames where some squares suddenly get many more sharp edges
 * than in the frames around them (letters appearing for a frame or two) — robust to camera
 * movement, which changes the picture but not how much fine detail it has. Step 2: those frames
 * compared pairwise: a flashed caption is identical, pixel for pixel, every time it appears, while
 * the scene behind it is not. Pairs that share enough sharp pixels at the same place form a group.
 */
export function findOverlays(frames: Uint8Array[], w: number, h: number): Array<{ box: Box; frames: number[] }> {
  const n = frames.length;
  const tw = Math.floor(w / TILE);
  const th = Math.floor(h / TILE);
  if (n < 3 || !tw || !th) return [];
  const edges = new Map<number, Uint8Array>();
  const edgeOf = (i: number) => {
    let e = edges.get(i);
    if (!e) edges.set(i, (e = edgeMap(frames[i], w, h)));
    return e;
  };
  const E = frames.map((_, i) => tileCounts(edgeOf(i), w, h));
  edges.clear();

  const cands: Candidate[] = [];
  for (let i = 0; i < n; i++) {
    for (let len = 1; len <= 2 && i + len <= n; len++) {
      const before = i > 0 ? E[i - 1] : null;
      const after = i + len < n ? E[i + len] : null;
      if (!before && !after) continue;
      const tiles = new Uint8Array(tw * th);
      let count = 0;
      let score = 0;
      for (let t = 0; t < tiles.length; t++) {
        const cur = len === 1 ? E[i][t] : Math.min(E[i][t], E[i + 1][t]);
        const nb = Math.max(before?.[t] ?? 0, after?.[t] ?? 0);
        if (cur - nb >= 12 && cur >= 2 * nb + 6) {
          tiles[t] = 1;
          count++;
          score += cur - nb;
        }
      }
      if (count >= 3) {
        cands.push({ i, score, tiles });
        break;
      }
    }
  }
  const top = cands.sort((a, b) => b.score - a.score).slice(0, MAX_CANDIDATES);

  // pairs of candidates that show the same sharp pixels at the same place
  const xs = new Uint32Array(w);
  const ys = new Uint32Array(h);
  const pairs: Array<{ a: number; b: number; box: Box }> = [];
  for (let a = 0; a < top.length; a++) {
    for (let b = a + 1; b < top.length; b++) {
      const A = top[a];
      const B = top[b];
      if (Math.abs(A.i - B.i) < 4) continue;
      const ea = edgeOf(A.i);
      const eb = edgeOf(B.i);
      const fa = frames[A.i];
      const fb = frames[B.i];
      xs.fill(0);
      ys.fill(0);
      let count = 0;
      for (let ty = 0; ty < th; ty++) {
        for (let tx = 0; tx < tw; tx++) {
          const t = ty * tw + tx;
          if (!A.tiles[t] || !B.tiles[t]) continue;
          for (let y = ty * TILE; y < (ty + 1) * TILE; y++) {
            for (let x = tx * TILE; x < (tx + 1) * TILE; x++) {
              const p = y * w + x;
              if (ea[p] && eb[p] && Math.abs(fa[p] - fb[p]) < 12) {
                count++;
                xs[x]++;
                ys[y]++;
              }
            }
          }
        }
      }
      if (count < MIN_SHARED) continue;
      const x0 = percentile(xs, count, 0.02);
      const x1 = percentile(xs, count, 0.98);
      const y0 = percentile(ys, count, 0.02);
      const y1 = percentile(ys, count, 0.98);
      pairs.push({ a, b, box: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } });
    }
  }

  // connected candidates → groups (one per overlay; usually a single one)
  const parent = top.map((_, k) => k);
  const find = (k: number): number => (parent[k] === k ? k : (parent[k] = find(parent[k])));
  for (const p of pairs) parent[find(p.a)] = find(p.b);
  const groups = new Map<number, typeof pairs>();
  for (const p of pairs) {
    const r = find(p.a);
    groups.set(r, [...(groups.get(r) ?? []), p]);
  }
  return [...groups.values()]
    .map((ps) => {
      const x0 = Math.min(...ps.map((p) => p.box.x));
      const y0 = Math.min(...ps.map((p) => p.box.y));
      const x1 = Math.max(...ps.map((p) => p.box.x + p.box.w));
      const y1 = Math.max(...ps.map((p) => p.box.y + p.box.h));
      const fr = [...new Set(ps.flatMap((p) => [top[p.a].i, top[p.b].i]))].sort((a, b) => a - b);
      return { box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, frames: fr, pairs: ps.length };
    })
    .sort((a, b) => b.pairs - a.pairs)
    .map(({ box, frames }) => ({ box, frames }));
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
