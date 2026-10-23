import "server-only";
import { z } from "zod";
import { structuredCall } from "./claude";
import { ReviewSchema, type Review, type ReviewIssue } from "./review";
import { clipsKnowledge, knowledgeText } from "@/lib/knowledge";
import { EditPlan, ICONS, cleanIntervals, type AssetInfo } from "@/lib/clips/plan";
import type { Phrase } from "@/lib/clips/timeline";
import type { ClipAnalysis } from "./gemini";

// Claude as the Reżyser of a sklejka: what is missing, the edit plan, the
// Kontroler review and turning user feedback into lasting brand preferences.

export type ClipsContext = {
  brand: { name: string; audience: string; personas: string[]; tone: string; caption_profile: string; colors: Record<string, string>; preferences: string[] };
  product: { name: string; problem: string; problems: string[]; mechanism: string; benefits: string[]; angles: string[]; offer: string };
  voiceover: { phrases: Phrase[]; duration: number } | null;
  assets: Array<{ alias: string; kind: "clip" | "generated"; info: AssetInfo; analysis: ClipAnalysis | null; brief?: string | null }>;
  library: { music: string[]; sfx: Array<{ file: string; category: string | null }> };
  settings: { music: string; formats: string[]; notes: string };
  hasPackshot: boolean;
  /** hook versions: text and where each version's hook ends (seconds, after pause cutting) */
  hooks?: Array<{ wersja: number; tekst: string; koniec_s: number }>;
};

function round(n: number) {
  return Math.round(n * 100) / 100;
}

export function contextBlock(ctx: ClipsContext): string {
  const assets = ctx.assets.map((a) => ({
    id: a.alias,
    rodzaj: a.kind === "generated" ? `wygenerowane AI (brief: ${a.brief ?? "-"})` : "nagranie użytkownika",
    dlugosc_s: round(a.info.duration),
    czyste_zakresy_s: cleanIntervals(a.info).map(([s, e]) => [round(s), round(e)]),
    opis: a.analysis?.summary ?? "",
    produkt_w_kadrze: a.analysis?.product_look ?? "",
    segmenty: (a.analysis?.segments ?? []).map((s) => ({
      od: round(s.start), do: round(s.end), widac: s.shows, uzycie: s.use_for, hook: s.hook_score, ostrosc: s.sharpness,
      punkty: s.focus.slice(0, 3).map((f) => ({ x: round(f.x), y: round(f.y), co: f.what })),
    })),
  }));
  const vo = ctx.voiceover
    ? ctx.voiceover.phrases.map((p, i) => ({ nr: i, od: round(p.start), do: round(p.end), tekst: p.text }))
    : null;
  return `<marka>${JSON.stringify(ctx.brand)}</marka>
<produkt>${JSON.stringify(ctx.product)}</produkt>
<lektor_po_cieciu_pauz>${vo ? JSON.stringify({ dlugosc_s: round(ctx.voiceover!.duration), frazy: vo }) : "BRAK — sklejka bez lektora (muzyka + plansze tekstowe)"}</lektor_po_cieciu_pauz>
<materialy>${JSON.stringify(assets)}</materialy>
<biblioteka_muzyki>${JSON.stringify(ctx.library.music)}</biblioteka_muzyki>
<biblioteka_sfx>${JSON.stringify(ctx.library.sfx)}</biblioteka_sfx>
<ustawienia>${JSON.stringify({ muzyka: ctx.settings.music, formaty: ctx.settings.formats, uwagi_uzytkownika: ctx.settings.notes, packshot_ze_zdjecia_produktu: ctx.hasPackshot })}</ustawienia>${
    ctx.hooks && ctx.hooks.length > 1 ? `\n<hooki>${JSON.stringify(ctx.hooks)}</hooki>` : ""
  }`;
}

// ---------- 1) missing shots ----------

export const MissingShots = z.object({
  shots: z
    .array(
      z.object({
        purpose: z.string().describe("które zdanie lektora / moment reklamy ilustruje i dlaczego brakuje go w materiałach"),
        mode: z.enum(["t2v", "reference"]).describe("reference = w kadrze ma być produkt (zdjęcia produktu jako wzór); t2v = bez produktu (np. problem)"),
        duration: z.number().min(4).max(8),
        prompt: z.string().describe("prompt po angielsku dla Seedance 2.5: pionowe 9:16, realistyczne, co dokładnie w kadrze, światło, bez tekstu i napisów; dla wielu ujęć: 'Shot 1: … Shot 2: …' z twardymi cięciami"),
      }),
    )
    .max(3),
  notes: z.string().describe("1–2 zdania dla użytkownika: czego brakowało i co Reżyser wygeneruje (albo że nic nie trzeba)"),
});
export type MissingShots = z.infer<typeof MissingShots>;

