import { describe, expect, it } from "vitest";
import { contrast, inkOn, isHex, readableAccent, shade } from "@/lib/image-ads/colors";

describe("ad colours", () => {
  it("picks readable text", () => {
    expect(inkOn("#ffffff")).toBe("#111111");
    expect(inkOn("#14111a")).toBe("#ffffff");
    expect(inkOn("#ff5a36")).toBe("#111111");
  });
  it("shades", () => {
    expect(shade("#000000", 1)).toBe("#ffffff");
    expect(shade("#ffffff", -0.5)).toBe("#808080");
  });
  it("keeps the accent readable on the background", () => {
    const sage = readableAccent("#a8c3b0", "#ffffff");
    expect(contrast(sage, "#ffffff")).toBeGreaterThanOrEqual(3);
    expect(readableAccent("#ff5a36", "#14111a")).toBe("#ff5a36");
  });
  it("validates hex", () => {
    expect(isHex("#a1b2c3")).toBe(true);
    expect(isHex("red")).toBe(false);
  });
});
