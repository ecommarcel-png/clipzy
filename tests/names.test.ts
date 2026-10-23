import { describe, expect, it } from "vitest";
import { fixBrandName } from "@/lib/clips/names";

describe("fixBrandName", () => {
  it("fixes how speech-to-text spelled the brand", () => {
    expect(fixBrandName("Zamów Depily", "Depli")).toBe("Zamów Depli");
    expect(fixBrandName("Depily działa inaczej.", "Depli")).toBe("Depli działa inaczej.");
    expect(fixBrandName("depli, kryształ", "Depli")).toBe("Depli, kryształ");
    expect(fixBrandName("Zamów Deply!", "Depli")).toBe("Zamów Depli!");
  });
  it("leaves ordinary Polish words alone", () => {
    const t = "Depilator działa delikatnie, depilacja bez bólu. Dalej: dekle, deski.";
    expect(fixBrandName(t, "Depli")).toBe(t);
  });
  it("works with multi-word and short brand names safely", () => {
    expect(fixBrandName("Kup w Glow Labs", "Glow Lab")).toBe("Kup w Glow Labs");
    expect(fixBrandName("To jest Ola", "Ole")).toBe("To jest Ola");
  });
});
