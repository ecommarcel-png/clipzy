import "server-only";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { structuredCall } from "./claude";
import { PROFILE_RULES, knowledgeBlock } from "./profile-prompts";
import { loadSkill } from "@/lib/knowledge";
import type { BrandProfile } from "@/lib/profiles/brand";
import { ProductProfileSchema, type ProductProfile } from "@/lib/profiles/product";
import { QuestionSchema, type AnsweredQuestion } from "@/lib/profiles/common";
import type { ProductSource } from "@/lib/scrape/product";

export const ProductAnalysisSchema = z.object({
  profile: ProductProfileSchema,
  questions: z.array(QuestionSchema),
  completeness: z.number().describe("0-100"),
  summary: z.string(),
});
export type ProductAnalysis = z.infer<typeof ProductAnalysisSchema>;

async function systemPrompt(brand: BrandProfile) {
  return `Jesteś strategiem kreacji reklamowych Meta Ads w narzędziu Clipzy (rynek polski, e-commerce). Budujesz bezbłędny profil produktu, z którego modele tworzą sklejki, AI nagrania i image ads. Produkt należy do marki opisanej poniżej — trzymaj się jej grupy docelowej, tonu i ograniczeń.

${PROFILE_RULES}

Szczególnie ważne pola (z bazy wiedzy): problem i to, jak go POKAZAĆ; unikalny mechanizm; czy da się uczciwie pokazać przed/po; czy jest efekt WOW do hooka; obiekcje z odpowiedziami; oferta; emocja i nastrój muzyki. Przed/po i efekt WOW zaznaczaj tylko, jeśli są realne — nigdy nie wymyślaj efektów, których produkt nie daje. Kąty reklamowe i pomysły na hooki mają się wyraźnie od siebie różnić (różna emocja, różny obraz).

<profil_marki>
${JSON.stringify(brand, null, 1)}
</profil_marki>${knowledgeBlock(await loadSkill())}`;
}

function imageBlocks(urls: string[]): Anthropic.Messages.ContentBlockParam[] {
  return urls.slice(0, 4).map((url) => ({ type: "image", source: { type: "url", url } }) as const);
}

export async function analyzeProduct(
  apiKey: string,
  input: { brand: BrandProfile; source: ProductSource | null; nameHint: string; notes: string; imageUrls: string[] },
): Promise<ProductAnalysis> {
  const source = input.source
    ? JSON.stringify(
        {
          adres: input.source.url,
          tytul: input.source.title,
          opis: input.source.description,
          cena: input.source.price,
          waluta: input.source.currency,
          warianty: input.source.variants,
          tagi: input.source.tags,
          opinie: input.source.reviewsHint,
          tekst_strony: input.source.pageText,
        },
        null,
        1,
      )
    : "(brak strony produktu)";

  return structuredCall({
    apiKey,
    system: await systemPrompt(input.brand),
    schema: ProductAnalysisSchema,
    content: [
      ...imageBlocks(input.imageUrls),
      {
        type: "text",
        text: `Zbuduj pierwszą wersję profilu produktu „${input.nameHint}”. Powyżej zdjęcia produktu (jeśli są) — wykorzystaj je, żeby zrozumieć, jak produkt wygląda i co da się pokazać na wideo.\n\n<strona_produktu>\n${source}\n</strona_produktu>${
          input.notes ? `\n\n<notatki_uzytkownika>\n${input.notes}\n</notatki_uzytkownika>` : ""
        }`,
      },
    ],
  });
}

export async function refineProduct(
  apiKey: string,
  input: { brand: BrandProfile; profile: ProductProfile; answers: AnsweredQuestion[]; imageUrls: string[] },
): Promise<ProductAnalysis> {
  const answered = input.answers.filter((a) => a.answer.trim());
  return structuredCall({
    apiKey,
    system: await systemPrompt(input.brand),
    schema: ProductAnalysisSchema,
    content: [
      ...imageBlocks(input.imageUrls),
      {
        type: "text",
        text: `Oto aktualny profil produktu (z ręcznymi poprawkami użytkownika) i odpowiedzi na Twoje pytania. Wpisz odpowiedzi w odpowiednie pola, zachowaj poprawki użytkownika, oceń kompletność i dopytaj tylko o to, czego nadal brakuje.\n\n<profil>\n${JSON.stringify(input.profile, null, 1)}\n</profil>\n\n<odpowiedzi>\n${JSON.stringify(answered.map(({ question, answer, field }) => ({ field, question, answer })), null, 1)}\n</odpowiedzi>`,
      },
    ],
  });
}
