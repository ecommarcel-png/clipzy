import { describe, expect, it } from "vitest";
import { tick } from "@/lib/text-remover/steps";

describe("text remover tick", () => {
  it("polls every running film and does at most two heavy steps, finishing films first", () => {
    const t = tick([
      { id: "new2", stage: "detect" }, { id: "new1", stage: "detect" },
      { id: "r1", stage: "running" }, { id: "r2", stage: "running" },
      { id: "c1", stage: "compose" }, { id: "d", stage: "done" }, { id: "e", stage: "error" },
    ]);
    expect(t.compose).toEqual(["c1"]);
    expect(t.detect).toEqual(["new1"]);
    expect(t.poll).toEqual(["r1", "r2"]);
    expect(t.active).toBe(5);
    expect(t.onlyWaiting).toBe(false);
  });
  it("says when it only waits for fal", () => {
    const t = tick([{ id: "r", stage: "running" }, { id: "d", stage: "done" }]);
    expect(t.onlyWaiting).toBe(true);
    expect(tick([{ id: "d", stage: "done" }]).active).toBe(0);
  });
});
