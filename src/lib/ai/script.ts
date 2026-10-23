import "server-only";
import { z } from "zod";
import { structuredCall } from "./claude";
import { contextBlock, type ClipsContext } from "./clips";
import { knowledgeText, scriptKnowledge } from "@/lib/knowledge";
import { fixBrandName } from "@/lib/clips/names";

// The Reżyser writes the voiceover: 5 different hooks + one shared rest (middle + CTA).
export const HOOK_VARIANTS = 5;

export const ScriptSchema = z.object({
  angle: z.string().describe("kąt reklamy w 1 zdaniu: persona × problem × poziom świadomości"),
  hooks: z
    .array(
      z.object({
        text: z.string().describe("pierwsze zdanie lektora, max 10 słów, po polsku"),
        idea: z.string().describe("typ hooka + krótka wskazówka obrazu na pierwsze 2–3 s (dla montażu)"),
      }),
    )
    .length(HOOK_VARIANTS),
  body: z.string().describe("wspólna reszta lektora po hooku: problem → mechanizm → efekt → CTA; pasuje po KAŻDYM hooku"),
  notes: z.string().describe("1–2 zdania dla użytkownika: dlaczego taki kąt i hooki"),
});
export type Script = z.infer<typeof ScriptSchema>;

const RULES = `Piszesz skrypt lektora do sklejki (reklama Meta Ads, rynek polski).
- Struktura: 5 RÓŻNYCH hooków (pierwsze zdanie) + jedna wspólna reszta. Reszta musi brzmieć naturalnie po każdym hooku — nie odwołuj się w niej do treści konkretnego hooka.
- 5 różnych typów hooka, po jednym: (1) pytanie o problem, (2) efekt/WOW widoczny w obrazie, (3) ból/frustracja, (4) obalenie mitu albo „przestań…”, (5) konkret produktu (mechanizm, cecha). Każdy max 10 słów.
- Każde zdanie ma mieć pokrycie w nagraniach z <materialy> (albo w ujęciu, które da się wygenerować — problem bez produktu). Nie obiecuj tego, czego nie widać.
- Bez zmyślonych liczb, opinii, rabatów i gwarancji, których nie ma w profilu. Zgodnie z zasadami Meta: nie sugeruj widzowi cech osobistych wprost w 2. osobie w drażliwych tematach (zdrowie, wygląd) — mów o problemie, nie o „Twojej wadzie”.
- Język mówiony, krótkie zdania, tempo dynamiczne. Nazwa marki dokładnie jak w profilu.
- Koniec reszty: CTA (np. „Kliknij link poniżej”).`;

export async function writeScript(apiKey: string, ctx: ClipsContext, opts: { words: number; note?: string; previous?: Script }): Promise<Script> {
  const docs = await scriptKnowledge();
  const prev = opts.previous ? `\n\n<poprzedni_skrypt>${JSON.stringify(opts.previous)}</poprzedni_skrypt>` : "";
  const note = opts.note?.trim() ? `\n\n<uwaga_uzytkownika>${opts.note.trim()}</uwaga_uzytkownika>` : "";
  const script = await structuredCall({
    apiKey,
    system: `Jesteś Reżyserem Clipzy. ${RULES}\n\n${knowledgeText(docs)}`,
    schema: ScriptSchema,
    maxTokens: 4000,
    content: [
      {
        type: "text",
        text: `${contextBlock({ ...ctx, voiceover: null })}${prev}${note}\n\nNapisz skrypt lektora. Długość: hook + reszta razem ok. ${opts.words} słów (reszta ok. ${Math.max(15, opts.words - 7)} słów). Lektora jeszcze nie ma — to Ty go piszesz (zignoruj informację „BRAK lektora” powyżej).`,
      },
    ],
  });
  const fix = (t: string) => fixBrandName(t.trim(), ctx.brand.name);
  return { ...script, hooks: script.hooks.map((h) => ({ ...h, text: fix(h.text) })), body: fix(script.body) };
}

export function scriptWords(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}
