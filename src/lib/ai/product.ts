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
  questions: z.array(QuestionSchema),
  completeness: z.number().describe("0-100"),
  summary: z.string(),
});
export type ProductAnalysis = z.infer<typeof ProductAnalysisSchema>;

async function systemPrompt(brand: BrandProfile) {
  return `Jesteś Reżyserem Clipzy — strategiem kreacji reklamowych Meta Ads (rynek polski, e-commerce). Budujesz bezbłędny profil produktu, z którego modele tworzą sklejki, AI nagrania i image ads. Produkt należy do marki opisanej poniżej — trzymaj się jej grupy docelowej, tonu i ograniczeń.

${PROFILE_RULES}

Szczególnie ważne pola (z bazy wiedzy): problem i to, jak go POKAZAĆ; unikalny mechanizm (wg „wypalenia obietnicy”); poziom wypalenia rynku; język klienta (jak klienci sami opisują problem — tylko z opinii/źródeł, nie zmyślaj); czy da się uczciwie pokazać przed/po; czy jest efekt WOW do hooka; obiekcje z odpowiedziami; oferta; emocja i nastrój muzyki. Przed/po i efekt WOW zaznaczaj tylko, jeśli są realne — nigdy nie wymyślaj efektów, których produkt nie daje. Kąty reklamowe i pomysły na hooki mają się wyraźnie od siebie różnić (inna osoba, inny poziom świadomości, inna emocja, inny obraz).

<profil_marki>
${JSON.stringify(brand, null, 1)}
</profil_marki>${knowledgeBlock(await productKnowledge())}`;
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
        text: `Zbuduj pierwszą wersję profilu produktu „${input.nameHint}”. Powyżej zdjęcia produktu (jeśli są) — wykorzystaj je, żeby zrozumieć, jak produkt wygląda i co da się pokazać na wideo.\n\n${productEvidence(input.source, input.notes)}`,
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
  },
): Promise<ProductAnalysis> {
  const pending = (input.openQuestions ?? []).length
    ? `\n\n<otwarte_pytania>\n${JSON.stringify(input.openQuestions, null, 1)}\n</otwarte_pytania>\nZachowaj otwarte pytania, które wciąż są aktualne.`
    : "";
  return structuredCall({
    apiKey,
    system: await systemPrompt(input.brand),
    schema: ProductAnalysisSchema,
    content: [
      ...imageBlocks(input.imageUrls),
      {
        type: "text",
        text: `Oto aktualny profil produktu (z ręcznymi poprawkami użytkownika). Wpisz odpowiedzi użytkownika w odpowiednie pola, zachowaj jego poprawki, oceń kompletność i dopytaj tylko o to, czego nadal brakuje.\n\n<profil>\n${JSON.stringify(input.profile, null, 1)}\n</profil>\n\n${productEvidence(input.source, input.notes, input.answers)}${pending}${controlIssuesBlock(input.controlIssues ?? [])}`,
      },
    ],
  });
}
