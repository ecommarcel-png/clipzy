import "server-only";
import { z } from "zod";
import { structuredCall } from "./claude";
import { knowledgeText, reviewerKnowledge } from "@/lib/knowledge";

// The Controller: an independent Claude call that sees only the result, the
// evidence and the rules — never the reasoning that produced the result.

export const ReviewIssueSchema = z.object({
  field: z.string().describe("Pole profilu albo miejsce, którego dotyczy usterka (np. 'social_proof', 'target_audience.age_from')."),
  severity: z.enum(["krytyczna", "ważna", "drobna"]),
  problem: z.string().describe("Co jest nie tak — konkretnie, jednym-dwoma zdaniami."),
  fix: z.string().describe("Jak to naprawić (albo jakie pytanie zadać użytkownikowi)."),
});
export type ReviewIssue = z.infer<typeof ReviewIssueSchema>;

export const ReviewSchema = z.object({
  verdict: z.enum(["ok", "do_poprawy"]),
  issues: z.array(ReviewIssueSchema),
  checked: z.array(z.string()).describe("Krótka lista punktów, które faktycznie sprawdziłeś."),
});
export type Review = z.infer<typeof ReviewSchema>;

const SYSTEM_RULES = `Jesteś Kontrolerem jakości w narzędziu Clipzy (reklamy Meta Ads, rynek polski). Twoja jedyna praca: znaleźć usterki w wyniku, zanim zobaczy go użytkownik. Nie poprawiasz sam — zgłaszasz.

Jak pracujesz:
- Sprawdzasz wynik punkt po punkcie według listy kontrolnej z bazy wiedzy „Reżyser Clipzy” (rozdz. 5).
- Każde twierdzenie faktyczne porównujesz z dowodami (źródła, notatki, odpowiedzi użytkownika). Brak pokrycia = usterka.
- Zgłaszasz tylko realne usterki, konkretnie (pole, problem, jak naprawić). Nie zgłaszasz kwestii gustu ani pustych pól, o które w profilu i tak zadano pytanie.
- Puste pole nie jest usterką, jeśli brak danych w źródłach — usterką jest pole wypełnione zmyśleniem.
- Wagi: krytyczna = zmyślony fakt, ryzyko prawne/zasad Meta, sprzeczność, która zepsuje reklamy; ważna = ogólnik tam, gdzie potrzeba konkretu, niespójność, błędny profil napisów; drobna = styl, pisownia, drobne doprecyzowanie.
- verdict = "ok", gdy nie ma usterek krytycznych ani ważnych.
- Piszesz po polsku.`;

export async function reviewProfile(
  apiKey: string,
  input: { kind: "marka" | "produkt"; profile: unknown; evidence: string; brandProfile?: unknown },
): Promise<Review> {
  const docs = await reviewerKnowledge();
  const system = `${SYSTEM_RULES}\n\n${knowledgeText(docs)}`;
  const brandBlock = input.brandProfile ? `\n\n<profil_marki_produktu>\n${JSON.stringify(input.brandProfile, null, 1)}\n</profil_marki_produktu>` : "";
  return structuredCall({
    apiKey,
    system,
    schema: ReviewSchema,
    maxTokens: 6000,
    content: [
      {
        type: "text",
        text: `Sprawdź profil (${input.kind}). Porównaj go z dowodami i z zasadami.\n\n<profil_do_sprawdzenia>\n${JSON.stringify(input.profile, null, 1)}\n</profil_do_sprawdzenia>${brandBlock}\n\n<dowody>\n${input.evidence}\n</dowody>`,
      },
    ],
  });
}
