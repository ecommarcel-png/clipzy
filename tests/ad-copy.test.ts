import { describe, expect, it } from "vitest";
import { PER_TICK, firstLine, pickItems } from "@/lib/ad-copy/steps";

describe("ad copy steps", () => {
  it("writes what is analysed first, then analyses new creatives, oldest first, within the budget", () => {
    // newest first, as loaded from the database
    const items = [
      { id: "n5", stage: "analyze" as const },
      { id: "n4", stage: "analyze" as const },
      { id: "n3", stage: "write" as const },
      { id: "n2", stage: "analyze" as const },
      { id: "n1", stage: "done" as const },
      { id: "n0", stage: "write" as const },
    ];
    const p = pickItems(items);
    expect(p.write).toEqual(["n0", "n3"]);
    expect(p.analyze).toEqual(["n2", "n4"]);
    expect(p.write.length + p.analyze.length).toBe(PER_TICK);
    expect(p.active).toBe(5);
  });

  it("nothing to do when everything is finished", () => {
    expect(pickItems([{ id: "a", stage: "done" }, { id: "b", stage: "error" }])).toEqual({ write: [], analyze: [], active: 0 });
  });

  it("the hook is the first non-empty line", () => {
    expect(firstLine("\n🔴 Truskawkowe nogi?\n\nTo nie Twoja wina.")).toBe("🔴 Truskawkowe nogi?");
  });
});
