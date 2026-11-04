import "server-only";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { structuredCall } from "./claude";
import { imageAdsKnowledge, knowledgeText } from "@/lib/knowledge";
import type { BrandProfile } from "@/lib/profiles/brand";
import type { ProductProfile } from "@/lib/profiles/product";
import { FIELDS, FIELD_GUIDE, TEMPLATES, TEMPLATE_INFO, clip, photoSlots, usesCutout, type AdStyle, type Fields, type TemplateKey } from "@/lib/image-ads/templates";
import { allowedTemplates, balanceConcepts, beforeAfterTarget, type Allowed, type Concept } from "@/lib/image-ads/concepts";

// The image ads team: Strateg → Copywriter → Fotograf + Grafik → Kontroler.
// Every agent reads the same brand/product context and the image ads knowledge base.

export type AdContext = {
  brand: BrandProfile & { name: string };
  product: (ProductProfile & { name: string }) | null;
  /** colours the Grafik may use as the accent (logo + brand profile) */
  palette: string[];
  hasProductPhotos: boolean;
  allowed: Allowed;
  /** "Wskazówki dla zespołu" typed by the user — top priority for every agent */
  brief: string;
};

export type AdCopy = { primary_text: string; headline: string; description: string };

function contextBlock(ctx: AdContext): string {
  const b = ctx.brand;
  const brand = {
    nazwa: b.name, kim_jest: b.tagline, nisza: b.niche, grupa: b.target_audience, persony: b.personas,
    ton: b.tone_of_voice, przewagi: b.usps, bezpieczenstwo_zakupu: b.risk_reversal, dowody: b.social_proof,
    typowe_oferty: b.typical_offers, zakazane: b.forbidden_claims, konkurencja: b.competitors, preferencje: b.learned_preferences, uwagi: b.notes,
  };
  const p = ctx.product;
  const product = p
    ? {
        nazwa: p.name, w_skrocie: p.one_liner, kategoria: p.category, cena: p.price, problem: p.problem, problemy: p.problems,
        mechanizm: p.mechanism, korzysci: p.benefits, cechy: p.features, efekt_wow: p.wow_effect, przed_po: p.before_after,
        uzycie: p.use_cases, obiekcje: p.objections, oferta: p.offer, opinie_i_dowody: p.social_proof, emocje: p.emotions,
        katy: p.ad_angles.map((a) => ({ kat: a.angle, persona: a.persona, problem: a.problem })), zakazane: p.forbidden_claims,
      }
    : null;
  const brief = ctx.brief ? `\n<wskazowki_uzytkownika priorytet="najwyższy">${ctx.brief}</wskazowki_uzytkownika>` : "";
  return `<marka>${JSON.stringify(brand)}</marka>\n<produkt>${JSON.stringify(product ?? "brak — reklamy marki")}</produkt>${brief}`;
}

const PRIORITY = "Wskazówki użytkownika (<wskazowki_uzytkownika>) i pole note w koncepcie kreacji to polecenia od właściciela marki — mają pierwszeństwo przed wszystkim innym, także przed bazą wiedzy.";

async function system(role: string) {
  return `${role}\n${PRIORITY}\n\n${knowledgeText(await imageAdsKnowledge())}`;
}

// ---------- 1) Strateg ----------

const ConceptSchema = z.object({
  template: z.enum(TEMPLATES),
  angle: z.string().describe("kąt: persona × problem × poziom świadomości, 1 zdanie"),
  persona: z.string(),
  awareness: z.string().describe("poziom świadomości odbiorcy"),
  visual: z.string().describe("co ma być na zdjęciu, po polsku, konkretnie"),
  idea: z.string().describe("główna myśl grafiki / kierunek nagłówka"),
});

