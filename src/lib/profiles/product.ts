import { z } from "zod";
import type { FieldSection } from "./common";

// What the models need to sell one product. The "meat": the problems it
// solves and many distinct ad angles (persona × problem × awareness level).
// Facts (price, specs, offer) come from the product page automatically.

export const AdAngleSchema = z.object({
  angle: z.string().describe("Kąt reklamowy jednym zdaniem — główna myśl reklamy."),
  persona: z.string().describe("Do kogo (jedna z person marki albo konkretny typ klienta)."),
  problem: z.string().describe("Jaki problem/pragnienie bierze na celownik."),
  awareness: z
    .string()
    .describe("Poziom świadomości odbiorcy: nieświadomy / świadomy problemu / świadomy rozwiązania / świadomy produktu / najbardziej świadomy."),
  hook: z.string().describe("Gotowy hook: pierwsze zdanie + co widać w pierwszej sekundzie."),
});
export type AdAngle = z.infer<typeof AdAngleSchema>;

export const ProductProfileSchema = z.object({
  name: z.string(),
  one_liner: z.string().describe("Jedno zdanie: co to jest i co daje."),
  category: z.string(),
  price: z.string().describe("Cena regularna — ze strony."),
  problem: z.string().describe("Główny problem klienta, który produkt rozwiązuje — ostro i konkretnie."),
  problems: z.array(z.string()).describe("Wszystkie problemy, które produkt rozwiązuje — co najmniej 8, językiem klienta. Każdy to potencjalna reklama."),
  problem_visual: z.string().describe("Jak POKAZAĆ główny problem na wideo (konkretna scena)."),
  mechanism: z.string().describe("Unikalny mechanizm: dlaczego TEN produkt działa, a inne nie. Pewnie, jak dobry copywriter."),
  market_sophistication: z
    .string()
    .describe("Poziom wypalenia obietnicy na tym rynku (1-5) i co z tego wynika dla komunikatu — wg bazy wiedzy Meta Ads."),
  customer_language: z
    .array(z.string())
    .describe("Jak klienci opisują problem i efekt — cytaty z opinii/FAQ, jeśli są; inaczej typowe sformułowania tej grupy."),
  benefits: z.array(z.string()).describe("Korzyści dla klienta (efekty, nie cechy) — co najmniej 6."),
  features: z.array(z.string()).describe("Cechy i parametry — tylko ze strony."),
  wow_effect: z.object({
    exists: z.boolean().describe("Czy produkt ma efekt WOW, który warto pokazać w hooku (wniosek ze zdjęć i opisu)."),
    description: z.string().describe("Na czym polega i jak go pokazać."),
  }),
  before_after: z.object({
    possible: z.boolean().describe("Czy z natury produktu da się pokazać przed/po (potwierdzi to później analiza nagrań)."),
    description: z.string().describe("Co pokazać jako 'przed' i co jako 'po'."),
  }),
  use_cases: z.array(z.string()).describe("Sytuacje użycia (gdzie, kiedy, kto)."),
  target_audience_note: z.string().describe("Czym grupa docelowa produktu różni się od grupy marki (puste, jeśli niczym)."),
  objections: z
    .array(z.object({ objection: z.string(), answer: z.string() }))
    .describe("Obiekcje klienta i jak je zbić w reklamie — co najmniej 4."),
  offer: z.string().describe("Aktualna oferta / promocja — ze strony."),
  social_proof: z.array(z.string()).describe("Opinie, oceny, liczba sprzedanych sztuk — tylko ze strony."),
  emotions: z.array(z.string()).describe("Główne emocje, w które celujemy (np. radość, ulga, nostalgia, duma)."),
  music_mood: z.string().describe("Nastrój muzyki dla tego produktu."),
  ad_angles: z.array(AdAngleSchema).describe("10–15 kątów reklamowych, naprawdę różnych: różne persony, problemy, poziomy świadomości i emocje."),
  hook_ideas: z.array(z.string()).describe("Dodatkowe pomysły na hooki (obraz + słowa), poza tymi z kątów."),
  forbidden_claims: z.array(z.string()).describe("Czego nie wolno obiecywać o tym produkcie (prawo, zasady Meta)."),
  notes: z.string(),
});

