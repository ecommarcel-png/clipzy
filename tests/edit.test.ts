import { describe, expect, it } from "vitest";
import { EditPlan, sanitizePlan, type AssetInfo } from "@/lib/clips/plan";
import { editCaptions, nextFragment, normalizeMix, removeShot, resizeShot, setPackshot, swapSource } from "@/lib/clips/edit";

const assets: AssetInfo[] = [
  { id: "a", duration: 10, cuts: [4] },
  { id: "b", duration: 6, cuts: [] },
];

const base = sanitizePlan(
  EditPlan.parse({
    summary: "t",
    shots: [
      { type: "clip", start: 0, end: 2, src: { asset: "a", from: 0 } },
      { type: "clip", start: 2, end: 4, src: { asset: "b", from: 0 } },
      { type: "split", start: 4, end: 6, top: { asset: "a", from: 5 }, top_label: "Przed", bottom: { asset: "b", from: 1 }, bottom_label: "Po" },
      { type: "packshot", start: 6, end: 8, headline: "Zamów", chips: ["Bez bólu"], cta: "Kliknij" },
    ],
    overlays: [
      { type: "struck_icon", icon: "razor", at: 2.2, strike_at: 2.8, x: 0.5, y: 0.4 },
      { type: "wipe", at: 2.1 },
    ],
    music: { file: null },
  }),
  assets,
).plan;

const total = (p: EditPlan) => p.shots.at(-1)!.end;

describe("quick edits", () => {
  it("removing a shot keeps the length and drops its pop-ups", () => {
    const p = removeShot(base, 1);
    expect(p.shots).toHaveLength(3);
    expect(total(p)).toBe(total(base));
    expect(p.shots[0].end).toBe(4);
    expect(p.overlays.map((o) => o.type)).toEqual(["wipe"]);
  });

  it("never removes the packshot or goes below 3 shots", () => {
    expect(removeShot(base, 3)).toBe(base);
    expect(removeShot(removeShot(base, 1), 0).shots).toHaveLength(3);
  });

  it("resizing moves one cut and keeps the length; icons follow the cut", () => {
    const p = resizeShot(base, 1, 0.5);
    expect(p.shots[1].end).toBe(4.5);
    expect(p.shots[2].start).toBe(4.5);
    expect(total(p)).toBe(total(base));
    const icon = p.overlays.find((o) => o.type === "struck_icon") as { until: number };
    expect(icon.until).toBe(4.5);
    const last = resizeShot(base, 3, 0.5);
    expect(last.shots[3].start).toBe(5.5);
    expect(resizeShot(base, 0, -5).shots[0].end).toBeCloseTo(0.4);
  });

  it("swapping a source and taking another fragment stays clear of cuts after sanitizing", () => {
    let p = swapSource(base, 0, "b", assets);
    expect(p.shots[0].type === "clip" && p.shots[0].src.asset).toBe("b");
    p = nextFragment(swapSource(base, 1, "a", assets), 1, assets);
    const s = sanitizePlan(p, assets).plan.shots[1];
    if (s.type !== "clip") throw new Error();
    const end = s.src.from + (s.end - s.start) * s.src.rate;
    expect(s.src.from >= 4.1 || end <= 3.9).toBe(true);
    const split = swapSource(base, 2, "b", assets, "top").shots[2];
    expect(split.type === "split" && split.top.asset).toBe("b");
  });

  it("packshot texts, captions and mix are cleaned", () => {
    const p = setPackshot(base, 3, { headline: "Zamów Depli", chips: ["A", " ", "B", "C", "D"], cta: "x".repeat(50) });
    const s = p.shots[3];
    if (s.type !== "packshot") throw new Error();
    expect(s.chips).toEqual(["A", "B", "C"]);
    expect(s.cta).toHaveLength(32);
    const caps = editCaptions([{ text: "Masznka", start: 0, end: 1 }, { text: "b", start: 1, end: 2 }], ["  Maszynka  ", ""]);
    expect(caps).toEqual([{ text: "Maszynka", start: 0, end: 1 }, { text: "b", start: 1, end: 2 }]);
    expect(normalizeMix({ vo: 3, music: -1 })).toEqual({ vo: 1, music: 0, sfx: 1 });
  });
});