export async function planConcepts(apiKey: string, ctx: AdContext, count: number): Promise<Concept[]> {
  const allowed = allowedTemplates(ctx.allowed);
  const templates = allowed.map((t) => ({ szablon: t, nazwa: TEMPLATE_INFO[t].label, kiedy: TEMPLATE_INFO[t].when }));
  const r = await structuredCall({
    apiKey,
    system: await system("Jesteś Strategiem reklam statycznych Clipzy (Meta Ads, rynek polski). Planujesz zestaw różnych kreacji, z których każda testuje inny kąt."),
    schema: z.object({ concepts: z.array(ConceptSchema).min(1).max(20) }),
    maxTokens: 8000,
    content: [{
      type: "text",
      text: `${contextBlock(ctx)}\n<szablony>${JSON.stringify(templates)}</szablony>\n\nZaplanuj dokładnie ${count} kreacji. Zasady:
- Używaj TYLKO szablonów z listy. Nie powtarzaj szablonu, dopóki nie użyjesz pozostałych pasujących do produktu.
${ctx.allowed.beforeAfter ? `- PRZED/PO TO PRIORYTET: pierwsza kreacja to before_after, a w całym zestawie ${beforeAfterTarget(count, true)} z ${count} to before_after. KAŻDE before_after pokazuje INNY problem z profilu produktu i ze wskazówek użytkownika (np. jedno ogólne przed/po, kolejne: konkretny problem → efekt). W polu visual opisz dokładnie „PRZED: … / PO: …” — ta sama część ciała / ten sam przedmiot, ten sam kadr.` : "- Produkt nie ma efektu przed/po — nie używaj before_after."}
- Najpierw najważniejsze problemy klienta z profilu i wskazówek — żaden kluczowy problem nie może zostać pominięty.
- before_after pokazuje EFEKT NA TYM, NA CO DZIAŁA PRODUKT (skóra, włosy, szyba, plama…), w zbliżeniu — nigdy metaforę ani sytuację dookoła (kosmetyczka, szafa, sypialnia, biurko, wanna). Różne before_after = różne problemy tego samego obiektu (np. truskawkowe nogi, odrosty, podrażnienia, wrastające włoski).
- Każda kreacja: inny kąt (ból, efekt, oferta, porównanie, emocja/prezent, edukacja, dowód). Pierwsza = najmocniejszy kąt.
- Pole visual opisuje zdjęcie, które zrobi AI${ctx.hasProductPhotos ? " (mamy zdjęcia produktu jako wzór)" : " (brak zdjęć produktu — produkt opisz słowami)"}.`,
    }],
  });
  return balanceConcepts(r.concepts, count, ctx.allowed);
}

// ---------- 2) Copywriter ----------

const CopySchema = z.object({
  primary_text: z.string().max(1800).transform((v) => v.trim().slice(0, 900)),
  headline: z.string().max(120).transform((v) => clip(v, 40)),
  description: z.string().max(90).transform((v) => clip(v, 30)),
});

type Item = { key: string; template: TemplateKey; concept: Concept };

export async function writeCopy(apiKey: string, ctx: AdContext, items: Item[]): Promise<Record<string, { fields: Fields; copy: AdCopy }>> {
  const schema = z.object(Object.fromEntries(items.map((i) => [i.key, z.object({ fields: FIELDS[i.template], copy: CopySchema })])));
  const brief = items.map((i) => ({ id: i.key, szablon: i.template, pola: FIELD_GUIDE[i.template], koncept: i.concept }));
  const r = await structuredCall({
    apiKey,
    system: await system("Jesteś Copywriterem Clipzy. Piszesz teksty NA grafikę (pola szablonu) i copy reklamy Meta (tekst główny, nagłówek, opis) po polsku."),
    schema,
    io: "input",
    maxTokens: 12000,
    content: [{ type: "text", text: `${contextBlock(ctx)}\n<kreacje>${JSON.stringify(brief)}</kreacje>\n\nDla każdej kreacji (klucz = id) oddaj fields zgodnie z opisem pól szablonu oraz copy. Teksty na grafice krótkie i czytelne na telefonie.
PROSTO: nagłówek mówi wprost, co klient dostaje albo jaki problem znika, słowami klienta („Ogolone nogi w jeden wieczór”, „Koniec z truskawkowymi nogami”). Żadnych metafor, porównań, gier słów ani okoliczności dookoła („Nogi gotowe na urlop…” ✗, „Gumka do ścierania dla nóg” ✗). Jedna myśl na grafikę. Ikony korzyści wybieraj z listy dozwolonych. Nie wymyślaj liczb, cen, promocji, gwarancji ani opinii spoza profilu.` }],
  });
  return r as Record<string, { fields: Fields; copy: AdCopy }>;
}

// ---------- 3) Fotograf ----------

export type PhotoBrief = { prompt: string; with_product: boolean };

const PhotoSchema = z.object({
  photos: z.array(z.object({
    prompt: z.string().describe("prompt po angielsku dla modelu obrazu, fotorealistyczny, kwadrat 1:1, główny obiekt na środku, bez tekstu"),
    with_product: z.boolean().describe("czy w kadrze jest produkt (wtedy dostajesz zdjęcia produktu jako wzór)"),
  })),
  focus: z.enum(["center", "top", "bottom", "left", "right"]).describe("gdzie na zdjęciu jest główny obiekt"),
});

