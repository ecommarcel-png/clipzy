import { describe, expect, it } from "vitest";
import { nextStep, type PipelineState } from "@/lib/clips/steps";

const base: PipelineState = {
  assets: [],
  voiceover: "none",
  generated: "done",
  generating: false,
  hasPlan: false,
};
const clip = (id: string, status: string) => ({ id, kind: "clip" as const, status });

describe("nextStep", () => {
  it("analyses waiting clips in one batch (max 3), never an empty batch", () => {
    const s = { ...base, assets: [clip("a", "uploaded"), clip("b", "analyzing"), clip("c", "uploaded"), clip("d", "uploaded"), clip("e", "ready")] };
    expect(nextStep(s)).toEqual({ kind: "analyze", ids: ["a", "b", "c"] });
    const done = { ...s, assets: s.assets.map((a) => ({ ...a, status: "ready" })) };
    expect(nextStep(done)).toEqual({ kind: "plan" });
  });

  it("skips clips that already failed", () => {
    const s = { ...base, assets: [clip("a", "error"), clip("b", "ready")] };
    expect(nextStep(s)).toEqual({ kind: "plan" });
  });

  it("goes voiceover → missing shots → wait for generations → plan → done", () => {
    const ready = [clip("a", "ready")];
    expect(nextStep({ ...base, assets: ready, voiceover: "pending" })).toEqual({ kind: "voiceover" });
    expect(nextStep({ ...base, assets: ready, voiceover: "done", generated: undefined })).toEqual({ kind: "missing" });
    expect(nextStep({ ...base, assets: ready, voiceover: "done", generating: true })).toEqual({ kind: "poll" });
    expect(nextStep({ ...base, assets: ready, voiceover: "done" })).toEqual({ kind: "plan" });
    expect(nextStep({ ...base, assets: ready, voiceover: "done", hasPlan: true })).toEqual({ kind: "done" });
  });

  it("a failed voiceover does not block the edit", () => {
    expect(nextStep({ ...base, assets: [clip("a", "ready")], voiceover: "error" })).toEqual({ kind: "plan" });
  });

  it("finished generated shots get analysed like uploads", () => {
    const s = { ...base, assets: [clip("a", "ready"), { id: "g", kind: "generated" as const, status: "uploaded" }] };
    expect(nextStep(s)).toEqual({ kind: "analyze", ids: ["g"] });
  });
});
