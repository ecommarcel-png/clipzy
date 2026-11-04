import { z } from "zod";

// Image ad layouts: what each one needs from the agents and how much text fits.
// Pure (no React), shared by the agents (schemas), the renderer and the quick edit.

export const AD_ICONS = [
  "check", "cross", "star", "heart", "shield", "leaf", "sparkle", "drop", "clock", "bolt", "truck", "gift",
  "percent", "moon", "sun", "snow", "fire", "award", "thumb", "smile", "lock", "box", "money", "battery",
  "hand", "phone", "home", "car", "paw", "baby", "muscle", "brain", "wind", "chemical", "loop", "pain",
] as const;
export type AdIcon = (typeof AD_ICONS)[number];

export const TEMPLATES = [
  "hero_benefits", "before_after", "callouts", "us_vs_them", "sticky_notes", "whiteboard",
  "handwritten_note", "listicle", "offer", "testimonial", "problem_solution", "question_hook",
] as const;
export type TemplateKey = (typeof TEMPLATES)[number];

export const AD_FORMATS = ["1x1", "9x16"] as const;
export type AdFormat = (typeof AD_FORMATS)[number];
export const AD_SIZE: Record<AdFormat, { width: number; height: number }> = { "1x1": { width: 1080, height: 1080 }, "9x16": { width: 1080, height: 1920 } };

/** What a layout is for — shown to the Strateg, who picks the layouts for a set. */
export const TEMPLATE_INFO: Record<TemplateKey, { label: string; when: string; photos: 0 | 1 | 2; cutout: boolean }> = {
  hero_benefits: { label: "Produkt + korzyści z ikonami", when: "uniwersalny: mocny nagłówek, produkt w scenie, 3–4 korzyści z ikonami, CTA, pasek zaufania (Ceramikker, Raypath Detox)", photos: 1, cutout: false },
  before_after: { label: "Przed / po", when: "produkt daje widoczny efekt — najmocniejszy visual; ekran dzielony PRZED | PO pokazuje EFEKT na tym, na co działa produkt (skóra nóg, włosy, szyba), ten sam kadr; produkt jest wygenerowany w scenie PO, nigdy doklejony (Ceramikker Zero Ice, EcoBen, Hairup)", photos: 2, cutout: false },
  callouts: { label: "Strzałki do cech", when: "produkt fizyczny z konkretnymi cechami; packshot na środku, 3–4 podpisy ze strzałkami (LALU, Senaria, Torriden)", photos: 0, cutout: true },
  us_vs_them: { label: "My kontra inni", when: "jest wyraźna przewaga nad typowym zamiennikiem; dwie kolumny ✕ / ✓ (Mood Magic, PsiBufet)", photos: 0, cutout: true },
  sticky_notes: { label: "Karteczki post-it", when: "naturalne zdjęcie produktu na blacie + 2–3 odręczne karteczki: problem, gwarancja, promocja (Benilo, Orthomax)", photos: 1, cutout: false },
  whiteboard: { label: "Tablica z markerem", when: "edukacja / ból: odręczne hasło na tablicy, produkt obok, czerwony pasek z ofertą (PressGrip, Noom)", photos: 1, cutout: false },
  handwritten_note: { label: "Notatka odręczna", when: "emocje, prezent, historia klienta: produkt w dłoni w prawdziwym otoczeniu + kartka z odręcznym zdaniem (Memoralia)", photos: 1, cutout: false },
  listicle: { label: "Lista „5 znaków, że…”", when: "problem z objawami; numerowana lista objawów + zdjęcie osoby + rozwiązanie (Natural.pl Menopauza)", photos: 1, cutout: false },
  offer: { label: "Oferta / promocja", when: "jest realna promocja, zestaw, gratis lub cena; duża plakietka rabatu, cena, korzyści oferty, pilność (Majwas, Senaria)", photos: 1, cutout: false },
  testimonial: { label: "Opinia klienta", when: "TYLKO gdy w social_proof jest prawdziwa opinia: gwiazdki, cytat, autor (Zenevo)", photos: 1, cutout: false },
  problem_solution: { label: "Problem → rozwiązanie", when: "wyraźny ból codzienny: góra problem (✕), dół produkt jako rozwiązanie (PsiBufet, Your problems / our solution)", photos: 2, cutout: false },
  question_hook: { label: "Pytanie-hak na zdjęciu", when: "lifestyle / emocja: pełnoekranowe, klimatyczne zdjęcie i duże pytanie z wyróżnionym słowem (VizOro, Kosmos)", photos: 1, cutout: false },
};