/** How many AI photos a creative needs (packshot layouts need one when there's no product without background). */
export function photosNeeded(template: TemplateKey, cutout: boolean): number {
  return photoSlots(template) || (usesCutout(template) && !cutout ? 1 : 0);
}

const SLOT_HINT: Partial<Record<TemplateKey, string>> = {
  before_after: "2 zdjęcia, KOLEJNOŚĆ WAŻNA. Pokazujesz EFEKT na tym, na co działa produkt (dla depilatora: skóra nóg w zbliżeniu; dla kosmetyku: twarz/włosy; dla środka do szyb: szyba) — NIGDY metafora (kosmetyczka, szafa, sypialnia, biurko, wanna). [1] PO = zbliżenie wypełniające kadr z efektem (gładka skóra) ORAZ prawdziwy produkt ze zdjęć referencyjnych położony logicznie w scenie obok (np. leży na ręczniku obok łydki), nie w dłoni; with_product = true. [0] PRZED = polecenie EDYCJI zdjęcia PO, po angielsku: \"Edit this photo: remove the product completely (fill the area naturally); keep the exact same leg, framing, light and background; add clearly visible <problem: e.g. strawberry legs — dense dark dots in every pore, dark stubble regrowth across the whole calf, red razor bumps>. Make the problem obvious even at small size, realistic.\"",
  problem_solution: "2 zdjęcia: [0] problem bez produktu, [1] produkt rozwiązuje problem w tej samej sytuacji.",
  hero_benefits: "1 zdjęcie: produkt w scenie użycia; w 1:1 tekst jest po lewej, więc produkt/obiekt w prawej-środkowej części, spokojne tło po lewej.",
  sticky_notes: "1 zdjęcie: produkt leży na naturalnej powierzchni (blat, podłoga), z góry, wokół wolne miejsce na karteczki.",
  whiteboard: "1 zdjęcie: produkt w dłoni / w użyciu, zbliżenie.",
  handwritten_note: "1 zdjęcie: produkt w dłoni w prawdziwym otoczeniu, ciepłe światło; górna część kadru spokojna (tam kartka).",
  listicle: "1 zdjęcie: osoba z grupy docelowej w sytuacji problemu, portret, autentycznie.",
  offer: "1 zdjęcie: produkt jako bohater (z rekwizytami / opakowaniem / zestawem).",
  testimonial: "1 zdjęcie: produkt w użyciu, lifestyle; górna część kadru ciemniejsza, spokojna (tam cytat).",
  question_hook: "1 zdjęcie: klimatyczna scena lifestyle z osobą i produktem; obiekt w górnej połowie, dół ciemny i spokojny (tam pytanie).",
  callouts: "1 zdjęcie: packshot produktu na jednolitym jasnym tle, cały produkt w kadrze.",
  us_vs_them: "1 zdjęcie: packshot produktu na jednolitym jasnym tle, cały produkt w kadrze.",
};

/** `cutout`: a product without background is ready — packshot layouts then need no photo. */
export async function photoPrompts(apiKey: string, ctx: AdContext, items: Array<Item & { fields: Fields }>, cutout: boolean): Promise<Record<string, { photos: PhotoBrief[]; focus: AdStyle["focus"] }>> {
  const need = items.filter((i) => photosNeeded(i.template, cutout) > 0);
  if (!need.length) return {};
  const schema = z.object(Object.fromEntries(need.map((i) => [i.key, PhotoSchema])));
  const brief = need.map((i) => ({ id: i.key, szablon: i.template, ile_zdjec: photosNeeded(i.template, cutout), wskazowki: SLOT_HINT[i.template] ?? "", koncept: i.concept, teksty: i.fields }));
  const r = await structuredCall({
    apiKey,
    system: await system("Jesteś Fotografem Clipzy. Piszesz prompty do modelu obrazu (fal.ai nano-banana) dla zdjęć do reklam statycznych."),
    schema,
    maxTokens: 6000,
    content: [{ type: "text", text: `${contextBlock(ctx)}\n<kreacje>${JSON.stringify(brief)}</kreacje>\n\nDla każdej kreacji oddaj dokładnie tyle zdjęć, ile ile_zdjec. ${ctx.hasProductPhotos ? "Gdy produkt jest w kadrze: \"the exact product from the reference images, unchanged shape, colors, label and logo\"." : "Nie mamy zdjęć produktu — opisz produkt słowami dokładnie wg profilu."} Każdy prompt kończ: "photorealistic, square 1:1, no text, no letters, no captions, no watermark".` }],
  });
  const out: Record<string, { photos: PhotoBrief[]; focus: AdStyle["focus"] }> = {};
  for (const i of need) {
    const v = (r as Record<string, z.infer<typeof PhotoSchema>>)[i.key];
    const n = photosNeeded(i.template, cutout);
    const photos = v.photos.slice(0, n);
    while (photos.length < n) photos.push(photos[photos.length - 1] ?? { prompt: i.concept.visual, with_product: ctx.hasProductPhotos });
    out[i.key] = { photos: photos.map((p) => ({ prompt: p.prompt, with_product: p.with_product && ctx.hasProductPhotos })), focus: v.focus };
  }
  return out;
}

