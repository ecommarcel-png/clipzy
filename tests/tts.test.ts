import { afterEach, describe, expect, it, vi } from "vitest";
import { alignmentToWords, resolveVoiceId, TtsError } from "@/lib/ai/tts";
import { getVoice } from "@/lib/voices";

const align = (text: string, step = 0.1) => ({
  characters: [...text],
  character_start_times_seconds: [...text].map((_, i) => i * step),
  character_end_times_seconds: [...text].map((_, i) => (i + 1) * step),
});

describe("alignmentToWords", () => {
  it("turns character timings into words, ignoring repeated spaces", () => {
    const w = alignmentToWords(align("Cześć,  Depli!"));
    expect(w.map((x) => x.text)).toEqual(["Cześć,", "Depli!"]);
    expect(w[0]).toEqual({ text: "Cześć,", start: 0, end: 0.6 });
    expect(w[1].start).toBeCloseTo(0.8);
    expect(w[1].end).toBeCloseTo(1.4);
  });
  it("shifts times by the offset", () => {
    const w = alignmentToWords(align("Wosk? Boli."), 2);
    expect(w[0].start).toBeCloseTo(2);
    expect(w[1].end).toBeCloseTo(3.1);
  });
});

describe("resolveVoiceId", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("finds the voice by name, case-insensitive", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ voices: [{ voice_id: "x1", name: "Adam" }, { voice_id: "lena9", name: "lena suzuki" }] }))));
    expect(await resolveVoiceId("k", "Lena Suzuki")).toBe("lena9");
  });
  it("says clearly when the voice is not in the account", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ voices: [{ voice_id: "x1", name: "Adam" }] }))));
    await expect(resolveVoiceId("k", "Lena Suzuki")).rejects.toThrow("Nie znalazłem głosu „Lena Suzuki” w Twoim koncie ElevenLabs");
  });
  it("maps a rejected key to a Polish message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    await expect(resolveVoiceId("k", "Lena Suzuki")).rejects.toBeInstanceOf(TtsError);
  });
});

describe("voices", () => {
  it("has the test voice with the agreed settings", () => {
    const v = getVoice("test");
    expect(v).toMatchObject({ elevenName: "Lena Suzuki", model: "eleven_multilingual_v2", wordsPerSecond: 2.6 });
    expect(v.settings).toEqual({ speed: 1.1, stability: 0.5, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true });
  });
});
