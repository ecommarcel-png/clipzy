import { describe, expect, it } from "vitest";
import { activeHooks, hookEndBetween, uploadHookEnd, variantWords } from "@/lib/clips/voice-variants";
import type { Phrase } from "@/lib/clips/timeline";

const W = (text: string, start: number, end: number) => ({ text, start, end });

describe("variantWords", () => {
  it("puts the shared rest after the hook plus the gap", () => {
    const words = variantWords({ words: [W("Wosk?", 0, 0.4), W("Boli.", 0.5, 0.9)], duration: 1.05 }, { words: [W("Depli", 0.02, 0.4), W("działa", 0.45, 0.8)] });
    expect(words.map((w) => w.text)).toEqual(["Wosk?", "Boli.", "Depli", "działa"]);
    expect(words[2].start).toBeCloseTo(1.05 + 0.15 + 0.02);
    expect(words[3].end).toBeCloseTo(1.2 + 0.8);
  });
});

describe("activeHooks", () => {
  it("skips empty hooks and trims", () => {
    expect(activeHooks([{ text: " A " }, { text: "" }, { text: "   " }, { text: "B" }])).toEqual(["A", "B"]);
  });
});

describe("uploadHookEnd", () => {
  const P = (text: string, start: number, end: number): Phrase => ({ text, start, end, words: [W(text, start, end)] });
  it("ends the hook at the first phrase boundary after 1.2 s", () => {
    expect(uploadHookEnd([P("Zobacz,", 0, 0.4), P("jak znikają.", 0.45, 1.9), P("Bez maszynki.", 2.2, 2.8)])).toBeCloseTo(1.9);
  });
  it("cuts at 3.0 s when no phrase boundary falls between 1.2 and 3.5 s", () => {
    expect(uploadHookEnd([P("Krótko.", 0, 0.8), P("Bardzo długie zdanie hooka.", 0.9, 4.2)])).toBeCloseTo(3.0);
  });
});

describe("hookEndBetween", () => {
  it("cuts halfway between the last hook word and the first word of the rest", () => {
    expect(hookEndBetween(1.6, 1.8)).toBeCloseTo(1.7);
  });
});