// ---------- 4) Grafik ----------

const DesignSchema = z.object({
  theme: z.enum(["light", "dark", "brand"]).describe("light = jasne tło, dark = ciemne premium, brand = tło w kolorze marki"),
  font: z.enum(["anton", "inter", "bricolage"]).describe("anton = wąski, krzykliwy, CAPS (promo, auto, narzędzia); inter = czytelny, nowoczesny; bricolage = miękki, lifestyle/beauty"),
  highlight: z.array(z.string()).max(3).describe("1–2 słowa z nagłówka do wyróżnienia kolorem akcentu (dokładnie jak w nagłówku)"),
  accent: z.string().describe("kolor akcentu — jeden z palety"),
});

export async function designStyles(apiKey: string, ctx: AdContext, items: Array<Item & { fields: Fields }>): Promise<Record<string, Omit<AdStyle, "focus">>> {
  const schema = z.object(Object.fromEntries(items.map((i) => [i.key, DesignSchema])));
  const brief = items.map((i) => ({ id: i.key, szablon: i.template, koncept: i.concept.idea, note: i.concept.note, teksty: i.fields }));
  const r = await structuredCall({
    apiKey,
    system: await system("Jesteś Grafikiem Clipzy. Dobierasz wygląd kreacji: motyw, krój nagłówka, wyróżnione słowa i kolor akcentu — spójnie z marką, różnorodnie w zestawie."),
    schema,
    maxTokens: 3000,
    content: [{ type: "text", text: `${contextBlock(ctx)}\n<paleta>${JSON.stringify(ctx.palette)}</paleta>\n<kreacje>${JSON.stringify(brief)}</kreacje>\n\nDla każdej kreacji dobierz wygląd. Akcent wybierz z palety — domyślnie PIERWSZY kolor (główny kolor marki z logo); inne tylko dla urozmaicenia, nigdy kolor spoza palety. Zróżnicuj motywy w zestawie, ale trzymaj się charakteru marki (${ctx.brand.typography_style || "brak opisu kroju"}).` }],
  });
  const out: Record<string, Omit<AdStyle, "focus">> = {};
  for (const i of items) {
    const v = (r as Record<string, z.infer<typeof DesignSchema>>)[i.key];
    const accent = ctx.palette.find((c) => c.toLowerCase() === v.accent.toLowerCase()) ?? ctx.palette[0] ?? "#ff5a36";
    out[i.key] = { theme: v.theme, font: v.font, highlight: v.highlight.slice(0, 3), accent };
  }
  return out;
}

// ---------- 5) Kontroler ----------

const FixSchema = z.object({
  score: z.number().min(1).max(10).describe("ocena 1–10 jako gotowa reklama na Meta"),
  issues: z.array(z.string()).max(6).describe("konkretne problemy, po polsku, krótko"),
  fields_patch: z.record(z.string(), z.unknown()).optional().describe("tylko zmienione pola szablonu (pełna wartość pola), np. krótszy headline"),
  style_patch: z.object({ theme: z.enum(["light", "dark", "brand"]).optional(), font: z.enum(["anton", "inter", "bricolage"]).optional(), highlight: z.array(z.string()).max(3).optional(), accent: z.string().optional(), focus: z.enum(["center", "top", "bottom", "left", "right"]).optional() }).optional(),
  photo_redo: z.array(z.object({ slot: z.number().int().min(0).max(1), prompt: z.string(), with_product: z.boolean() })).max(2).optional().describe("nowe zdjęcie TYLKO przy błędzie obrazu (zły produkt, artefakty AI, niewidoczny efekt)"),
  copy_patch: z.object({ primary_text: z.string().optional(), headline: z.string().optional(), description: z.string().optional() }).optional(),
});
export type AdReview = z.infer<typeof FixSchema>;

