import "server-only";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { structuredCall } from "./claude";
import { PROFILE_RULES, controlIssuesBlock, knowledgeBlock } from "./profile-prompts";
import type { ReviewIssue } from "./review";
import { productKnowledge } from "@/lib/knowledge";
import type { BrandProfile } from "@/lib/profiles/brand";
import { ProductProfileSchema, type ProductProfile } from "@/lib/profiles/product";
import { QuestionSchema, type AnsweredQuestion, type Question } from "@/lib/profiles/common";
import type { ProductSource } from "@/lib/scrape/product";

export const ProductAnalysisSchema = z.object({
  profile: ProductProfileSchema,
  questions: z.array(QuestionSchema).describe("0–3 pytań, tylko z dozwolonych tematów. Zwykle 0–2."),
  summary: z.string(),
});
export type ProductAnalysis = z.infer<typeof ProductAnalysisSchema>;

async function systemPrompt(brand: BrandProfile) {
  return `Jesteś Reżyserem Clipzy — strategiem kreacji reklamowych Meta Ads (rynek polski, e-commerce). Budujesz bezbłędny profil produktu, z którego modele tworzą sklejki, AI nagrania i image ads. Produkt należy do marki opisanej poniżej — trzymaj się jej grupy docelowej, tonu i ograniczeń.

${PROFILE_RULES}

Gdzie wkładasz pracę:
- problems: co najmniej 8 konkretnych problemów, które produkt rozwiązuje, językiem klienta.
- ad_angles: 10–15 kątów, naprawdę różnych: rozłóż je na persony marki, różne problemy i wszystkie poziomy świadomości (od nieświadomego problemu po najbardziej świadomego). Każdy kąt ma gotowy hook — pierwsze zdanie i co widać w pierwszej sekundzie.
- mechanism: pewnie i konkretnie, dlaczego ten produkt działa — w duchu „wypalenia obietnicy” z bazy wiedzy.
- objections: co najmniej 4 obiekcje z odpowiedzią, którą da się powiedzieć w reklamie.
- Przed/po i efekt WOW to wnioski ze zdjęć i opisu — zaznacz, jeśli wynikają z natury produktu; analiza nagrań potwierdzi je później. Nie pytaj o nie.

<profil_marki>
${JSON.stringify(brand, null, 1)}
</profil_marki>${knowledgeBlock(
    await productKnowledge(),
    "Wykorzystaj ją do budowy problemów, mechanizmu i kątów (poziomy świadomości, wypalenie obietnicy, unikalny mechanizm, hooki, przed/po, efekt WOW).",
  )}`;
}

function imageBlocks(urls: string[]): Anthropic.Messages.ContentBlockParam[] {
  return urls.slice(0, 4).map((url) => ({ type: "image", source: { type: "url", url } }) as const);
}

// Everything the product profile may rely on — shown to Claude and to the Controller.
export function productEvidence(source: ProductSource | null, notes: string, answers: AnsweredQuestion[] = []): string {
  const parts: string[] = [];
  parts.push(
    source
      ? `<strona_produktu>\n${JSON.stringify(
          {
            adres: source.url,
            tytul: source.title,
            opis: source.description,
            cena: source.price,
            waluta: source.currency,
            warianty: source.variants,
            tagi: source.tags,
            opinie: source.reviewsHint,
            tekst_strony: source.pageText,
          },
          null,
          1,
        )}\n</strona_produktu>`
      : "(brak strony produktu)",
  );
  if (notes) parts.push(`<notatki_uzytkownika>\n${notes}\n</notatki_uzytkownika>`);
  const answered = answers.filter((a) => a.answer.trim());
  if (answered.length) {
    parts.push(`<odpowiedzi_uzytkownika>\n${JSON.stringify(answered.map(({ field, question, answer }) => ({ field, question, answer })), null, 1)}\n</odpowiedzi_uzytkownika>`);
  }
  return parts.join("\n\n");
}

export async function analyzeProduct(
  apiKey: string,
  input: { brand: BrandProfile; source: ProductSource | null; nameHint: string; notes: string; imageUrls: string[] },
): Promise<ProductAnalysis> {
  return structuredCall({
    apiKey,
    system: await systemPrompt(input.brand),
    schema: ProductAnalysisSchema,
    content: [
      ...imageBlocks(input.imageUrls),
      {
        type: "text",
        text: `Zbuduj kompletny profil produktu „${input.nameHint}” — sam, na podstawie źródeł. Powyżej zdjęcia produktu (jeśli są) — wykorzystaj je, żeby zrozumieć, jak produkt wygląda i co da się pokazać na wideo. Pytania tylko wyjątkowo (maksymalnie 3, tylko z dozwolonych tematów).\n\n${productEvidence(input.source, input.notes)}`,
      },
    ],
  });
}

export async function refineProduct(
  apiKey: string,
  input: {
    brand: BrandProfile;
    profile: ProductProfile;
    answers: AnsweredQuestion[];
    imageUrls: string[];
    source: ProductSource | null;
    notes: string;
    controlIssues?: ReviewIssue[];
    openQuestions?: Question[];
    /** What the completeness rule says is still missing — fill it in yourself. */
    focus?: string[];
  },
): Promise<ProductAnalysis> {
  const focus = (input.focus ?? []).length
    ? `\n\n<do_uzupelnienia>\nW profilu wciąż brakuje: ${(input.focus ?? []).join(", ")}. Uzupełnij to sam, na podstawie źródeł i wiedzy o tej grupie klientów — nie zadawaj o to pytań.\n</do_uzupelnienia>`
    : "";
  const pending = (input.openQuestions ?? []).length
    ? `\n\n<otwarte_pytania>\n${JSON.stringify(input.openQuestions, null, 1)}\n</otwarte_pytania>\nTe pytania użytkownik już widzi — nie powtarzaj ich innymi słowami. Zostaw tylko te, które wciąż są naprawdę potrzebne.`
    : "";
  return structuredCall({
    apiKey,
    system: await systemPrompt(input.brand),
    schema: ProductAnalysisSchema,
    content: [
      ...imageBlocks(input.imageUrls),
      {
        type: "text",
        text: `Oto aktualny profil produktu (z ręcznymi poprawkami użytkownika). Wpisz odpowiedzi użytkownika w odpowiednie pola, wykorzystaj je do rozbudowy problemów i kątów, zachowaj poprawki użytkownika. Nowe pytania tylko wyjątkowo (maksymalnie 3, nigdy powtórki).\n\n<profil>\n${JSON.stringify(input.profile, null, 1)}\n</profil>\n\n${productEvidence(input.source, input.notes, input.answers)}${focus}${pending}${controlIssuesBlock(input.controlIssues ?? [])}`,
      },
    ],
  });
}