const DIRECTOR = `Jesteś Reżyserem Clipzy — montujesz sklejki (reklamy Meta Ads z nagrań produktu) dla polskiego e-commerce. Pracujesz według bazy wiedzy poniżej (zwłaszcza rozdz. 2, 3, 4, 4a, 5, 5a, 6, 7, 8, 9 sklejek). Materiały użytkownika używasz takimi, jakie są — także gdy pokazują inny model produktu (to jego decyzja). Zdjęcia produktu tylko w packshocie na końcu. Preferencje marki z feedbacku są prawem.`;

export async function missingShots(apiKey: string, ctx: ClipsContext): Promise<MissingShots> {
  const docs = await clipsKnowledge();
  return structuredCall({
    apiKey,
    system: `${DIRECTOR}\n\n${knowledgeText(docs)}`,
    schema: MissingShots,
    maxTokens: 6000,
    content: [
      {
        type: "text",
        text: `${contextBlock(ctx)}

Zadanie: sprawdź, czy każde ważne zdanie lektora (hook, problem, przed/po, efekt WOW, mechanizm) da się zilustrować DOSŁOWNIE nagraniami z <materialy>. Wygeneruj tylko to, czego naprawdę brakuje i co podniesie skuteczność (najczęściej: pokazanie problemu — np. podrażnienia, zacięcia, bólu, bałaganu — którego klient nie nagrał). Najwyżej 3 ujęcia, a jedno zlecenie może zawierać 2–3 krótkie ujęcia z twardymi cięciami (taniej). Nie generuj czegoś, co już jest w nagraniach — także w ujęciach AI z wcześniejszych sklejek (pliki typu generated z opisem celu): jeśli pasują do tego lektora, użyj ich zamiast generować nowe. Każde ujęcie kosztuje użytkownika kilka dolarów. Nie generuj fałszywych efektów działania produktu. Gdy nic nie brakuje — pusta lista.`,
      },
    ],
  });
}

// ---------- 2) edit plan ----------

