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
