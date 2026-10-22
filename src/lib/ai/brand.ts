import "server-only";
import { z } from "zod";
import { structuredCall } from "./claude";
import { PROFILE_RULES, knowledgeBlock } from "./profile-prompts";
import { loadSkill } from "@/lib/knowledge";
import { BrandProfileSchema, type BrandProfile } from "@/lib/profiles/brand";
import { QuestionSchema, type AnsweredQuestion } from "@/lib/profiles/common";
import type { BrandSource } from "@/lib/scrape/site";

export const BrandAnalysisSchema = z.object({
  profile: BrandProfileSchema,
  questions: z.array(QuestionSchema),
  completeness: z.number().describe("0-100"),
  summary: z.string(),
  logo_url: z.string().describe("Najbardziej prawdopodobny adres logo spośród kandydatów ze źródła (pusty, jeśli żaden nie pasuje)."),
});
export type BrandAnalysis = z.infer<typeof BrandAnalysisSchema>;

async function systemPrompt() {
  return `Jesteś strategiem marki i kreacji reklamowych Meta Ads w narzędziu Clipzy (rynek polski, e-commerce). Twoim zadaniem jest zbudować bezbłędny profil marki, z którego potem korzystają modele montujące reklamy wideo i graficzne. Tu nie ma miejsca na błędy — lepiej zapytać, niż zgadnąć.

${PROFILE_RULES}

Wskazówki do pól:
- caption_profile wybierz na podstawie grupy docelowej: kobiety 25–50 (beauty/bielizna/dom) → kobiety_25_50; młodzi do ~27 lat → gen_z; 50+ → 50_plus; pozostali / rodzice → uniwersalny.
- colors: wybierz z kandydatów kolorów (theme-color, zmienne CSS, najczęstsze barwy) te, które są kolorami marki, a nie szarościami interfejsu. caption_text: kolor marki, jeśli dobrze czyta się na wideo; w przeciwnym razie #ffffff.
- tone_of_voice.example_phrases: cytuj prawdziwe zdania ze strony, jeśli brzmią jak marka.${knowledgeBlock(await loadSkill())}`;
}

function sourceText(source: BrandSource): string {
  const { home } = source;
  return JSON.stringify(
    {
      adres: source.url,
      tytul: home.title,
      opis: home.description,
      nazwa_witryny: home.siteName,
      jezyk: home.lang,
      naglowki: home.headings,
      tekst_strony_glownej: home.text,
      podstrony_o_marce: source.infoPages,
      kandydaci_logo: home.logoCandidates,
      kandydaci_kolorow: source.colors,
      produkty_ze_sklepu: source.products,
      dane_strukturalne: home.jsonLd,
    },
    null,
    1,
  );
}

export async function analyzeBrand(
  apiKey: string,
  input: { source: BrandSource | null; nameHint: string; notes: string },
): Promise<BrandAnalysis> {
  const parts = [
    `Zbuduj pierwszą wersję profilu marki${input.nameHint ? ` „${input.nameHint}”` : ""}. Zadaj pytania o wszystko, czego nie da się pewnie ustalić.`,
    input.source ? `<zrodlo>\n${sourceText(input.source)}\n</zrodlo>` : "Marka nie podała strony internetowej — buduj profil z notatek i pytań.",
    input.notes ? `<notatki_uzytkownika>\n${input.notes}\n</notatki_uzytkownika>` : "",
  ];
  return structuredCall({
    apiKey,
    system: await systemPrompt(),
    schema: BrandAnalysisSchema,
    content: [{ type: "text", text: parts.filter(Boolean).join("\n\n") }],
  });
}

export async function refineBrand(
  apiKey: string,
  input: { profile: BrandProfile; answers: AnsweredQuestion[]; source: BrandSource | null },
): Promise<Omit<BrandAnalysis, "logo_url">> {
  const schema = BrandAnalysisSchema.omit({ logo_url: true });
  const answered = input.answers.filter((a) => a.answer.trim());
  return structuredCall({
    apiKey,
    system: await systemPrompt(),
    schema,
    content: [
      {
        type: "text",
        text: `Oto aktualny profil marki (z ręcznymi poprawkami użytkownika) oraz jego odpowiedzi na Twoje pytania. Wpisz odpowiedzi w odpowiednie pola, zachowaj poprawki użytkownika, oceń kompletność i zadaj kolejne pytania tylko o to, czego nadal brakuje.\n\n<profil>\n${JSON.stringify(input.profile, null, 1)}\n</profil>\n\n<odpowiedzi>\n${JSON.stringify(answered.map(({ question, answer, field }) => ({ field, question, answer })), null, 1)}\n</odpowiedzi>${
          input.source ? `\n\n<zrodlo_strona>\n${sourceText(input.source).slice(0, 20000)}\n</zrodlo_strona>` : ""
        }`,
      },
    ],
  });
}
