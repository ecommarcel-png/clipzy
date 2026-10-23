import { describe, expect, it } from "vitest";
import { EditPlan, cleanIntervals, fitSrc, sanitizePlan, FPS, type AssetInfo } from "@/lib/clips/plan";
import { toolSchema } from "@/lib/ai/claude";

const clip4: AssetInfo = { id: "clip4", duration: 11.5, cuts: [1.3, 1.73, 2.47, 4.03, 4.37, 4.43, 9.63] };

describe("cleanIntervals", () => {
  it("keeps a margin around every hard cut", () => {
    const ints = cleanIntervals(clip4);
    expect(ints[0]).toEqual([0, 1.2]);
    for (const [s, e] of ints) for (const c of clip4.cuts) expect(c <= s - 0.099 || c >= e + 0.099).toBe(true);
  });
});

describe("fitSrc", () => {
  it("moves a range that would cross a cut back inside a clean interval", () => {
    const notes: string[] = [];
    const out = fitSrc({ asset: "clip4", from: 9.0, rate: 1 }, 1.0, clip4, notes);
    expect(out.from + 1.0 * out.rate).toBeLessThanOrEqual(9.63 - 0.1 + 1e-6);
  });

  it("slows down a little when the interval is a bit too short", () => {
    const out = fitSrc({ asset: "clip4", from: 0.1, rate: 1 }, 1.5, clip4, []);
    expect(out.rate).toBeLessThan(1);
    expect(out.from + 1.5 * out.rate).toBeLessThanOrEqual(1.2 + 1e-6);
  });

  it("falls back to the longest clean part when nothing nearby fits", () => {
    const notes: string[] = [];
    const out = fitSrc({ asset: "clip4", from: 1.5, rate: 1 }, 3, clip4, notes);
    expect(out.from).toBeGreaterThanOrEqual(4.53 - 1e-6);
    expect(notes.length).toBe(1);
  });
});

describe("sanitizePlan", () => {
  const raw = EditPlan.parse({
    summary: "test",
    shots: [
      { type: "clip", start: 0, end: 1.11, src: { asset: "clip4", from: 0.05 } },
      { type: "clip", start: 1.2, end: 2.0, src: { asset: "clip4", from: 9.4 } }, // gap + crosses cut at 9.63
      { type: "packshot", start: 2.0, end: 5, headline: "Zamów Depli", chips: ["Bez maszynki"], cta: "Kliknij link poniżej" },
    ],
    overlays: [{ type: "struck_icon", icon: "razor", at: 0.2, strike_at: 0.1, x: 0.5, y: 0.4 }],
    music: { file: null },
  });
  const { plan } = sanitizePlan(raw, [clip4]);

  it("makes shots contiguous and frame-exact", () => {
    expect(plan.shots[0].start).toBe(0);
    for (let i = 1; i < plan.shots.length; i++) expect(plan.shots[i].start).toBeCloseTo(plan.shots[i - 1].end, 6);
    for (const s of plan.shots) expect(Math.abs(s.end * FPS - Math.round(s.end * FPS))).toBeLessThan(1e-6);
  });

  it("keeps every clip range away from internal cuts", () => {
    const s = plan.shots[1];
    if (s.type !== "clip") throw new Error("clip expected");
    const end = s.src.from + (s.end - s.start) * s.src.rate;
    expect(end).toBeLessThanOrEqual(9.63 - 0.1 + 1e-6);
  });

  it("strikes an icon only after it appeared", () => {
    const o = plan.overlays[0];
    if (o.type !== "struck_icon") throw new Error();
    expect(o.strike_at).toBeGreaterThan(o.at);
  });
});

describe("EditPlan tool schema", () => {
  it("converts to a plain JSON schema for Claude", () => {
    const json = toolSchema(EditPlan) as Record<string, unknown>;
    expect(json.type).toBe("object");
  });
});
