import { describe, expect, it } from "vitest";
import { applyReview, type ImageAdRow } from "@/lib/image-ads/pipeline";
import { StyleSchema } from "@/lib/image-ads/templates";

const ad = (): ImageAdRow => ({
  id: "a", set_id: "s", idx: 0, stage: "review", template: "question_hook", concept: { template: "question_hook", angle: "", persona: "", awareness: "", visual: "", idea: "" },
  copy: { primary_text: "Tekst", headline: "Nagłówek", description: "Opis" },
  fields: { question: "Męczysz się w ciemności?", sub: "", cta: "Kup" }, style: StyleSchema.parse({}),
  photos: [{ prompt: "p", with_product: true, state: "done", path: "x.jpg" }], renders: {}, review: null, round: 0, error: null, created_at: "", updated_at: "",
});

describe("Kontroler fixes", () => {
  it("good creative goes straight to done", () => {
    const p = applyReview(ad(), { score: 9, issues: [], fields_patch: { cta: "Zamów" } });
    expect(p.stage).toBe("done");
    expect(p.review?.final?.score).toBe(9);
  });
  it("applies text and style fixes and re-renders", () => {
    const p = applyReview(ad(), { score: 6, issues: ["za długi"], fields_patch: { question: "Ciemno?" }, style_patch: { theme: "dark" } });
    expect(p.stage).toBe("render");
    expect((p.fields as { question: string }).question).toBe("Ciemno?");
    expect(p.style?.theme).toBe("dark");
    expect(p.round).toBe(1);
  });
  it("ignores a patch that would break the layout", () => {
    const p = applyReview(ad(), { score: 5, issues: [], fields_patch: { question: 42 } });
    expect((p.fields as { question: string }).question).toBe("Męczysz się w ciemności?");
  });
  it("asks fal for a new photo when the picture is wrong", () => {
    const p = applyReview(ad(), { score: 4, issues: ["zły produkt"], photo_redo: [{ slot: 0, prompt: "new", with_product: true }] });
    expect(p.stage).toBe("photos");
    expect(p.photos?.[0]).toMatchObject({ prompt: "new", state: "pending" });
  });
});

import { isAccountError } from "@/lib/image-ads/pipeline";
import { FalError } from "@/lib/ai/fal";

describe("fal account errors", () => {
  it("stop the set only for key / balance problems", () => {
    expect(isAccountError(new FalError("Brak środków na koncie fal.ai."))).toBe(true);
    expect(isAccountError(new FalError("Klucz fal.ai został odrzucony albo nie ma uprawnień do generowania."))).toBe(true);
    expect(isAccountError(new FalError("fal.ai (422): prompt blocked"))).toBe(false);
    expect(isAccountError(new Error("Brak środków"))).toBe(false);
  });
});
