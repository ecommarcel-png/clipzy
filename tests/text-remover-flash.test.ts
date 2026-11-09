import { describe, expect, it } from "vitest";
import { dilate, findSeeds, groupSeeds, hitRuns, maskBounds, maskPgm, matchOverlay, packMask, pickSource, smallSize, toFilm } from "@/lib/text-remover/flash";

const W = 64;
const H = 64;
const CAP = { x: 16, y: 10, w: 30, h: 8 };

// a slowly moving scene with a hard cut at frame 40
function scene(t: number): Uint8Array {
  const f = new Uint8Array(W * H);
  const cut = t >= 40;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = cut ? 60 + 40 * Math.cos((x - t * 0.3) / 6) + 20 * Math.sin(y / 5) : 110 + 40 * Math.sin((x + t * 0.3) / 5) + 25 * Math.cos(y / 7);
      f[y * W + x] = Math.round(v);
    }
  }
  return f;
}

// the overlay: white "letters" with a dark outline, always the same
function stamp(f: Uint8Array, at = CAP) {
  for (let y = at.y; y < at.y + at.h; y++) {
    for (let x = at.x; x < at.x + at.w; x++) {
      const edge = y === at.y || y === at.y + at.h - 1 || x === at.x || x === at.x + at.w - 1;
      f[y * W + x] = edge ? 15 : (x - at.x) % 6 < 4 ? 250 : 30;
    }
  }
}

const FLASH = [10, 25, 26, 40];
const STATIC = { from: 50, to: 60, at: { x: 10, y: 44, w: 36, h: 8 } };

function film(): Uint8Array[] {
  return Array.from({ length: 70 }, (_, t) => {
    const f = scene(t);
    if (FLASH.includes(t)) stamp(f);
    if (t >= STATIC.from && t <= STATIC.to) stamp(f, STATIC.at);
    return f;
  });
}

function crop(frames: Uint8Array[], b: { x: number; y: number; w: number; h: number }) {
  return frames.map((f) => {
    const c = new Uint8Array(b.w * b.h);
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) c[y * b.w + x] = f[(b.y + y) * W + b.x + x];
    return c;
  });
}

describe("flashing captions", () => {
  it("finds every one- and two-frame flash of the same overlay, also at a cut, and leaves ordinary captions out", () => {
    const frames = film();
    const groups = groupSeeds(findSeeds(frames, W, H));
    const runs = groups.flatMap((g) => {
      const b = { x: Math.max(0, g.box.x - 3), y: Math.max(0, g.box.y - 3), w: Math.min(W, g.box.x + g.box.w + 3) - Math.max(0, g.box.x - 3), h: Math.min(H, g.box.y + g.box.h + 3) - Math.max(0, g.box.y - 3) };
      return hitRuns(matchOverlay(crop(frames, b), g.frames).hits);
    });
    expect(runs).toEqual([
      { start: 10, len: 1 },
      { start: 25, len: 2 },
      { start: 40, len: 1 },
    ]);
  });

  it("copies from the neighbour in the same shot", () => {
    const frames = film();
    expect(pickSource(frames, W, { start: 25, len: 2 }, CAP)).toBe(24);
    // frame 39 is the other shot: the flash right at the cut takes frame 41
    expect(pickSource(frames, W, { start: 40, len: 1 }, CAP)).toBe(41);
  });

  it("a scene without flashes gives nothing", () => {
    const frames = Array.from({ length: 30 }, (_, t) => scene(t));
    expect(groupSeeds(findSeeds(frames, W, H))).toEqual([]);
  });

  it("small-frame box maps to even film pixels inside the frame", () => {
    expect(smallSize(720, 1280)).toEqual({ w: 144, h: 256 });
    const b = toFilm({ x: 0, y: 36, w: 97, h: 17 }, { w: 144, h: 256 }, { width: 720, height: 1280 });
    expect(b.x).toBe(0);
    expect([b.x, b.y, b.w, b.h].every((v) => v % 2 === 0)).toBe(true);
    expect(b.x + b.w).toBeLessThanOrEqual(720);
  });

  it("mask: grown, bounded, packed and written as PGM", () => {
    const m = new Uint8Array(20 * 10);
    for (let x = 5; x < 15; x++) m[5 * 20 + x] = 1;
    const g = dilate(m, 20, 10, 2);
    const area = maskBounds(g, 20, 10)!;
    expect(area).toEqual({ x: 3, y: 3, w: 14, h: 5 });
    const packed = packMask(g, 20, 10, area);
    const pgm = maskPgm(packed);
    const head = `P5\n14 5\n255\n`;
    expect(pgm.subarray(0, head.length).toString()).toBe(head);
    const body = pgm.subarray(head.length);
    expect(body.length).toBe(70);
    expect(body.filter((v) => v === 255).length).toBe(g.filter(Boolean).length);
  });
});
