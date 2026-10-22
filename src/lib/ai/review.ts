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
  fix: z.string().describe("Jak to naprawić — konkretne działanie dla Reżysera, jednym zdaniem."),
});
export type ReviewIssue = z.infer<typeof ReviewIssueSchema>;

export const ReviewSchema = z.object({
  verdict: z.enum(["ok", "do_poprawy"]),
  issues: z.array(ReviewIssueSchema).describe("Najwyżej 12 usterek, najważniejsze najpierw."),
  checked: z.array(z.string()).describe("3–6 krótkich punktów (po kilka słów), które faktycznie sprawdziłeś."),
});
export type Review = z.infer<typeof ReviewSchema>;

const SYSTEM_RULES = `Jesteś Kontrolerem jakości w narzędziu Clipzy (reklamy Meta Ads, rynek polski). Twoja praca: zanim profil trafi do użytkownika, sprawdzić, czy da się z niego zrobić reklamy, które SPRZEDAJĄ. Nie poprawiasz sam — zgłaszasz usterki.

Co sprawdzasz (w tej kolejności):
1. Siła sprzedażowa: czy persony są wyraźne i różne; czy problemów jest dużo i są konkretne (językiem klienta, nie ogólniki); czy kątów reklamowych jest co najmniej 8–10 i naprawdę się różnią (persona, problem, poziom świadomości, emocja); czy hooki zatrzymują scroll; czy mechanizm mówi pewnie, dlaczego produkt działa.
2. Zmyślone twarde fakty: liczby klientów/sprzedaży, oceny, nagrody, certyfikaty, badania, gwarancje, parametry, których NIE ma w dowodach. Perswazja, korzyści i pewny ton to NIE są zmyślenia — nie zgłaszaj ich.
3. Sprzeczności: grupa docelowa ↔ persony ↔ profil napisów ↔ ton.
4. Ryzyka zasad Meta: obietnice zdrowotne, gwarantowane efekty, odchudzanie, odwołania do cech osobistych odbiorcy.
5. Polszczyzna w tekstach, które mogą trafić do reklam (hooki, kąty).

Czego NIE zgłaszasz:
- pustych pól, gdy danych nie ma w źródłach (to nie usterka),
- braku szczegółów obsługi (dostawa, kontakt, godziny), wyglądu produktu, opinii, materiału,
- kwestii stylu, lektora, muzyki — to ustala moduł sklejek i feedback do gotowych reklam,
- kwestii gustu.

Jak naprawić (pole "fix") — zawsze działanie dla Reżysera, nigdy „zapytaj użytkownika”: „usuń”, „dopisz 4 kąty dla persony X na poziomie świadomości problemu”, „zamień ogólnik na konkret: …”.

Wagi: krytyczna = zmyślony twardy fakt, ryzyko zasad Meta, sprzeczność, która zepsuje reklamy; ważna = za mało person/problemów/kątów, kąty do siebie podobne, ogólniki w problemach lub hookach; drobna = pisownia, drobne doprecyzowanie.
verdict = "ok", gdy nie ma usterek krytycznych ani ważnych. Piszesz po polsku.

Zwięźle: najwyżej 12 usterek (najważniejsze najpierw, podobne łącz w jedną), "problem" i "fix" po jednym zdaniu. Nie przepisujesz profilu i nie piszesz nic poza wywołaniem narzędzia.`;

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
    maxTokens: 12_000,
    content: [
      {
        type: "text",
        text: `Sprawdź profil (${input.kind}). Porównaj go z dowodami i z zasadami.\n\n<profil_do_sprawdzenia>\n${JSON.stringify(input.profile, null, 1)}\n</profil_do_sprawdzenia>${brandBlock}\n\n<dowody>\n${input.evidence}\n</dowody>`,
      },
    ],
  });
}
