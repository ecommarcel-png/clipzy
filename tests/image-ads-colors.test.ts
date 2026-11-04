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

import { brandPalette, isSaleRed } from "@/lib/image-ads/colors";

describe("brand palette", () => {
  it("puts logo colours first and drops sale reds from the shop", () => {
    expect(isSaleRed("#e5312b")).toBe(true);
    expect(isSaleRed("#7e9a86")).toBe(false);
    expect(brandPalette({ accent: "#e5312b", primary: "#2f3a33", secondary: "#ffffff" }, ["#7e9a86"])).toEqual(["#7e9a86", "#2f3a33"]);
  });
  it("keeps red when the logo is red", () => {
    expect(brandPalette({ accent: "#e5312b" }, ["#d62828"])).toEqual(["#d62828"]);
  });
  it("has a fallback", () => {
    expect(brandPalette({}, [])).toEqual(["#ff5a36"]);
  });
});
