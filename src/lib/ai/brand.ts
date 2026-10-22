import "server-only";
import { z } from "zod";
import { structuredCall } from "./claude";
import { PROFILE_RULES, controlIssuesBlock, knowledgeBlock } from "./profile-prompts";
import type { ReviewIssue } from "./review";
import { brandKnowledge } from "@/lib/knowledge";
import { BrandProfileSchema, type BrandProfile } from "@/lib/profiles/brand";
import { QuestionSchema, type AnsweredQuestion, type Question } from "@/lib/profiles/common";
import type { BrandSource } from "@/lib/scrape/site";

export const BrandAnalysisSchema = z.object({
  profile: BrandProfileSchema,
  questions: z.array(QuestionSchema),
  completeness: z.number().describe("0-100"),
  summary: z.string(),
  logo_url: z.string().describe("Najbardziej prawdopodobny adres logo spośród kandydatów ze źródła (pusty, jeśli żaden nie pasuje)."),
});
export type BrandAnalysis = z.infer<typeof BrandAnalysisSchema>;
export type BrandDraft = { profile: BrandProfile; questions: Question[]; completeness: number; summary: string };

const RefineSchema = BrandAnalysisSchema.omit({ logo_url: true });

async function systemPrompt() {
  return `Jesteś Reżyserem Clipzy — strategiem marki i kreacji reklamowych Meta Ads (rynek polski, e-commerce). Twoim zadaniem jest zbudować bezbłędny profil marki, z którego potem korzystają modele montujące reklamy wideo i graficzne. Tu nie ma miejsca na błędy — lepiej zapytać, niż zgadnąć.

${PROFILE_RULES}

Wskazówki do pól:
- caption_profile wybierz na podstawie grupy docelowej: kobiety 25–50 (beauty/bielizna/dom) → kobiety_25_50; młodzi do ~27 lat → gen_z; 50+ → 50_plus; pozostali / rodzice → uniwersalny.
- colors: wybierz z kandydatów kolorów (theme-color, zmienne CSS, najczęstsze barwy) te, które są kolorami marki, a nie szarościami interfejsu. caption_text: kolor marki, jeśli dobrze czyta się na wideo; w przeciwnym razie #ffffff.
- tone_of_voice.example_phrases: cytuj prawdziwe zdania ze strony, jeśli brzmią jak marka.${knowledgeBlock(await brandKnowledge())}`;
}

// Everything the brand profile may rely on — shown to Claude and to the Controller.
export function brandEvidence(source: BrandSource | null, notes: string, answers: AnsweredQuestion[] = []): string {
  const parts: string[] = [];
  if (source) {
    const { home } = source;
    parts.push(
      `<zrodlo_strona>\n${JSON.stringify(
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
      )}\n</zrodlo_strona>`,
    );
  } else {
    parts.push("(Marka nie podała strony internetowej.)");
  }
  if (notes) parts.push(`<notatki_uzytkownika>\n${notes}\n</notatki_uzytkownika>`);
  const answered = answers.filter((a) => a.answer.trim());
  if (answered.length) {
    parts.push(`<odpowiedzi_uzytkownika>\n${JSON.stringify(answered.map(({ field, question, answer }) => ({ field, question, answer })), null, 1)}\n</odpowiedzi_uzytkownika>`);
  }
  return parts.join("\n\n");
}

export async function analyzeBrand(
  apiKey: string,
  input: { source: BrandSource | null; nameHint: string; notes: string },
): Promise<BrandAnalysis> {
  return structuredCall({
    apiKey,
    system: await systemPrompt(),
    schema: BrandAnalysisSchema,
    content: [
      {
        type: "text",
        text: `Zbuduj pierwszą wersję profilu marki${input.nameHint ? ` „${input.nameHint}”` : ""}. Zadaj pytania o wszystko, czego nie da się pewnie ustalić.\n\n${brandEvidence(input.source, input.notes)}`,
      },
    ],
  });
}

// Next round: user answers and manual edits, and/or the Controller's issues.
export async function refineBrand(
  apiKey: string,
  input: {
    profile: BrandProfile;
    answers: AnsweredQuestion[];
    source: BrandSource | null;
    notes: string;
    controlIssues?: ReviewIssue[];
    openQuestions?: Question[];
  },
): Promise<BrandDraft> {
  const pending = (input.openQuestions ?? []).length
    ? `\n\n<otwarte_pytania>\n${JSON.stringify(input.openQuestions, null, 1)}\n</otwarte_pytania>\nZachowaj otwarte pytania, które wciąż są aktualne.`
    : "";
  return structuredCall({
    apiKey,
    system: await systemPrompt(),
    schema: RefineSchema,
    content: [
      {
        type: "text",
        text: `Oto aktualny profil marki (z ręcznymi poprawkami użytkownika). Wpisz odpowiedzi użytkownika w odpowiednie pola, zachowaj jego poprawki, oceń kompletność i zadaj kolejne pytania tylko o to, czego nadal brakuje.\n\n<profil>\n${JSON.stringify(input.profile, null, 1)}\n</profil>\n\n${brandEvidence(input.source, input.notes, input.answers)}${pending}${controlIssuesBlock(input.controlIssues ?? [])}`,
      },
    ],
  });
}
