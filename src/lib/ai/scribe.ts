import "server-only";
import type { Word } from "@/lib/clips/timeline";

// ElevenLabs Speech-to-Text (Scribe): precise word timings for the voiceover.
export class ScribeError extends Error {}

const MODELS = ["scribe_v2", "scribe_v1"];

export async function transcribe(apiKey: string, data: Buffer, fileName: string, mimeType: string): Promise<{ text: string; words: Word[] }> {
  let lastStatus = 0;
  let lastBody = "";
  for (const model of MODELS) {
    const form = new FormData();
    form.append("model_id", model);
    form.append("language_code", "pol");
    form.append("timestamps_granularity", "word");
    form.append("tag_audio_events", "false");
    form.append("file", new Blob([new Uint8Array(data)], { type: mimeType }), fileName);
    const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: form,
      signal: AbortSignal.timeout(180_000),
    });
    if (res.ok) {
      const json = (await res.json()) as { text?: string; words?: Array<{ text: string; start: number; end: number; type?: string }> };
      const words = (json.words ?? [])
        .filter((w) => (w.type ?? "word") === "word" && w.text.trim())
        .map((w) => ({ text: w.text.trim(), start: Number(w.start), end: Number(w.end) }));
      if (!words.length) throw new ScribeError("Nie rozpoznano mowy w pliku lektora.");
      return { text: json.text ?? words.map((w) => w.text).join(" "), words };
    }
    lastStatus = res.status;
    lastBody = (await res.text()).slice(0, 300);
    if (res.status === 401) throw new ScribeError("Klucz ElevenLabs został odrzucony. Sprawdź go w Ustawieniach.");
    if (res.status === 402 || /quota|credits/i.test(lastBody)) throw new ScribeError("Brak środków na koncie ElevenLabs na transkrypcję.");
    // unknown model → try the next one; other errors stop here
    if (!/model/i.test(lastBody)) break;
  }
  throw new ScribeError(`Transkrypcja lektora nie powiodła się (${lastStatus}). ${lastBody}`);
}
