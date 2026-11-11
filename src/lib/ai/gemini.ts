import "server-only";
import { GoogleGenAI, createPartFromUri } from "@google/genai";
import { z } from "zod";

// Gemini watches and listens to video — an executor. Its output is material
// for the Reżyser to check, not a fact (knowledge/rezyser/SKILL.md).
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3-flash-preview";

export class GeminiError extends Error {}

const Segment = z.object({
  start: z.coerce.number(),
  end: z.coerce.number(),
  shows: z.string(),
  product_visible: z.coerce.boolean().default(false),
  skin_or_hair_visible: z.coerce.boolean().default(false),
  who: z.string().default(""),
  sharpness: z.coerce.number().default(3),
  use_for: z.array(z.string()).default([]),
  hook_score: z.coerce.number().default(5),
  focus: z
    .array(z.object({ x: z.coerce.number(), y: z.coerce.number(), what: z.string() }))
    .default([])
    .describe("punkty w kadrze (0–1) wskazujące problem/efekt"),
});

export const ClipAnalysis = z.object({
  summary: z.string(),
  product_look: z.string().default(""),
  overlays_text: z.array(z.string()).default([]),
  audio: z.string().default(""),
  text_mirrored: z.coerce.boolean().default(false),
  ai_artifacts: z.array(z.string()).default([]),
  segments: z.array(Segment).default([]),
});
export type ClipAnalysis = z.infer<typeof ClipAnalysis>;

function client(apiKey: string) {
  return new GoogleGenAI({ apiKey });
}

function friendly(e: unknown): GeminiError {
  const msg = e instanceof Error ? e.message : String(e);
  if (/API key|PERMISSION_DENIED|401|403/i.test(msg)) return new GeminiError("Klucz Gemini został odrzucony. Sprawdź go w Ustawieniach.");
  if (/429|RESOURCE_EXHAUSTED|quota/i.test(msg)) return new GeminiError("Limit Gemini wyczerpany. Odczekaj minutę i spróbuj ponownie.");
  return new GeminiError(`Gemini: ${msg.slice(0, 200)}`);
}

async function uploadAndWait(ai: GoogleGenAI, data: Buffer, mimeType: string) {
  const file = await ai.files.upload({ file: new Blob([new Uint8Array(data)], { type: mimeType }), config: { mimeType } });
  let f = file;
  for (let i = 0; i < 60 && f.state === "PROCESSING"; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    f = await ai.files.get({ name: f.name! });
  }
  if (f.state !== "ACTIVE" || !f.uri) throw new GeminiError("Gemini nie przetworzył pliku wideo.");
  return f;
}

function parseJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1];
  const raw = (fenced ?? text).trim();
  const j = JSON.parse(raw.slice(raw.search(/[[{]/)));
  return Array.isArray(j) ? j[0] : j;
}

async function ask<T>(apiKey: string, data: Buffer, mimeType: string, prompt: string, schema: z.ZodType<T>): Promise<T> {
  const ai = client(apiKey);
  let file;
  try {
    file = await uploadAndWait(ai, data, mimeType);
  } catch (e) {
    throw e instanceof GeminiError ? e : friendly(e);
  }
  try {
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: [createPartFromUri(file.uri!, mimeType), prompt],
          config: { responseMimeType: "application/json", temperature: 0.2 },
        });
        const parsed = schema.safeParse(parseJson(r.text ?? ""));
        if (parsed.success) return parsed.data;
        lastErr = new GeminiError("Gemini zwrócił wynik w złym formacie.");
      } catch (e) {
        lastErr = e;
        if (/429|RESOURCE_EXHAUSTED|503|UNAVAILABLE|overloaded/i.test(String(e))) await new Promise((r) => setTimeout(r, 6000 * (attempt + 1)));
        else if (!(e instanceof SyntaxError)) break;
      }
    }
    throw lastErr instanceof GeminiError ? lastErr : friendly(lastErr);
  } finally {
    ai.files.delete({ name: file.name! }).catch(() => {});
  }
}

