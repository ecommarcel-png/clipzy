import { describe, expect, it } from "vitest";
import { captionChunks, tighten, toPhrases, type Word } from "@/lib/clips/timeline";

// Words roughly as ElevenLabs returns them for the Depli voiceover (with long pauses).
const W = (text: string, start: number, end: number): Word => ({ text, start, end });
const words: Word[] = [
  W("Zobacz,", 0.0, 0.35), W("jak", 0.4, 0.55), W("włoski", 0.6, 1.0), W("po", 1.05, 1.2), W("prostu", 1.25, 1.6), W("znikają.", 1.65, 1.95),
  W("Bez", 2.52, 2.75), W("maszynki.", 2.8, 3.14),
  W("Maszynka?", 4.14, 4.58),
  W("Wosk?", 8.93, 9.3),
  W("Boli.", 10.03, 10.38),
  W("Depli", 11.05, 11.4), W("działa", 11.45, 11.7), W("inaczej.", 11.75, 12.01),
];

describe("toPhrases", () => {
  it("splits at punctuation", () => {
    expect(toPhrases(words).map((p) => p.text)).toEqual([
      "Zobacz,", "jak włoski po prostu znikają.", "Bez maszynki.", "Maszynka?", "Wosk?", "Boli.", "Depli działa inaczej.",
    ]);
  });
});

describe("tighten", () => {
  const tl = tighten(words, 12.5);

  it("removes long pauses between sentences", () => {
    expect(tl.duration).toBeLessThan(8);
    expect(tl.original).toBe(12.5);
    for (let i = 1; i < tl.phrases.length; i++) {
      const gap = tl.phrases[i].start - tl.phrases[i - 1].end;
      expect(gap).toBeLessThan(0.45);
    }
  });

  it("keeps comma pauses natural (no cut inside a sentence)", () => {
    // "Zobacz," and "jak…" are 0.05 s apart in the source → same audio segment
    expect(tl.segments[0].srcStart).toBe(0);
    expect(tl.segments[0].srcEnd).toBeGreaterThan(1.95);
  });

  it("maps every word to the output timeline in order", () => {
    for (let i = 1; i < tl.words.length; i++) expect(tl.words[i].start).toBeGreaterThanOrEqual(tl.words[i - 1].end - 0.001);
    expect(tl.words.at(-1)!.end).toBeLessThanOrEqual(tl.duration);
  });

  it("segments never overlap on the output timeline", () => {
    for (let i = 1; i < tl.segments.length; i++) {
      const prev = tl.segments[i - 1];
      expect(tl.segments[i].outStart).toBeGreaterThanOrEqual(prev.outStart + (prev.srcEnd - prev.srcStart));
    }
  });
});

describe("captionChunks", () => {
  const chunks = captionChunks(tighten(words, 12.5).phrases);

  it("never shows single words when neighbours can be merged", () => {
    expect(chunks.map((c) => c.text)).toContain("Wosk? Boli.");
    expect(chunks[0].text).toBe("Zobacz, jak włoski po prostu znikają.");
    expect(chunks.map((c) => c.text)).not.toContain("Bez maszynki. Maszynka?");
  });

  it("keeps chunks between 1 and 6 words and in time order", () => {
    for (const c of chunks) expect(c.text.split(" ").length).toBeLessThanOrEqual(6);
    for (let i = 1; i < chunks.length; i++) expect(chunks[i].start).toBeGreaterThanOrEqual(chunks[i - 1].start);
  });

  it("splits a long phrase into balanced chunks", () => {
    const long = toPhrases([
      W("Kryształowa", 0, 0.5), W("powierzchnia", 0.5, 1), W("ściera", 1, 1.3), W("włoski", 1.3, 1.6),
      W("przy", 1.6, 1.8), W("samej", 1.8, 2), W("skórze,", 2, 2.4),
    ]);
    expect(captionChunks(long).map((c) => c.text)).toEqual(["Kryształowa powierzchnia ściera włoski", "przy samej skórze,"]);
  });
});
