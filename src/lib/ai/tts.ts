import "server-only";
import type { Word } from "@/lib/clips/timeline";
import type { Voice } from "@/lib/voices";

// ElevenLabs Text-to-Speech with character timings: the voiceover and its
// word timestamps in one call, so generated voiceovers need no transcription.
export class TtsError extends Error {}

const API = "https://api.elevenlabs.io/v1";

type Alignment = { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] };

export function alignmentToWords(a: Alignment, offset = 0): Word[] {
  const words: Word[] = [];
  let cur: { text: string; start: number; end: number } | null = null;
  a.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      if (cur) words.push(cur);
      cur = null;
      return;
    }
    const start = a.character_start_times_seconds[i] + offset;
    const end = a.character_end_times_seconds[i] + offset;
    if (!cur) cur = { text: ch, start, end };
    else {
      cur.text += ch;
      cur.end = end;
    }
  });
  if (cur) words.push(cur);
  return words.map((w) => ({ text: w.text, start: Math.round(w.start * 1000) / 1000, end: Math.round(w.end * 1000) / 1000 }));
}

async function fail(res: Response, what: string): Promise<never> {
  const raw = (await res.text().catch(() => "")).slice(0, 600);
  // ElevenLabs says why: {"detail":{"status":"…","message":"…"}} or {"detail":"…"}
  let status = "";
  let message = raw.slice(0, 200);
  try {
    const d = (JSON.parse(raw) as { detail?: { status?: string; message?: string } | string }).detail;
    if (typeof d === "string") message = d;
    else if (d) {
      status = d.status ?? "";
      message = d.message ?? message;
    }
  } catch {
    // not JSON — keep the raw text
  }
  if (res.status === 401) throw new TtsError("Klucz ElevenLabs został odrzucony. Sprawdź go w Ustawieniach.");
  if (/library|paid_plan|subscription|upgrade/i.test(`${status} ${message}`)) {
    throw new TtsError(`ElevenLabs: ten głos pochodzi z Voice Library — przez API działa tylko na płatnym planie ElevenLabs (od Starter). Odpowiedź: „${message}”`);
  }
  throw new TtsError(`ElevenLabs: ${what} nie powiodło się (${res.status}${status ? `, ${status}` : ""}). ${message}`.trim());
}

export async function resolveVoiceId(apiKey: string, elevenName: string): Promise<string> {
  const res = await fetch(`${API}/voices`, { headers: { "xi-api-key": apiKey }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) await fail(res, "pobranie listy głosów");
  const json = (await res.json()) as { voices?: Array<{ voice_id: string; name: string }> };
  const want = elevenName.trim().toLowerCase();
  const hit = (json.voices ?? []).find((v) => v.name.trim().toLowerCase() === want) ?? (json.voices ?? []).find((v) => v.name.trim().toLowerCase().startsWith(want));
  if (!hit) throw new TtsError(`Nie znalazłem głosu „${elevenName}” w Twoim koncie ElevenLabs. Dodaj go w ElevenLabs (Voices) albo wybierz inny głos.`);
  return hit.voice_id;
}

export async function synthesize(
  apiKey: string,
  voice: Voice,
  voiceId: string,
  text: string,
  ctx: { previous?: string; next?: string } = {},
): Promise<{ audio: Buffer; words: Word[]; duration: number }> {
  if (!text.trim()) throw new TtsError("Pusty tekst lektora.");
  const res = await fetch(`${API}/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: voice.model,
      voice_settings: voice.settings,
      ...(ctx.previous ? { previous_text: ctx.previous } : {}),
      ...(ctx.next ? { next_text: ctx.next } : {}),
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) await fail(res, "generowanie lektora");
  const json = (await res.json()) as { audio_base64?: string; alignment?: Alignment | null; normalized_alignment?: Alignment | null };
  if (!json.audio_base64) throw new TtsError("ElevenLabs nie zwrócił nagrania.");
  const align = json.alignment ?? json.normalized_alignment;
  const words = align ? alignmentToWords(align) : [];
  const duration = align?.character_end_times_seconds.at(-1) ?? 0;
  return { audio: Buffer.from(json.audio_base64, "base64"), words, duration };
}