const CLIP_PROMPT = (product: string, generated: string | null) => `Jesteś wykonawcą w narzędziu do montażu reklam Meta Ads. Obejrzyj i odsłuchaj nagranie.
Reklamowany produkt: ${product}
${generated ? `To ujęcie wygenerowało AI według briefu: „${generated}”. Sprawdź krytycznie zgodność z briefem, artefakty (dłonie, palce, twarze, deformacje) i czy napisy/logo na produkcie nie są lustrzanym odbiciem.` : "To nagranie wgrał użytkownik (może pokazywać inny model produktu — to jego decyzja, opisz po prostu, co widać)."}
Zwróć WYŁĄCZNIE JSON:
{"summary": str, "product_look": str, "overlays_text": [str], "audio": str, "text_mirrored": bool, "ai_artifacts": [str],
 "segments": [{"start": float, "end": float, "shows": str, "product_visible": bool, "skin_or_hair_visible": bool, "who": "kobieta|mężczyzna|nie widać",
   "sharpness": 1-5, "use_for": ["hook"|"problem"|"mechanizm"|"demonstracja"|"efekt_po"|"przed"|"rozpakowanie"|"mycie"|"produkt"|"reakcja"|"nie_nadaje_sie"],
   "hook_score": 1-10, "focus": [{"x": 0-1, "y": 0-1, "what": str}]}]}
Segmenty po 1–3 s, czasy w sekundach (0.1). "focus": najważniejsze punkty w kadrze (np. czerwone kropki na skórze, gładki pasek skóry) jako ułamki szerokości/wysokości kadru. "overlays_text": cudze napisy/watermarki widoczne w kadrze. Bądź krytyczny: ostrość, rozmazanie, czy realnie widać efekt. Pisz po polsku.`;

export async function analyzeClip(apiKey: string, data: Buffer, mimeType: string, product: string, generatedBrief: string | null): Promise<ClipAnalysis> {
  return ask(apiKey, data, mimeType, CLIP_PROMPT(product, generatedBrief), ClipAnalysis);
}

export const RenderReview = z.object({
  score: z.coerce.number(),
  verdict: z.string(),
  issues: z.array(z.object({ t: z.string().default(""), severity: z.string().default("drobna"), problem: z.string(), fix: z.string().default("") })).default([]),
  strengths: z.array(z.string()).default([]),
});
export type RenderReview = z.infer<typeof RenderReview>;

export async function reviewRender(apiKey: string, data: Buffer, ctx: { product: string; audience: string; preferences: string[] }): Promise<RenderReview> {
  const prompt = `Jesteś niezależnym Kontrolerem jakości reklam Meta Ads (rynek polski). Obejrzyj i odsłuchaj CAŁĄ reklamę. Produkt: ${ctx.product}. Grupa: ${ctx.audience}.
PREFERENCJE MARKI (decyzje klienta — nie zgłaszaj ich jako usterek, najwyżej jako uwagę "drobna" o ryzyku):
${ctx.preferences.map((p) => `- ${p}`).join("\n") || "- brak"}
- nagrania z innym modelem produktu są celowo użyte przez klienta.
Oceń: hook 0–3 s (obraz + dźwięk + tekst), problem i efekt, czy każde ujęcie ilustruje to, co mówi lektor, migające/puste klatki, czytelność i poprawność napisów, jakość efektów (ikony, przekreślenia, split, przejścia), tempo i martwe pauzy, muzyka i SFX (nie zagłuszają lektora?), CTA min. 3 s, marka wcześnie i na końcu, ryzyka zasad Meta.
Zwróć WYŁĄCZNIE JSON: {"score": 1-10, "verdict": "gotowe"|"do_poprawy", "issues": [{"t": "mm:ss", "severity": "krytyczna|ważna|drobna", "problem": str, "fix": str}], "strengths": [str]}. Pisz po polsku.`;
  return ask(apiKey, data, "video/mp4", prompt, RenderReview);
}

// ---------- ad copy: what a finished creative says and shows ----------

// "pusty" / "brak" written out instead of an empty field
const text = z.string().default("").transform((v) => (/^\s*(pusty|pusta|brak|none|n\/a|-)\s*\.?\s*$/i.test(v) ? "" : v.trim()));

export const CreativeAnalysis = z.object({
  format: text,
  hook: text,
  voiceover: text,
  on_screen_text: z.array(z.string()).default([]),
  story: text,
  problem: text,
  solution: text,
  product: text,
  offer: text,
  cta: text,
  tone: text,
  audience: text,
  angle: text,
});
export type CreativeAnalysis = z.infer<typeof CreativeAnalysis>;

