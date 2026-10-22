import { describe, expect, it, vi } from "vitest";
import { controlLoop } from "@/lib/ai/control";
import type { Review, ReviewIssue } from "@/lib/ai/review";

const issue = (severity: ReviewIssue["severity"], field = "social_proof"): ReviewIssue => ({
  field,
  severity,
  problem: "p",
  fix: "f",
});
const review = (issues: ReviewIssue[]): Review => ({ verdict: issues.length ? "do_poprawy" : "ok", issues, checked: ["a", "b"] });

describe("controlLoop", () => {
  it("accepts a clean draft after one review, without a correction round", async () => {
    const revise = vi.fn();
    const { result, report } = await controlLoop({ draft: "v1", review: async () => review([]), revise });
    expect(result).toBe("v1");
    expect(revise).not.toHaveBeenCalled();
    expect(report.rounds).toBe(1);
    expect(report.remaining).toEqual([]);
  });

  it("does not spend a correction round on minor issues only", async () => {
    const revise = vi.fn();
    const { result, report } = await controlLoop({ draft: "v1", review: async () => review([issue("drobna")]), revise });
    expect(result).toBe("v1");
    expect(revise).not.toHaveBeenCalled();
    expect(report.remaining).toHaveLength(1);
  });

  it("fixes serious issues, then re-checks the corrected version", async () => {
    const reviewFn = vi.fn().mockResolvedValueOnce(review([issue("krytyczna"), issue("ważna", "mechanism")])).mockResolvedValueOnce(review([]));
    const revise = vi.fn(async (_d: string, issues: ReviewIssue[]) => `v2(${issues.length})`);
    const { result, report } = await controlLoop({ draft: "v1", review: reviewFn, revise });
    expect(revise).toHaveBeenCalledWith("v1", expect.arrayContaining([expect.objectContaining({ severity: "krytyczna" })]));
    expect(reviewFn).toHaveBeenLastCalledWith("v2(2)");
    expect(result).toBe("v2(2)");
    expect(report.rounds).toBe(2);
    expect(report.first_issues).toHaveLength(2);
    expect(report.remaining).toEqual([]);
  });

  it("reports what the final check still finds", async () => {
    const reviewFn = vi.fn().mockResolvedValueOnce(review([issue("krytyczna")])).mockResolvedValueOnce(review([issue("ważna")]));
    const { report } = await controlLoop({ draft: 1, review: reviewFn, revise: async () => 2 });
    expect(report.remaining).toEqual([issue("ważna")]);
  });

  it("keeps the draft when the review itself fails", async () => {
    const { result, report } = await controlLoop({
      draft: "v1",
      review: async () => {
        throw new Error("timeout");
      },
      revise: vi.fn(),
    });
    expect(result).toBe("v1");
    expect(report.rounds).toBe(0);
    expect(report.error).toMatch(/timeout/);
  });

  it("keeps the draft when the correction fails", async () => {
    const { result, report } = await controlLoop({
      draft: "v1",
      review: async () => review([issue("krytyczna")]),
      revise: async () => {
        throw new Error("boom");
      },
    });
    expect(result).toBe("v1");
    expect(report.remaining).toHaveLength(1);
    expect(report.error).toMatch(/boom/);
  });

  it("skips the final check when out of time but keeps the correction", async () => {
    const reviewFn = vi.fn().mockResolvedValue(review([issue("krytyczna")]));
    const { result, report } = await controlLoop({ draft: "v1", review: reviewFn, revise: async () => "v2", hasTimeFor: () => false });
    expect(result).toBe("v2");
    expect(reviewFn).toHaveBeenCalledTimes(1);
    expect(report.error).toMatch(/ponown/);
  });
});
