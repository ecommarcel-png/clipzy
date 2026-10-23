import { describe, expect, it } from "vitest";
import { EditPlan } from "@/lib/clips/plan";
import { composeVariant, decomposeVariant } from "@/lib/clips/variants";

const c = (start: number, end: number, asset: string, from = 0) => ({ type: "clip", start, end, src: { asset, from } });
// version 1: hook 0–1.5, shared rest 1.5–6 (packshot 4.5–6)
const plan = EditPlan.parse({
  summary: "t",
  shots: [c(0, 1.5, "a"), c(1.5, 3, "b"), c(3, 4.5, "c"), { type: "packshot", start: 4.5, end: 6, headline: "Zamów", chips: [], cta: "Kliknij" }],
  overlays: [{ type: "logo", at: 0.1, until: 1.4 }, { type: "wipe", at: 3 }],
  sfx: [{ file: "/biblioteka/sfx/pop-1.mp3", at: 0.2 }, { file: "/biblioteka/sfx/whoosh-1.mp3", at: 3 }],
  music: { file: null },
  hooks: [
    { shots: [c(0, 1, "d"), c(1, 2.1, "e")], overlays: [{ type: "sparkles", at: 0.5 }], sfx: [{ file: "/biblioteka/sfx/ding-1.mp3", at: 0.4 }] },
  ],
});
const ends = [1.5, 2.1];

describe("composeVariant", () => {
  it("version 1 is the plan itself", () => {
    expect(composeVariant(plan, 1, ends).shots).toEqual(plan.shots);
  });
  it("version 2: its own hook, then the shared rest shifted by the longer hook", () => {
    const v = composeVariant(plan, 2, ends);
    expect(v.shots.map((s) => [s.start, s.end])).toEqual([[0, 1], [1, 2.1], [2.1, 3.6], [3.6, 5.1], [5.1, 6.6]]);
    expect(v.shots[0].type === "clip" && v.shots[0].src.asset).toBe("d");
    expect(v.overlays.map((o) => [o.type, o.at])).toEqual([["sparkles", 0.5], ["wipe", 3.6]]);
    expect(v.sfx.map((x) => [x.file.split("/").pop(), x.at])).toEqual([["ding-1.mp3", 0.4], ["whoosh-1.mp3", 3.6]]);
    expect(v.hooks).toEqual([]);
  });
  it("a version without its own hook falls back to version 1", () => {
    expect(composeVariant(plan, 4, [...ends, 1.8, 1.9]).shots).toEqual(plan.shots);
  });
});

describe("decomposeVariant", () => {
  it("round-trips an untouched version", () => {
    const back = decomposeVariant(composeVariant(plan, 2, ends), plan, 2, ends);
    expect(back.shots).toEqual(plan.shots);
    expect(back.hooks[0].shots).toEqual(plan.hooks[0].shots);
    expect(back.overlays).toEqual(plan.overlays);
  });
  it("keeps the hook/rest boundary fixed when a cut was moved across it", () => {
    const v = composeVariant(plan, 2, ends);
    v.shots[1].end = 2.6;
    v.shots[2].start = 2.6;
    const back = decomposeVariant(v, plan, 2, ends);
    expect(back.hooks[0].shots.at(-1)!.end).toBeCloseTo(2.1);
    expect(back.shots[1].start).toBeCloseTo(1.5);
  });
  it("edits in the shared rest of version 2 reach version 1", () => {
    const v = composeVariant(plan, 2, ends);
    (v.shots[4] as { headline: string }).headline = "Zamów Depli";
    const back = decomposeVariant(v, plan, 2, ends);
    expect((back.shots[3] as { headline: string }).headline).toBe("Zamów Depli");
  });
});
