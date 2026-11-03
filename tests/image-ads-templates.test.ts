import { describe, expect, it } from "vitest";
import { TEMPLATES, TEMPLATE_INFO, FIELDS, clip, fitFont, parseFields, photoSlots, usesCutout } from "@/lib/image-ads/templates";

describe("image ad templates", () => {
  it("has info and fields for every layout", () => {
    expect(TEMPLATES).toHaveLength(12);
    for (const t of TEMPLATES) {
      expect(TEMPLATE_INFO[t]).toBeTruthy();
      expect(FIELDS[t]).toBeTruthy();
    }
    expect(photoSlots("before_after")).toBe(2);
    expect(photoSlots("callouts")).toBe(0);
    expect(usesCutout("us_vs_them")).toBe(true);
  });

  it("cuts long text at a word instead of rejecting it", () => {
    expect(clip("Usuwa każdy smród z auta w piętnaście minut bez chemii", 30)).toBe("Usuwa każdy smród z auta w");
    expect(clip("  krótki   tekst ", 30)).toBe("krótki tekst");
  });

  it("parses agent output: unknown icons become check, extra items are dropped", () => {
    const f = parseFields("hero_benefits", {
      headline: "Usuwa każdy smród z auta",
      benefits: [{ icon: "rocket", text: "a" }, { icon: "leaf", text: "b" }, { icon: "clock", text: "c" }, { icon: "bolt", text: "d" }, { icon: "gift", text: "e" }],
      cta: "Kup teraz",
    });
    expect(f?.benefits.map((b) => b.icon)).toEqual(["check", "leaf", "clock", "bolt"]);
    expect(f?.eyebrow).toBe("");
    expect(f?.trust).toEqual([]);
  });

  it("rejects output that misses required text", () => {
    expect(parseFields("hero_benefits", { headline: "x" })).toBeNull();
    expect(parseFields("us_vs_them", { headline: "x", ours_label: "a", theirs_label: "b", rows: [{ ours: "1", theirs: "2" }], cta: "c" })).toBeNull();
  });

  it("picks a smaller font for longer headlines", () => {
    const short = fitFont("Zero smrodu", { font: "anton", width: 900, lines: 2, max: 160, min: 60, upper: true });
    const long = fitFont("Usuwa każdy smród z auta w piętnaście minut", { font: "anton", width: 900, lines: 2, max: 160, min: 60, upper: true });
    expect(short).toBe(160);
    expect(long).toBeLessThan(short);
    expect(long).toBeGreaterThanOrEqual(60);
  });
});