export type ProductProfile = z.infer<typeof ProductProfileSchema>;

export const EMPTY_PRODUCT_PROFILE: ProductProfile = {
  name: "",
  one_liner: "",
  category: "",
  price: "",
  problem: "",
  problems: [],
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

// Profiles saved before angles became structured stored them as plain strings.
export function upgradeProductProfile(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const p = raw as Record<string, unknown>;
  if (Array.isArray(p.ad_angles)) {
    p.ad_angles = p.ad_angles.map((a) =>
      typeof a === "string" ? { angle: a, persona: "", problem: "", awareness: "", hook: "" } : a,
    );
  }
  return p;
}

export const PRODUCT_FORM: FieldSection[] = [
  {
    title: "Problemy, które rozwiązuje",
    description: "Najważniejsza część — każdy problem to potencjalna reklama.",
    fields: [
      { path: "name", label: "Nazwa produktu", type: "text" },
      { path: "one_liner", label: "Co to jest (jedno zdanie)", type: "text" },
      { path: "problem", label: "Główny problem", type: "textarea" },
      { path: "problems", label: "Wszystkie problemy", hint: "Jeden w linii, językiem klienta.", type: "list" },
      { path: "mechanism", label: "Dlaczego działa (unikalny mechanizm)", type: "textarea" },
      { path: "benefits", label: "Korzyści", hint: "Efekty, nie cechy. Jedna w linii.", type: "list" },
    ],
  },
  {
    title: "Kąty reklamowe",
    description: "Każdy kąt to osobna reklama: inna osoba, inny problem, inny poziom świadomości.",
    fields: [
      {
        path: "ad_angles",
        label: "Kąty",
        type: "records",
        keys: ["angle", "persona", "problem", "awareness", "hook"],
        labels: ["Kąt", "Do kogo", "Problem", "Poziom świadomości", "Hook"],
        addLabel: "+ Dodaj kąt",
      },
    ],
  },
  {
    title: "Na wideo",
    description: "Wnioski ze zdjęć i opisu — analiza nagrań potwierdzi je przy tworzeniu sklejki.",
    collapsed: true,
    fields: [
      { path: "problem_visual", label: "Jak pokazać problem na wideo", type: "textarea" },
      { path: "before_after.possible", label: "Da się pokazać przed/po", type: "boolean" },
      { path: "before_after.description", label: "Przed/po — co pokazać", type: "textarea" },
      { path: "wow_effect.exists", label: "Produkt ma efekt WOW", type: "boolean" },
      { path: "wow_effect.description", label: "Efekt WOW — na czym polega", type: "textarea" },
      { path: "use_cases", label: "Sytuacje użycia", type: "list" },
      { path: "emotions", label: "Emocje", type: "list" },
      { path: "music_mood", label: "Nastrój muzyki", type: "text" },
      { path: "hook_ideas", label: "Dodatkowe pomysły na hooki", type: "list" },
    ],
  },
  {
    title: "Obiekcje i rynek",
    collapsed: true,
    fields: [
      {
        path: "objections",
        label: "Obiekcje i odpowiedzi",
        type: "records",
        keys: ["objection", "answer"],
        labels: ["Obiekcja", "Jak ją zbić"],
        addLabel: "+ Dodaj obiekcję",
      },
      { path: "market_sophistication", label: "Wypalenie rynku (poziom 1–5)", type: "textarea" },
      { path: "customer_language", label: "Język klienta", hint: "Jedno zdanie w linii.", type: "list" },
      { path: "target_audience_note", label: "Różnice w grupie docelowej względem marki", type: "textarea" },
    ],
  },
  {
    title: "Ze strony produktu",
    description: "Pobrane automatycznie.",
    collapsed: true,
    fields: [
      { path: "category", label: "Kategoria", type: "text" },
      { path: "price", label: "Cena", type: "text" },
      { path: "offer", label: "Aktualna oferta", type: "text" },
      { path: "features", label: "Cechy i parametry", type: "list" },
      { path: "social_proof", label: "Dowód społeczny", type: "list" },
      { path: "forbidden_claims", label: "Czego nie wolno obiecywać", type: "list" },
      { path: "notes", label: "Inne uwagi", type: "textarea" },
    ],
  },
];