const s = (max: number) => z.string().trim().max(max * 2).transform((v) => clip(v, max));
const opt = (max: number) => z.string().trim().max(max * 2).optional().default("").transform((v) => clip(v, max));
const icon = z.string().transform((v): AdIcon => ((AD_ICONS as readonly string[]).includes(v) ? (v as AdIcon) : "check"));
const benefit = z.object({ icon, text: s(42) });
const list = <T extends z.ZodType>(item: T, min: number, max: number) => z.array(item).min(min).transform((v) => v.slice(0, max));

/** Text on the graphic, per layout. Limits keep text readable at 1080 px; longer text is cut, not rejected. */
export const FIELDS = {
  hero_benefits: z.object({ eyebrow: opt(40), headline: s(60), benefits: list(benefit, 2, 4), cta: s(22), badge: opt(14), trust: list(s(28), 0, 3).optional().default([]) }),
  before_after: z.object({ headline: s(56), before_label: s(12), after_label: s(12), benefits: list(benefit, 0, 4).optional().default([]), cta: s(22), badge: opt(14) }),
  callouts: z.object({ headline: s(52), subheadline: opt(70), callouts: list(s(40), 3, 4), cta: s(22), badge: opt(14) }),
  us_vs_them: z.object({ headline: s(52), ours_label: s(22), theirs_label: s(22), rows: list(z.object({ ours: s(36), theirs: s(36) }), 3, 5), cta: s(22) }),
  sticky_notes: z.object({ notes: list(s(60), 2, 3), headline: opt(44), badge: opt(14) }),
  whiteboard: z.object({ headline: s(40), lines: list(s(34), 2, 4), banner: s(40), sub_banner: opt(36) }),
  handwritten_note: z.object({ note: s(90), caption: opt(50) }),
  listicle: z.object({ headline: s(60), items: list(s(40), 3, 5), question: opt(30), solution: s(60), cta: s(22) }),
  offer: z.object({ headline: s(52), offer: s(16), old_price: opt(14), new_price: opt(14), perks: list(s(32), 2, 3), urgency: opt(44), cta: s(22) }),
  testimonial: z.object({ quote: s(160), author: s(30), rating_note: opt(44), cta: s(22) }),
  problem_solution: z.object({ problem_label: s(18), problem: s(70), solution_label: s(18), solution: s(70), cta: s(22) }),
  question_hook: z.object({ question: s(64), sub: opt(70), cta: s(22) }),
} satisfies Record<TemplateKey, z.ZodType>;

export type Fields<K extends TemplateKey = TemplateKey> = z.infer<(typeof FIELDS)[K]>;

/** Look of one creative: decided by the Grafik, tweakable in quick edit. */
export const StyleSchema = z.object({
  theme: z.enum(["light", "dark", "brand"]).default("light"),
  font: z.enum(["anton", "inter", "bricolage"]).default("inter"),
  /** words of the headline drawn in the accent colour */
  highlight: z.array(z.string()).max(4).default([]),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#ff5a36"),
  /** where the subject sits in the photo — keeps it in frame when cropped */
  focus: z.enum(["center", "top", "bottom", "left", "right"]).default("center"),
});
export type AdStyle = z.infer<typeof StyleSchema>;

export function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max + 1);
  const at = cut.lastIndexOf(" ");
  return (at > max * 0.6 ? cut.slice(0, at) : t.slice(0, max)).replace(/[\s,;:–-]+$/, "");
}

/** Validated text for a layout, or null when the agent's output can't be used at all. */
export function parseFields<K extends TemplateKey>(key: K, raw: unknown): Fields<K> | null {
  const r = FIELDS[key].safeParse(raw);
  return r.success ? (r.data as Fields<K>) : null;
}

export const photoSlots = (key: TemplateKey) => TEMPLATE_INFO[key].photos;
export const usesCutout = (key: TemplateKey) => TEMPLATE_INFO[key].cutout;