const PLAN_RULES = `Zasady planu (oś czasu = gotowa reklama, sekundy):
- Ujęcia (shots) idą jedno po drugim bez przerw od 0 s. Każde ujęcie ilustruje DOSŁOWNIE frazę lektora, która wtedy leci (czasy fraz w <lektor_po_cieciu_pauz>). Cięcia na granicach fraz.
- Źródło ujęcia: "src.asset" = id z <materialy>, "src.from" = sekunda w pliku. Zakres [from, from + długość×rate] MUSI leżeć w jednym z "czyste_zakresy_s" tego pliku (inaczej mignie klatka z sąsiedniej sceny). Nie przyspieszaj ujęć z podnoszeniem/odkładaniem produktu powyżej 1.5.
- Tempo (grupa beauty/dom 25–50): ujęcia ok. 0.6–2.5 s, pierwsze cięcie do ok. 1.2 s.
- Hook 0–3 s: obraz + dźwięk + tekst razem; efekt WOW / przed-po od pierwszej klatki (split "Przed" / "Po" z top_mark "none" i bottom_mark "ok", jeśli są nagrania przed i po). Dodaj logo marki ("logo") w hooku.
- Efekty z rozdz. 5a OBOWIĄZKOWO tam, gdzie lektor o czymś mówi: problem = gray 1 (+ shake_at przy bólu), czerwone kropki itp. = "ring" w punktach z "punkty", przejście problem→rozwiązanie = "wipe", „bez X” = "struck_icon" (ikony: ${ICONS.join(", ")}), przewaga nad alternatywą = split z top_mark "no" (alternatywa, gray 1) i bottom_mark "ok", efekt gładkości/blasku = "sheen" + "sparkles", ruch (np. „kilka kółek”) = "icon" z spin true.
- Pozycje x/y nakładek to ułamki kadru (0–1). Trzymaj je poza pasem napisów (y 0.58–0.76) i poza górnymi 10% kadru. Split ma etykiety przy linii podziału.
- Na końcu "packshot" 3–4 s (jeśli dostępny): headline z nazwą marki/produktu, 2–3 "chips" z korzyściami powiedzianymi przez lektora (bez zmyślonych liczb), cta „Kliknij link poniżej”. Packshot zaczyna się tuż po ostatniej frazie lektora (lektor mówi CTA na packshocie, jeśli to fraza CTA).
- Napisy robi system z fraz lektora — Ty podajesz tylko "caption_highlights": 3–6 słów-kluczy (dokładnie jak w lektorze, z interpunkcją), max 1 na frazę.
- Bez lektora: "text_plates" 5–7 plansz po 2–4 słowa, jedna myśl = jedno ujęcie, ok. 2–3 s.
- Muzyka: "music.file" z <biblioteka_muzyki> (nastrój z nazwy pliku; gdy użytkownik wybrał utwór — ten), volume ok. 0.17. Gdy biblioteka pusta — null.
- SFX z <biblioteka_sfx> do efektów: whoosh na przejściach/wipe, pop na ikonach i badge, strike na przekreśleniu, ding na ✓, sparkle na iskierkach, rip na bólu. Głośność 0.15–0.3, nie częściej niż co ~0.4 s.
- "original_audio": dźwięk z nagrania pod hookiem (np. pocieranie/ASMR), jeśli w analizie jest taki dźwięk, volume 0.3–0.5.
- Każdy plik/ujęcie użyj najwyżej 2 razy (w różnych fragmentach).
- Gdy są <hooki> (wersje reklamy z różnym hookiem): "shots" = wersja 1 (hook 1 + wspólna reszta) — w wersji 1 MUSI być cięcie dokładnie w "koniec_s" hooka 1, a reszta po nim jest wspólna dla wszystkich wersji. "hooks" = otwarcia wersji 2, 3… (po kolei): każde ma własne "shots" od 0 do "koniec_s" swojej wersji (ostatnie ujęcie kończy się dokładnie tam), własne "overlays" (w tym "logo" — logo marki jest w KAŻDYM hooku) i "sfx" w tym zakresie. Każda wersja zaczyna się INNYM ujęciem/efektem (np. split przed/po, zbliżenie problemu w szarości, ujęcie AI, dynamiczne użycie produktu, ikonka przekreślona) — obraz ilustruje tekst swojego hooka. Ujęcia z wersji 1 możesz użyć w hookach innych wersji. Gdy teksty hooków są takie same (wgrany lektor) — różnią się tylko obrazem i efektami.`;

export async function planEdit(
  apiKey: string,
  ctx: ClipsContext,
  extra?: { issues?: ReviewIssue[]; previous?: unknown; feedback?: string },
): Promise<EditPlan> {
  const docs = await clipsKnowledge();
  const fixes = extra?.issues?.length
    ? `\n\n<uwagi_kontrolera>\n${extra.issues.map((i) => `- [${i.severity}] ${i.field}: ${i.problem} → ${i.fix}`).join("\n")}\n</uwagi_kontrolera>\nPopraw plan tak, żeby usunąć te usterki.`
    : "";
  const fb = extra?.feedback ? `\n\n<feedback_uzytkownika_do_poprzedniej_wersji>\n${extra.feedback}\n</feedback_uzytkownika_do_poprzedniej_wersji>\nWprowadź te zmiany — to decyzja użytkownika.` : "";
  const prev = extra?.previous ? `\n\n<poprzedni_plan>\n${JSON.stringify(extra.previous)}\n</poprzedni_plan>` : "";
  return structuredCall({
    apiKey,
    system: `${DIRECTOR}\n\n${PLAN_RULES}\n\n${knowledgeText(docs)}`,
    schema: EditPlan,
    maxTokens: 16_000,
    content: [{ type: "text", text: `${contextBlock(ctx)}${prev}${fixes}${fb}\n\nUłóż plan montażu tej sklejki.` }],
  });
}

// ---------- 3) Kontroler ----------

