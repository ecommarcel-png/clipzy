import { z } from "zod";
import type { FieldSection } from "./common";

// Everything the models need to speak in the brand's voice.
// Field descriptions double as instructions for Claude's structured output.

export const CAPTION_PROFILES = [
  { value: "kobiety_25_50", label: "Kobiety 25–50 (beauty, bielizna, dom) — min. 3 słowa na planszę, spokojnie, bez tandety" },
  { value: "gen_z", label: "Gen Z — dynamicznie, 1–3 słowa, pop, emoji, więcej efektów" },
  { value: "50_plus", label: "50+ — całe zdania, większy krój, tło pod tekstem" },
  { value: "uniwersalny", label: "Uniwersalny / rodzice — całe frazy, biały bold z cieniem" },
] as const;

export const BrandProfileSchema = z.object({
  name: z.string().describe("Nazwa marki."),
  tagline: z.string().describe("Jedno zdanie: czym jest marka i komu pomaga."),
  niche: z.string().describe("Nisza/kategoria, np. 'zabawki kreatywne', 'bielizna modelująca'."),
  products_overview: z.string().describe("Co marka sprzedaje (krótko)."),
  target_audience: z.object({
    gender: z.enum(["kobiety", "mężczyźni", "wszyscy"]),
    age_from: z.number().describe("Dolna granica wieku głównej grupy."),
    age_to: z.number().describe("Górna granica wieku głównej grupy."),
    description: z.string().describe("Kim dokładnie jest klient (sytuacja życiowa, styl życia)."),
    pains: z.array(z.string()).describe("Problemy i frustracje klienta, które marka rozwiązuje."),
    desires: z.array(z.string()).describe("Czego klient pragnie (efekt, emocja, status)."),
    objections: z.array(z.string()).describe("Typowe obiekcje przed zakupem."),
  }),
  caption_profile: z
    .enum(["kobiety_25_50", "gen_z", "50_plus", "uniwersalny"])
    .describe("Profil stylu napisów w sklejkach — wynika z grupy docelowej (patrz baza wiedzy, rozdz. 6)."),
  tone_of_voice: z.object({
    description: z.string().describe("Jak marka mówi: 2-3 zdania."),
    address_form: z.enum(["ty", "wy", "pan_pani", "bezosobowo"]).describe("Forma zwracania się do klienta."),
    energy: z.enum(["spokojna", "umiarkowana", "wysoka"]),
    words_to_use: z.array(z.string()).describe("Słowa/zwroty typowe dla marki."),
    words_to_avoid: z.array(z.string()).describe("Słowa, których marka nie używa."),
    example_phrases: z.array(z.string()).describe("2-5 przykładowych zdań w głosie marki (z jej strony, jeśli są)."),
  }),
  colors: z.object({
    primary: z.string().describe("Główny kolor marki (hex, np. #ff5a36)."),
    secondary: z.string().describe("Drugi kolor (hex)."),
    accent: z.string().describe("Kolor akcentu do wyróżnień w napisach (hex)."),
    caption_text: z.string().describe("Kolor tekstu napisów na wideo (hex) — kolor marki, jeśli czytelny; inaczej biały."),
  }),
  typography_style: z.string().describe("Charakter kroju pisma marki, np. 'bold sans, nowoczesny' albo 'elegancki szeryf'."),
  usps: z.array(z.string()).describe("Unikalne przewagi marki/oferty."),
  risk_reversal: z.array(z.string()).describe("Gwarancje, zwroty, darmowa dostawa itp."),
  social_proof: z.array(z.string()).describe("Liczby i dowody: klienci, oceny, media, nagrody."),
  typical_offers: z.array(z.string()).describe("Typowe promocje: 2+1, -X zł, darmowa dostawa od…"),
  forbidden_claims: z.array(z.string()).describe("Czego nie wolno obiecywać ani mówić (prawnie lub wizerunkowo)."),
  music_mood_default: z.string().describe("Domyślny nastrój muzyki w reklamach marki."),
  competitors: z.array(z.string()).describe("Konkurenci lub alternatywy, z którymi klient porównuje."),
  notes: z.string().describe("Inne ważne informacje dla twórcy reklam."),
});

export type BrandProfile = z.infer<typeof BrandProfileSchema>;

