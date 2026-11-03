import { describe, expect, it } from "vitest";
import { cleanName, defaultFileName, downloadName, filterFiles, formatRatio, type AdFile } from "@/lib/files";

const file = (over: Partial<AdFile>): AdFile => ({
  id: "1", name: "x", path: "p", format: "4x5", variant: null, brandId: "b1", brandName: "Depli", productName: null,
  projectId: null, createdAt: "2026-11-03T00:00:00Z", review: null, url: null, downloadUrl: null, ...over,
});

describe("files", () => {
  it("builds the default name", () => {
    expect(defaultFileName({ brand: "Depli", product: "Krem", format: "4x5", variant: 2 })).toBe("Krem · 4:5 · hook 2");
    expect(defaultFileName({ brand: "Depli", product: null, format: "9x16" })).toBe("Depli · 9:16");
    expect(formatRatio("1x1")).toBe("1:1");
  });

  it("cleans names", () => {
    expect(cleanName("  a   b  ")).toBe("a b");
    expect(cleanName("   ")).toBe("");
    expect(cleanName("x".repeat(100))).toHaveLength(80);
  });

  it("makes safe download names", () => {
    expect(downloadName("Krem · 4:5 · hook 2")).toBe("Krem-4-5-hook-2.mp4");
    expect(downloadName("Żółta łódź / promo 🔥")).toBe("Zolta-lodz-promo.mp4");
    expect(downloadName("")).toBe("reklama.mp4");
    expect(downloadName("ŁOSOŚ", "png")).toBe("LOSOS.png");
  });

  it("filters", () => {
    const files = [file({ id: "1", name: "Żółta łódź" }), file({ id: "2", name: "Krem", format: "9x16", brandId: "b2" })];
    expect(filterFiles(files, { q: "zolta" }).map((f) => f.id)).toEqual(["1"]);
    expect(filterFiles(files, { q: "KREM" }).map((f) => f.id)).toEqual(["2"]);
    expect(filterFiles(files, { brandId: "b2" }).map((f) => f.id)).toEqual(["2"]);
    expect(filterFiles(files, { format: "4x5" }).map((f) => f.id)).toEqual(["1"]);
    expect(filterFiles(files, {})).toHaveLength(2);
  });
});