const CONTROLLER = `Jesteś Kontrolerem jakości sklejek w Clipzy. Nie widzisz rozumowania Reżysera — tylko plan montażu, materiały i lektora. Sprawdzasz plan według listy z rozdz. 11 i 5a bazy wiedzy sklejek:
1. Czy każda fraza lektora ma ujęcie, które ją DOSŁOWNIE ilustruje (porównaj czasy shots z czasami fraz i opisy segmentów)?
2. Hook 0–3 s: WOW/przed-po od pierwszej klatki, logo, tekst.
3. Czy zakresy src mieszczą się w czystych zakresach plików (migawki)?
4. Czy są efekty z 5a tam, gdzie lektor o czymś mówi (problem w szarości, „bez X” jako przekreślona ikona, przewaga jako split ✗/✓, efekt = sheen/iskierki), i czy nie ma ich za dużo (chaos)?
5. Czy nakładki nie wchodzą w pas napisów (y 0.58–0.76) i górne 10%?
6. Packshot i CTA ≥ 3 s na końcu, marka widoczna wcześnie i na końcu.
7. Muzyka z biblioteki, SFX nie częściej niż co ~0.4 s.
Preferencje marki i decyzje użytkownika (inny model produktu w nagraniach, przed/po, zbliżenia problemu) NIE są usterkami.
"field" = np. "shots[3]" albo "overlays[2]". "fix" = konkretne działanie dla Reżysera. Wagi: krytyczna = brak ilustracji frazy, migawka, brak CTA; ważna = brak efektu tam, gdzie powinien być, nakładka na napisach; drobna = kosmetyka. Piszesz po polsku.`;

export async function reviewPlan(apiKey: string, ctx: ClipsContext, plan: EditPlan): Promise<Review> {
  const docs = await clipsKnowledge();
  return structuredCall({
    apiKey,
    system: `${CONTROLLER}\n\n${knowledgeText(docs)}`,
    schema: ReviewSchema,
    maxTokens: 8000,
    content: [{ type: "text", text: `${contextBlock(ctx)}\n\n<plan_do_sprawdzenia>\n${JSON.stringify(plan)}\n</plan_do_sprawdzenia>\n\nSprawdź plan.` }],
  });
}

// ---------- 4) script feedback after a voiceover upload ----------

export const ScriptFeedback = z.object({
  verdict: z.enum(["mocny", "ok", "do_poprawy"]),
  notes: z.array(z.string()).max(5).describe("konkretne uwagi wg rozdz. 10 sklejek: hook, problem, mechanizm, korzyści, dowód, CTA, długość, czy jest co pokazać"),
});
export type ScriptFeedback = z.infer<typeof ScriptFeedback>;

export async function scriptFeedback(apiKey: string, transcript: string, ctx: Pick<ClipsContext, "brand" | "product">, durationS: number): Promise<ScriptFeedback> {
  const docs = await clipsKnowledge();
  return structuredCall({
    apiKey,
    system: `Oceniasz skrypt lektora reklamy Meta Ads według rozdz. 10 bazy wiedzy sklejek i zasad hooków. Krótko, konkretnie, po polsku. Nie każ nagrywać od nowa bez powodu — reklama i tak powstanie.\n\n${knowledgeText(docs)}`,
    schema: ScriptFeedback,
    maxTokens: 3000,
    content: [{ type: "text", text: `<marka>${JSON.stringify(ctx.brand)}</marka>\n<produkt>${JSON.stringify(ctx.product)}</produkt>\n<lektor dlugosc_po_cieciu_s="${round(durationS)}">${transcript}</lektor>` }],
  });
}

// ---------- 5) feedback -> lasting brand preferences ----------

export const FeedbackResult = z.object({
  brand_preferences: z.array(z.string()).describe("zasady na stałe dla tej marki (krótkie, ogólne: np. „muzyka i SFX ciszej”, „zdjęcia produktu tylko na końcu”) — tylko to, co dotyczy kolejnych reklam"),
  video_changes: z.string().describe("co zmienić w TEJ reklamie — instrukcja dla Reżysera"),
});
export type FeedbackResult = z.infer<typeof FeedbackResult>;

export async function interpretFeedback(apiKey: string, feedback: string, existing: string[]): Promise<FeedbackResult> {
  return structuredCall({
    apiKey,
    system: "Zamieniasz feedback użytkownika do gotowej reklamy na: (1) trwałe preferencje marki, które mają obowiązywać w każdej kolejnej reklamie, (2) zmiany w tej konkretnej reklamie. Nie dubluj preferencji, które już istnieją. Po polsku, krótko.",
    schema: FeedbackResult,
    maxTokens: 2000,
    content: [{ type: "text", text: `<istniejace_preferencje>${JSON.stringify(existing)}</istniejace_preferencje>\n<feedback>${feedback}</feedback>` }],
  });
}