export const EMPTY_BRAND_PROFILE: BrandProfile = {
  name: "",
  tagline: "",
  niche: "",
  products_overview: "",
  target_audience: { gender: "wszyscy", age_from: 18, age_to: 65, description: "", pains: [], desires: [], objections: [] },
  caption_profile: "uniwersalny",
  tone_of_voice: { description: "", address_form: "ty", energy: "umiarkowana", words_to_use: [], words_to_avoid: [], example_phrases: [] },
  colors: { primary: "#000000", secondary: "#ffffff", accent: "#ff5a36", caption_text: "#ffffff" },
  typography_style: "",
  usps: [],
  risk_reversal: [],
  social_proof: [],
  typical_offers: [],
  forbidden_claims: [],
  music_mood_default: "",
  competitors: [],
  notes: "",
};

export const BRAND_FORM: FieldSection[] = [
  {
    title: "Podstawy",
    fields: [
      { path: "name", label: "Nazwa marki", type: "text" },
      { path: "tagline", label: "Czym jest marka (jedno zdanie)", type: "textarea" },
      { path: "niche", label: "Nisza", type: "text" },
      { path: "products_overview", label: "Co sprzedaje", type: "textarea" },
    ],
  },
  {
    title: "Grupa docelowa",
    description: "Od tego zależy styl napisów, tempo montażu i ton reklam.",
    fields: [
      {
        path: "target_audience.gender",
        label: "Płeć",
        type: "select",
        options: [
          { value: "kobiety", label: "Kobiety" },
          { value: "mężczyźni", label: "Mężczyźni" },
          { value: "wszyscy", label: "Wszyscy" },
        ],
      },
      { path: "target_audience.age_from", label: "Wiek od", type: "number" },
      { path: "target_audience.age_to", label: "Wiek do", type: "number" },
      { path: "target_audience.description", label: "Kim jest klient", type: "textarea" },
      { path: "target_audience.pains", label: "Problemy klienta", hint: "Jeden w linii.", type: "list" },
      { path: "target_audience.desires", label: "Pragnienia klienta", hint: "Jedno w linii.", type: "list" },
      { path: "target_audience.objections", label: "Obiekcje przed zakupem", hint: "Jedna w linii.", type: "list" },
    ],
  },
  {
    title: "Styl i komunikacja",
    fields: [
      {
        path: "caption_profile",
        label: "Profil napisów w sklejkach",
        type: "select",
        options: CAPTION_PROFILES.map((p) => ({ value: p.value, label: p.label })),
      },
      { path: "tone_of_voice.description", label: "Ton komunikacji", type: "textarea" },
      {
        path: "tone_of_voice.address_form",
        label: "Forma zwracania się",
        type: "select",
        options: [
          { value: "ty", label: "Na „ty”" },
          { value: "wy", label: "Na „wy”" },
          { value: "pan_pani", label: "Pan / Pani" },
          { value: "bezosobowo", label: "Bezosobowo" },
        ],
      },
      {
        path: "tone_of_voice.energy",
        label: "Energia",
        type: "select",
        options: [
          { value: "spokojna", label: "Spokojna" },
          { value: "umiarkowana", label: "Umiarkowana" },
          { value: "wysoka", label: "Wysoka" },
        ],
      },
      { path: "tone_of_voice.words_to_use", label: "Słowa typowe dla marki", type: "list" },
      { path: "tone_of_voice.words_to_avoid", label: "Słowa zakazane", type: "list" },
      { path: "tone_of_voice.example_phrases", label: "Przykładowe zdania w głosie marki", type: "list" },
      { path: "typography_style", label: "Charakter kroju pisma", type: "text" },
      { path: "music_mood_default", label: "Domyślny nastrój muzyki", type: "text" },
    ],
  },
  {
    title: "Kolory",
    description: "Kolor napisów idzie z palety marki; profil napisów decyduje o reszcie stylu.",
    fields: [
      { path: "colors.primary", label: "Główny", type: "color" },
      { path: "colors.secondary", label: "Drugi", type: "color" },
      { path: "colors.accent", label: "Akcent (wyróżnienia)", type: "color" },
      { path: "colors.caption_text", label: "Tekst napisów", type: "color" },
    ],
  },
  {
    title: "Oferta i zaufanie",
    fields: [
      { path: "usps", label: "Unikalne przewagi", type: "list" },
      { path: "risk_reversal", label: "Gwarancje i odwrócenie ryzyka", type: "list" },
      { path: "social_proof", label: "Dowód społeczny", type: "list" },
      { path: "typical_offers", label: "Typowe promocje", type: "list" },
      { path: "forbidden_claims", label: "Czego nie wolno obiecywać", type: "list" },
      { path: "competitors", label: "Konkurenci / alternatywy", type: "list" },
      { path: "notes", label: "Inne uwagi", type: "textarea" },
    ],
  },
];