export async function analyzeCreative(apiKey: string, data: Buffer, mimeType: string, product: string): Promise<CreativeAnalysis> {
  const video = mimeType.startsWith("video/");
  const prompt = `Jesteś analitykiem reklam Meta Ads (rynek polski). ${video ? "Obejrzyj i odsłuchaj CAŁĄ reklamę wideo." : "Obejrzyj grafikę reklamową."} Reklamowany produkt: ${product}.
Opisz, co kreacja komunikuje — na tej podstawie copywriter dopisze tekst główny, nagłówek i opis, które mają ją dopełnić.
Zwróć WYŁĄCZNIE JSON:
{"format": "np. UGC do kamery / sklejka z lektorem / przed-po / statyk z korzyściami",
 "hook": "co widać i słychać w pierwszych 2–3 s (dla grafiki: co przyciąga wzrok najpierw)",
 "voiceover": "${video ? "dosłownie, co mówi lektor / osoba w kadrze (pusty, jeśli nikt nie mówi)" : "pusty"}",
 "on_screen_text": ["napisy i teksty na kreacji, dosłownie"],
 "story": "krótko przebieg: scena po scenie albo układ grafiki",
 "problem": "jaki problem pokazuje / nazywa (pusty, jeśli żaden)",
 "solution": "jak pokazuje rozwiązanie / efekt",
 "product": "jak i kiedy pokazuje produkt",
 "offer": "oferta / cena / promocja widoczna lub wypowiedziana (pusty, jeśli brak)",
 "cta": "wezwanie do działania (pusty, jeśli brak)",
 "tone": "ton i emocja",
 "audience": "do kogo mówi (kto w kadrze, czyim językiem)",
 "angle": "kąt reklamy jednym zdaniem"}
Pisz po polsku, konkretnie, bez oceniania jakości.`;
  return ask(apiKey, data, mimeType, prompt, CreativeAnalysis);
}

// ---------- text remover ----------

/** Fast model for caption boxes: same answers as the default model here, ~14 s instead of ~3 min. */
export const SCAN_MODEL = process.env.GEMINI_SCAN_MODEL ?? "gemini-3.7-flash";

const Box = z.array(z.coerce.number()).length(4);
export const CaptionScan = z.object({
  frames: z.array(z.object({ i: z.coerce.number().int(), boxes: z.array(Box).default([]) })).default([]),
  scenes: z.array(z.object({ shot: z.coerce.number().int(), background: z.string() })).default([]),
});
export type CaptionScan = z.infer<typeof CaptionScan>;

/**
 * Where the burned-in captions are, on frames sampled at `sampleFps`, plus — per shot — what the
 * scene behind them looks like (an English prompt for the inpainting model).
 */
export async function scanCaptions(apiKey: string, frames: Buffer[], sampleFps: number, shots: Array<{ start: number; end: number }>): Promise<CaptionScan> {
  const ai = client(apiKey);
  const prompt = `Each image is one frame of a vertical video, sampled at ${sampleFps} fps (frame i is at t = (i-1)/${sampleFps} s).
Find ALL overlaid caption text / burned-in text: TikTok/Reels-style captions, text stickers, subtitles, emojis that belong to the caption, watermarks with usernames.
Ignore text that physically exists in the scene (product labels, logos printed on objects, signs on walls).
Shots of the video (s): ${JSON.stringify(shots.map((s, k) => ({ shot: k, start: Number(s.start.toFixed(2)), end: Number(s.end.toFixed(2)) })))}.
Return ONLY JSON: {"frames":[{"i":1,"boxes":[[ymin,xmin,ymax,xmax],...]}], "scenes":[{"shot":0,"background":"..."}]}
- frames: EVERY frame, boxes normalised 0-1000, tight around each text line including emojis and the text outline/shadow. Empty list when there is no overlaid text.
- scenes: for every shot that has overlaid text, one short English phrase describing ONLY the surfaces and textures directly underneath the text area — what an empty continuation of the background would look like there: wall colour, ceiling, out-of-focus light, hair, skin, sky (e.g. "a softly lit plain pink wall with blurry warm bokeh", "smooth blonde hair and a plain light grey ceiling"). NEVER name objects, products, tools, people's actions or anything else in the frame — the painter would draw them into the caption area. End with ", clean background, no text, no objects".`;
  const parts = [{ text: prompt }, ...frames.flatMap((f, k) => [{ text: `frame ${k + 1}` }, { inlineData: { mimeType: "image/jpeg", data: f.toString("base64") } }])];
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await ai.models.generateContent({ model: SCAN_MODEL, contents: [{ role: "user", parts }], config: { responseMimeType: "application/json", temperature: 0 } });
      const parsed = CaptionScan.safeParse(parseJson(r.text ?? ""));
      if (parsed.success) return parsed.data;
      lastErr = new GeminiError("Gemini zwrócił wynik w złym formacie.");
    } catch (e) {
      lastErr = e;
      if (/429|RESOURCE_EXHAUSTED|503|UNAVAILABLE|overloaded/i.test(String(e))) await new Promise((res) => setTimeout(res, 6000 * (attempt + 1)));
      else if (!(e instanceof SyntaxError)) break;
    }
  }
  throw lastErr instanceof GeminiError ? lastErr : friendly(lastErr);
}

