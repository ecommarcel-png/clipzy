import { describe, expect, it } from "vitest";
import { nextStep, type AdState, type SetState } from "@/lib/image-ads/steps";

const ad = (id: string, stage: AdState["stage"], photos: AdState["photos"] = []): AdState => ({ id, stage, photos });
const set = (ads: AdState[], over: Partial<SetState> = {}): SetState => ({ hasAds: ads.length > 0, ads, pollDue: false, ...over });

describe("image ads steps", () => {
  it("starts with the Strateg", () => {
    expect(nextStep(set([]))).toEqual({ kind: "strategy" });
  });

  it("writes copy in batches of 5, then designs", () => {
    const ads = Array.from({ length: 7 }, (_, i) => ad(`a${i}`, "copy"));
    expect(nextStep(set(ads))).toEqual({ kind: "copy", ids: ["a0", "a1", "a2", "a3", "a4"] });
    expect(nextStep(set([ad("a", "design"), ad("b", "copy")]))).toEqual({ kind: "copy", ids: ["b"] });
    expect(nextStep(set([ad("a", "design")]))).toEqual({ kind: "design", ids: ["a"] });
  });

  it("submits pending photos in batches of 6", () => {
    const ads = Array.from({ length: 8 }, (_, i) => ad(`a${i}`, "photos", ["pending"]));
    expect(nextStep(set(ads))).toEqual({ kind: "submit", ids: ["a0", "a1", "a2", "a3", "a4", "a5"] });
  });

  it("renders ready ads while photos are still running, polls when due", () => {
    const s = set([ad("p", "photos", ["submitted"]), ad("r", "render")]);
    expect(nextStep(s)).toEqual({ kind: "render", ids: ["r"] });
    expect(nextStep({ ...s, pollDue: true })).toEqual({ kind: "poll", ids: ["p"], wait: false });
    expect(nextStep(set([ad("p", "photos", ["done", "submitted"])]))).toEqual({ kind: "poll", ids: ["p"], wait: true });
  });

  it("reviews, fixes, then checks the result once more", () => {
    expect(nextStep(set([ad("a", "review"), ad("b", "review"), ad("c", "review"), ad("d", "review")]))).toEqual({ kind: "review", ids: ["a", "b", "c"] });
    expect(nextStep(set([ad("a", "fix")]))).toEqual({ kind: "fix", ids: ["a"] });
    expect(nextStep(set([ad("a", "final")]))).toEqual({ kind: "final", ids: ["a"] });
  });

  it("skips errors and finishes", () => {
    expect(nextStep(set([ad("a", "done"), ad("b", "error")]))).toEqual({ kind: "done" });
  });

  it("does earlier stages first", () => {
    expect(nextStep(set([ad("a", "final"), ad("b", "copy")]))).toEqual({ kind: "copy", ids: ["b"] });
  });

  it("polls a creative whose before photo waits for the after photo", () => {
    expect(nextStep(set([ad("b", "photos", ["waiting", "submitted"])]))).toEqual({ kind: "poll", ids: ["b"], wait: true });
    expect(nextStep(set([ad("b", "photos", ["waiting", "done"])]))).toEqual({ kind: "poll", ids: ["b"], wait: true });
    expect(nextStep(set([ad("b", "photos", ["pending", "done"])]))).toEqual({ kind: "submit", ids: ["b"] });
  });
});
