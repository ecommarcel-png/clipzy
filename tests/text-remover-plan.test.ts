import { describe, expect, it } from "vitest";
import { boxFilters, planChunks, textBand, textSegments, type SampledFrame } from "@/lib/text-remover/plan";

const size = { width: 1080, height: 1924 };
const A: SampledFrame["boxes"] = [[141, 100, 178, 904], [181, 214, 222, 781]];
const B: SampledFrame["boxes"] = [[189, 69, 228, 934]];

describe("text remover plan", () => {
  it("groups samples into captions with margins and a little slack in time", () => {
    const frames: SampledFrame[] = [
      ...Array.from({ length: 8 }, (_, k) => ({ i: k + 1, boxes: A })),
      ...Array.from({ length: 4 }, (_, k) => ({ i: k + 9, boxes: B })),
      { i: 13, boxes: [] },
    ];
    const s = textSegments(frames, size);
    expect(s).toHaveLength(2);
    expect(s[0]).toMatchObject({ start: 0, end: 4.25 });
    expect(s[1].start).toBeCloseTo(3.5);
    expect(s[1].end).toBeCloseTo(6.25);
    expect(s[0].boxes[0].x).toBeLessThan(108);
    expect(s[0].boxes[0].y).toBeLessThan(271);
  });

  it("finds the band holding every caption", () => {
    const s = textSegments([{ i: 1, boxes: A }], size);
    const band = textBand(s, size.height)!;
    expect(band.y).toBeLessThanOrEqual(s[0].boxes[0].y - 100);
    expect(band.y + band.h).toBeGreaterThanOrEqual(s[0].boxes[1].y + s[0].boxes[1].h);
    expect(band.h % 2).toBe(0);
    expect(textBand([], 1000)).toBeNull();
  });

  it("splits at hard cuts, keeps pieces ≤ 77 frames and skips shots without text", () => {
    const segs = [{ start: 0, end: 3.5, boxes: [] }, { start: 9.5, end: 13.5, boxes: [] }];
    const chunks = planChunks(405, 30, [3.7667, 8.2], segs);
    expect(chunks.every((c) => c.len <= 77)).toBe(true);
    expect(chunks[0]).toEqual({ start: 0, len: 77 });
    expect(chunks[1]).toEqual({ start: 77, len: 36 });
    // 113–246 has no caption
    expect(chunks.some((c) => c.start >= 113 && c.start < 246)).toBe(false);
    expect(chunks.at(-1)!.start + chunks.at(-1)!.len).toBe(405);
  });

  it("writes drawbox filters relative to the band and the piece", () => {
    const f = boxFilters([{ start: 1, end: 2, boxes: [{ x: 10, y: 300, w: 50, h: 40 }] }], { y: 100, h: 600 }, "black", 0.5);
    expect(f[0]).toBe("drawbox=x=10:y=200:w=50:h=40:color=black:t=fill:enable='between(t,0.500,1.500)'");
  });

  it("merges a flash of a few frames into the piece before it", () => {
    const segs = [{ start: 0, end: 13.5, boxes: [] }];
    const chunks = planChunks(405, 30, [4.96667, 5.03333], segs);
    expect(chunks.some((c) => c.len === 2)).toBe(false);
    expect(chunks.reduce((a, c) => a + c.len, 0)).toBe(405);
  });
});
