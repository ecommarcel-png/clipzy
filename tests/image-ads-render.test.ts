import { describe, expect, it } from "vitest";
import { renderAd } from "@/lib/image-ads/render";
import { FIELDS, StyleSchema, TEMPLATES } from "@/lib/image-ads/templates";

// Minimal text for every layout — the smoke test only checks that each one draws in both formats.
const MIN: Record<string, unknown> = {
  hero_benefits: { headline: "Zażółć gęślą jaźń", benefits: [{ icon: "leaf", text: "Naturalny" }, { icon: "clock", text: "Szybki" }], cta: "Kup teraz", trust: ["Wysyłka 24h"] },
  before_after: { headline: "Przed i po", before_label: "Przed", after_label: "Po", cta: "Kup" },
  callouts: { headline: "Cechy", callouts: ["a", "b", "c"], cta: "Kup" },
  us_vs_them: { headline: "My i oni", ours_label: "My", theirs_label: "Oni", rows: [{ ours: "1", theirs: "2" }, { ours: "3", theirs: "4" }, { ours: "5", theirs: "6" }], cta: "Kup" },
  sticky_notes: { notes: ["Jeden", "Dwa"] },
  whiteboard: { headline: "Boli?", lines: ["a", "b"], banner: "Promocja" },
  handwritten_note: { note: "Krótka notatka" },
  listicle: { headline: "3 znaki", items: ["a", "b", "c"], solution: "Rozwiązanie", cta: "Kup" },
  offer: { headline: "Promocja", offer: "-40%", perks: ["a", "b"], cta: "Kup" },
  testimonial: { quote: "Świetne", author: "Ania", cta: "Kup" },
  problem_solution: { problem_label: "Problem", problem: "Ból", solution_label: "Rozwiązanie", solution: "Ulga", cta: "Kup" },
  question_hook: { question: "Męczysz się?", cta: "Kup" },
};

describe("image ad render", () => {
  it("draws every layout in 1:1 and 9:16", async () => {
    for (const t of TEMPLATES) {
      const fields = FIELDS[t].parse(MIN[t]);
      for (const fmt of ["1x1", "9x16"] as const) {
        const png = await renderAd({ template: t, fields, style: StyleSchema.parse({}), brand: { name: "Marka", logo: null, colors: { primary: "#111111", secondary: "#ffffff", accent: "#ff5a36" } }, photos: [null, null], cutout: null }, fmt);
        expect(png.subarray(1, 4).toString()).toBe("PNG");
      }
    }
  }, 60_000);
});