export const FilmCheck = z.object({
  frames: z.array(z.object({ i: z.coerce.number().int(), text: z.coerce.boolean().default(false), artifact: z.string().default("") })).default([]),
});

/**
 * Kontroler of a cleaned film: frames (sampled at `sampleFps`) where overlaid text is still visible
 * or where the repainted strip (top `band.from`–`band.to` of the frame height, 0–1) shows something
 * that does not belong in the scene. Returns the times (s).
 */
export async function checkCleanFilm(apiKey: string, pairs: Array<{ original: Buffer; cleaned: Buffer }>, sampleFps: number, band: { from: number; to: number }): Promise<{ text: number[]; artifacts: Array<{ t: number; what: string }> }> {
  const ai = client(apiKey);
  const prompt = `Frames of a vertical ad video, sampled at ${sampleFps} fps (frame i is at t = (i-1)/${sampleFps} s). For each frame you get the ORIGINAL (with burned-in captions) and the CLEANED version, where an AI removed the captions by repainting the horizontal strip from ${Math.round(band.from * 100)}% to ${Math.round(band.to * 100)}% of the frame height.
For EVERY frame report, judging the CLEANED version:
- "text": true if ANY of the overlaid caption text, letters or caption emojis is still visible (even partly or faded). Ignore text physically in the scene (product labels, logos).
- "artifact": a short description ONLY if the cleaned strip shows something that is NOT in the original and does not belong in the scene: a coloured blob, a new object (e.g. a green clip on the hair), glowing spots, smears, broken or doubled shapes. Anything that is also in the original (the product, hands, hair, furniture) is NOT an artifact. Empty string when the strip looks natural.
Return ONLY JSON: {"frames":[{"i":1,"text":false,"artifact":""}, ...]}`;
  const parts = [{ text: prompt }, ...pairs.flatMap((p, k) => [
    { text: `frame ${k + 1} ORIGINAL` }, { inlineData: { mimeType: "image/jpeg", data: p.original.toString("base64") } },
    { text: `frame ${k + 1} CLEANED` }, { inlineData: { mimeType: "image/jpeg", data: p.cleaned.toString("base64") } },
  ])];
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await ai.models.generateContent({ model: SCAN_MODEL, contents: [{ role: "user", parts }], config: { responseMimeType: "application/json", temperature: 0 } });
      const parsed = FilmCheck.safeParse(parseJson(r.text ?? ""));
      if (parsed.success) {
        const t = (i: number) => (i - 1) / sampleFps;
        return {
          text: parsed.data.frames.filter((f) => f.text).map((f) => t(f.i)),
          artifacts: parsed.data.frames.filter((f) => f.artifact.trim()).map((f) => ({ t: t(f.i), what: f.artifact.trim() })),
        };
      }
      lastErr = new GeminiError("Gemini zwrócił wynik w złym formacie.");
    } catch (e) {
      lastErr = e;
      if (/429|RESOURCE_EXHAUSTED|503|UNAVAILABLE|overloaded/i.test(String(e))) await new Promise((res) => setTimeout(res, 6000 * (attempt + 1)));
      else if (!(e instanceof SyntaxError)) break;
    }
  }
  throw lastErr instanceof GeminiError ? lastErr : friendly(lastErr);
}