export type ReviewItem = { key: string; template: TemplateKey; fields: Fields; copy: AdCopy; style: AdStyle; square: string; tall: string; note?: string };

const CRITICAL = `BŁĘDY KRYTYCZNE — każdy oznacza score ≤ 5 i obowiązkową poprawkę (w ocenie końcowej: score ≤ 5 i opis w issues):
1. Produkt wygląda na DOKLEJONY (wycięty PNG położony na zdjęciu, inne światło, brak cienia, zła skala, unosi się) albo scena jest NIELOGICZNA (np. pusta kosmetyczka z ręcznikiem, a produkt wklejony obok; produkt nie pasuje do sytuacji) → photo_redo: scena z produktem WYGENEROWANYM w niej, with_product: true.
2. Produkt na zdjęciu różni się od zdjęcia referencyjnego (kształt, kolor, logo, materiał) → photo_redo z with_product: true.
3. Przed/po NIE pokazuje efektu produktu na tym, na co działa (skóra, włosy, szyba…), tylko metaforę lub sytuację (kosmetyczka, szafa, sypialnia, biurko, wanna), albo różnica PRZED/PO jest słabo widoczna → photo_redo obu zdjęć: slot 1 = PO (zbliżenie efektu + produkt logicznie w scenie obok, with_product: true), slot 0 = PRZED jako polecenie edycji PO po angielsku („Edit this photo: remove the product completely; keep the same framing; add clearly visible <problem>”).
4. Nagłówek nie mówi wprost efektu / problemu (metafora, okoliczność, niezrozumiały w sekundę) → fields_patch.
5. Tekst ucięty, nachodzi na inny, dziwny zapis (np. plakietka „-33%: 39,99 zł”) → fields_patch (plakietka max 8 znaków).
6. Kolor akcentu spoza palety marki → style_patch.`;

export async function reviewAds(apiKey: string, ctx: AdContext, items: ReviewItem[], final: boolean, productRef?: string | null): Promise<Record<string, AdReview>> {
  const schema = z.object(Object.fromEntries(items.map((i) => [i.key, FixSchema])));
  const content: Anthropic.Messages.ContentBlockParam[] = [{ type: "text", text: `${contextBlock(ctx)}\n<paleta>${JSON.stringify(ctx.palette)}</paleta>` }];
  if (productRef) {
    content.push({ type: "text", text: "Zdjęcie referencyjne prawdziwego produktu (tak ma wyglądać na każdej grafice):" });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: productRef } });
  }
  for (const i of items) {
    content.push({ type: "text", text: `<kreacja id="${i.key}" szablon="${i.template}">${JSON.stringify({ pola: i.fields, opis_pol: FIELD_GUIDE[i.template], copy: i.copy, styl: i.style, ...(i.note ? { note: i.note } : {}) })}</kreacja>\nPoniżej ${i.key}: 1:1, potem 9:16.` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: i.square } });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: i.tall } });
  }
  content.push({
    type: "text",
    text: final
      ? `${CRITICAL}\n\nOceń każdą kreację po poprawkach (score + issues). To ocena końcowa — NIE oddawaj poprawek (bez fields_patch, style_patch, photo_redo, copy_patch).`
      : `${CRITICAL}\n\nNajpierw szukaj błędów krytycznych — przyjrzyj się, czy produkt jest naturalną częścią zdjęcia i czy przed/po pokazuje efekt. Potem lista kontrolna Kontrolera. Oddaj score, issues i potrzebne poprawki. Przy ocenie ≥ 8 bez błędów krytycznych nie oddawaj poprawek.`,
  });
  const r = await structuredCall({
    apiKey,
    system: await system("Jesteś Kontrolerem Clipzy: oglądasz gotowe grafiki reklam (obie wersje) jak wymagający dyrektor kreatywny, który odrzuca wszystko, co wygląda sztucznie, i wdrażasz poprawki. Lepiej odrzucić za dużo niż przepuścić reklamę z doklejonym produktem."),
    schema,
    maxTokens: 6000,
    content,
  });
  return r as Record<string, AdReview>;
}
