import { z } from "zod";
import type { FieldSection } from "./common";

// What the models need to sell one product: problem, mechanism, proof, offer.

export const ProductProfileSchema = z.object({
  name: z.string(),
  one_liner: z.string().describe("Jedno zdanie: co to jest i co daje."),
  category: z.string(),
  price: z.string().describe("Cena regularna (sama liczba lub z walutą)."),
  problem: z.string().describe("Główny problem klienta, który produkt rozwiązuje."),
  problem_visual: z.string().describe("Jak POKAZAĆ ten problem na wideo (konkretna scena)."),
  mechanism: z.string().describe("Unikalny mechanizm: dlaczego TEN produkt działa, a inne nie."),
  market_sophistication: z
    .string()
    .describe("Poziom wypalenia obietnicy na tym rynku (1-5) i co z tego wynika dla komunikatu — wg bazy wiedzy Meta Ads."),
  customer_language: z
    .array(z.string())
    .describe("Jak klienci SAMI opisują problem i efekt (cytaty z opinii, FAQ, odpowiedzi użytkownika). Tylko ze źródeł."),
  benefits: z.array(z.string()).describe("Korzyści dla klienta (efekty, nie cechy)."),
  features: z.array(z.string()).describe("Cechy i parametry (materiał, rozmiar, czas, liczby)."),
  wow_effect: z.object({
    exists: z.boolean().describe("Czy produkt ma efekt WOW, który warto pokazać w hooku."),
    description: z.string().describe("Na czym polega i jak go pokazać."),
  }),
  before_after: z.object({
    possible: z.boolean().describe("Czy da się uczciwie pokazać przed/po."),
    description: z.string().describe("Co pokazać jako 'przed' i co jako 'po'."),
  }),
  use_cases: z.array(z.string()).describe("Sytuacje użycia (gdzie, kiedy, kto)."),
  target_audience_note: z.string().describe("Czym grupa docelowa produktu różni się od grupy marki (puste, jeśli niczym)."),
  objections: z
    .array(z.object({ objection: z.string(), answer: z.string() }))
    .describe("Obiekcje klienta i jak je zbić."),
  offer: z.string().describe("Aktualna oferta / promocja na produkt."),
  social_proof: z.array(z.string()).describe("Opinie, oceny, liczba sprzedanych sztuk."),
  emotions: z.array(z.string()).describe("Główne emocje, w które celujemy (np. radość, ulga, nostalgia, duma)."),
  music_mood: z.string().describe("Nastrój muzyki dla tego produktu."),
  ad_angles: z.array(z.string()).describe("Kąty reklamowe do przetestowania (różne od siebie)."),
  hook_ideas: z.array(z.string()).describe("Pomysły na hooki (obraz + słowa)."),
  forbidden_claims: z.array(z.string()).describe("Czego nie wolno obiecywać o tym produkcie."),
  notes: z.string(),
});

export type ProductProfile = z.infer<typeof ProductProfileSchema>;

export const EMPTY_PRODUCT_PROFILE: ProductProfile = {
  name: "",
  one_liner: "",
  category: "",
  price: "",
  problem: "",
  problem_visual: "",
  mechanism: "",
  market_sophistication: "",
  customer_language: [],
  benefits: [],
  features: [],
  wow_effect: { exists: false, description: "" },
  before_after: { possible: false, description: "" },
  use_cases: [],
  target_audience_note: "",
  objections: [],
  offer: "",
  social_proof: [],
  emotions: [],
  music_mood: "",
  ad_angles: [],
  hook_ideas: [],
  forbidden_claims: [],
  notes: "",
};

export const PRODUCT_FORM: FieldSection[] = [
  {
    title: "Podstawy",
    fields: [
      { path: "name", label: "Nazwa produktu", type: "text" },
      { path: "one_liner", label: "Co to jest (jedno zdanie)", type: "textarea" },
      { path: "category", label: "Kategoria", type: "text" },
      { path: "price", label: "Cena", type: "text" },
      { path: "offer", label: "Aktualna oferta", type: "text" },
    ],
  },
  {
    title: "Problem i rozwiązanie",
    description: "Problem i przed/po napędzają CTR — klient musi zobaczyć swój problem i jego rozwiązanie.",
    fields: [
      { path: "problem", label: "Problem klienta", type: "textarea" },
      { path: "problem_visual", label: "Jak pokazać problem na wideo", type: "textarea" },
      { path: "mechanism", label: "Unikalny mechanizm (dlaczego działa)", type: "textarea" },
      { path: "market_sophistication", label: "Wypalenie rynku (poziom 1–5)", hint: "Ile razy klient słyszał już tę obietnicę od innych i co z tego wynika dla komunikatu.", type: "textarea" },
      { path: "customer_language", label: "Język klienta", hint: "Jak klienci sami opisują problem i efekt — jedno zdanie w linii.", type: "list" },
      { path: "before_after.possible", label: "Da się pokazać przed/po", type: "boolean" },
      { path: "before_after.description", label: "Przed/po — co pokazać", type: "textarea" },
      { path: "wow_effect.exists", label: "Produkt ma efekt WOW", type: "boolean" },
      { path: "wow_effect.description", label: "Efekt WOW — na czym polega", type: "textarea" },
    ],
  },
  {
    title: "Korzyści i dowody",
    fields: [
      { path: "benefits", label: "Korzyści", type: "list" },
      { path: "features", label: "Cechy i parametry", type: "list" },
      { path: "use_cases", label: "Sytuacje użycia", type: "list" },
      { path: "social_proof", label: "Dowód społeczny", type: "list" },
      {
        path: "objections",
        label: "Obiekcje i odpowiedzi",
        type: "pairs",
        keys: ["objection", "answer"],
        labels: ["Obiekcja", "Jak ją zbić"],
      },
    ],
  },
  {
    title: "Kreacja",
    fields: [
      { path: "target_audience_note", label: "Różnice w grupie docelowej względem marki", type: "textarea" },
      { path: "emotions", label: "Emocje", type: "list" },
      { path: "music_mood", label: "Nastrój muzyki", type: "text" },
      { path: "ad_angles", label: "Kąty reklamowe", type: "list" },
      { path: "hook_ideas", label: "Pomysły na hooki", type: "list" },
      { path: "forbidden_claims", label: "Czego nie wolno obiecywać", type: "list" },
      { path: "notes", label: "Inne uwagi", type: "textarea" },
    ],
  },
];