// Rough average glyph width (em) for the fonts in assets/fonts — enough to pick a size that fits.
const GLYPH: Record<string, number> = { anton: 0.43, inter: 0.6, bricolage: 0.56, caveat: 0.42, body: 0.53 };

/** Largest font size (between min and max) at which the text wraps into at most `lines` lines of `width` px. */
export function fitFont(text: string, o: { font: keyof typeof GLYPH; width: number; lines: number; max: number; min: number; upper?: boolean }): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const widen = o.upper ? 1.12 : 1;
  for (let size = o.max; size > o.min; size -= 2) {
    const perLine = o.width / (size * GLYPH[o.font] * widen);
    let lines = 1;
    let used = 0;
    for (const w of words) {
      const len = w.length + (used ? 1 : 0);
      if (used + len <= perLine) used += len;
      else {
        lines++;
        used = w.length;
        if (w.length > perLine) lines += Math.floor(w.length / perLine);
      }
    }
    if (lines <= o.lines) return size;
  }
  return o.min;
}

/** What each field means — for the Copywriter and the Kontroler. */
export const FIELD_GUIDE: Record<TemplateKey, string> = {
  hero_benefits: "eyebrow: krótki nadtytuł (np. „Nowość”, kategoria) albo puste; headline: nagłówek 3–8 słów; benefits: 2–4 × {icon, text} korzyść 2–5 słów; cta; badge: plakietka max 8 znaków (np. „-40%”, „1+1”) TYLKO z realnej oferty, inaczej puste — bez ceny i dwukropków; trust: 0–3 krótkie dowody/bezpieczeństwo zakupu z profilu (np. „Wysyłka 24h”).",
  before_after: "headline: efekt w 3–8 słowach; before_label/after_label: np. „PRZED”/„PO”; benefits: 0–4 × {icon, text}; cta; badge: krótka realna oferta, max 8 znaków (np. „-33%”), albo puste — bez ceny i dwukropków.",
  callouts: "headline; subheadline: 1 zdanie co to jest albo puste; callouts: 3–4 cechy konstrukcji/składu, 2–5 słów każda; cta; badge.",
  us_vs_them: "headline; ours_label: nazwa produktu/marki; theirs_label: zamiennik (np. „Zwykłe szczoteczki”, „Sucha karma”); rows: 3–5 × {ours, theirs} — ta sama cecha z dwóch stron, krótko; cta.",
  sticky_notes: "notes: 2–3 karteczki pisane ręcznie (ból/sytuacja, gwarancja, zachęta), max ~10 słów każda; headline: zwykle puste; badge: ostatnia karteczka z ofertą (np. „DZIŚ -38%”) albo puste.",
  whiteboard: "headline: pytanie/hasło markerem (np. „Boli cię bark?”); lines: 2–4 krótkie linie markerem (mechanizm, korzyść); banner: czerwony pasek z ofertą lub obietnicą; sub_banner: gwarancja albo puste.",
  handwritten_note: "note: jedno szczere zdanie pisane ręcznie, emocja lub historia klienta (max 90 znaków); caption: krótki podpis z produktem/CTA albo puste.",
  listicle: "headline: „N znaków, że…”/„N powodów…”; items: 3–5 objawów/powodów, 2–4 słowa; question: np. „Masz dość?” albo puste; solution: 1 zdanie z nazwą produktu; cta.",
  offer: "headline; offer: rabat/zestaw (np. „-40%”, „2+1”); old_price/new_price: TYLKO z profilu, inaczej puste; perks: 2–3 korzyści oferty (dostawa, gratis, zwrot); urgency: pilność zgodna z prawdą albo puste; cta.",
  testimonial: "quote: dosłowny fragment prawdziwej opinii z profilu (bez zmyślania); author: imię z opinii lub „Klientka”/„Klient”; rating_note: ocena/liczba opinii z profilu albo puste; cta.",
  problem_solution: "problem_label: np. „PROBLEM”; problem: ból w 1 zdaniu; solution_label: np. „ROZWIĄZANIE”; solution: jak produkt to rozwiązuje, 1 zdanie; cta.",
  question_hook: "question: pytanie-hak 3–7 słów; sub: 1 zdanie odpowiedzi z produktem albo puste; cta.",
};
