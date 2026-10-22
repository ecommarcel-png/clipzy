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
  questions: z.array(QuestionSchema).describe("0–3 pytań, tylko z dozwolonych tematów. Zwykle 0–2."),
  summary: z.string(),
  logo_url: z.string().describe("Najbardziej prawdopodobny adres logo spośród kandydatów ze źródła (pusty, jeśli żaden nie pasuje)."),
});
export type BrandAnalysis = z.infer<typeof BrandAnalysisSchema>;
export type BrandDraft = { profile: BrandProfile; questions: Question[]; summary: string };

const RefineSchema = BrandAnalysisSchema.omit({ logo_url: true });

async function systemPrompt() {
  return `Jesteś Reżyserem Clipzy — strategiem marki i kreacji reklamowych Meta Ads (rynek polski, e-commerce). Twoim zadaniem jest zbudować bezbłędny profil marki, z którego potem korzystają modele montujące reklamy wideo i graficzne. Tu nie ma miejsca na błędy — lepiej zapytać, niż zgadnąć.

${PROFILE_RULES}

Zakres: profil MARKI dotyczy marki i jej klientów — kim są, czego chcą, jakie mają problemy, jak marka mówi. NIE dotyczy konkretnego produktu. Nie pytasz o produkt (wygląd, działanie, warianty, przed/po, efekt WOW, porównania z konkurencją) — to osobny etap, profil produktu. Nawet jeśli sklep sprzedaje jeden produkt, tu opisujesz klientów i markę.

Wskazówki do pól:
- personas: 3–6 naprawdę różnych typów kupujących — to z nich powstaną różne kierunki reklam.
- target_audience.pains: co najmniej 8 konkretnych problemów; desires: co najmniej 5.
- caption_profile wybierz na podstawie grupy docelowej: kobiety 25–50 (beauty/bielizna/dom) → kobiety_25_50; młodzi do ~27 lat → gen_z; 50+ → 50_plus; pozostali / rodzice → uniwersalny.
- colors: wybierz z kandydatów kolorów (theme-color, zmienne CSS, najczęstsze barwy) te, które są kolorami marki, a nie szarościami interfejsu. caption_text: kolor marki, jeśli dobrze czyta się na wideo; w przeciwnym razie #ffffff.
- tone_of_voice.example_phrases: cytuj prawdziwe zdania ze strony, jeśli brzmią jak marka.${knowledgeBlock(
    await brandKnowledge(),
    "Wykorzystaj ją do zrozumienia klientów marki i jej pozycji (zasady marketingu, oferta, profil napisów). Rzeczy dotyczące konkretnego produktu i montażu (przed/po, efekt WOW, ujęcia) zostaw na etap produktu i sklejek.",
  )}`;
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
        text: `Zbuduj kompletny profil marki${input.nameHint ? ` „${input.nameHint}”` : ""} — sam, na podstawie źródeł. Pytania tylko wyjątkowo (maksymalnie 3, tylko z dozwolonych tematów).\n\n${brandEvidence(input.source, input.notes)}`,
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
    /** What the completeness rule says is still missing — fill it in yourself. */
    focus?: string[];
  },
): Promise<BrandDraft> {
  const focus = (input.focus ?? []).length
    ? `\n\n<do_uzupelnienia>\nW profilu wciąż brakuje: ${(input.focus ?? []).join(", ")}. Uzupełnij to sam, na podstawie źródeł i wiedzy o tej grupie klientów — nie zadawaj o to pytań.\n</do_uzupelnienia>`
    : "";
  const pending = (input.openQuestions ?? []).length
    ? `\n\n<otwarte_pytania>\n${JSON.stringify(input.openQuestions, null, 1)}\n</otwarte_pytania>\nTe pytania użytkownik już widzi — nie powtarzaj ich innymi słowami. Zostaw tylko te, które wciąż są naprawdę potrzebne.`
    : "";
  return structuredCall({
    apiKey,
    system: await systemPrompt(),
    schema: RefineSchema,
    content: [
      {
        type: "text",
        text: `Oto aktualny profil marki (z ręcznymi poprawkami użytkownika). Wpisz odpowiedzi użytkownika w odpowiednie pola, wykorzystaj je do rozbudowy person i problemów, zachowaj poprawki użytkownika. Nowe pytania tylko wyjątkowo (maksymalnie 3, nigdy powtórki).\n\n<profil>\n${JSON.stringify(input.profile, null, 1)}\n</profil>\n\n${brandEvidence(input.source, input.notes, input.answers)}${focus}${pending}${controlIssuesBlock(input.controlIssues ?? [])}`,
      },
    ],
  });
}
