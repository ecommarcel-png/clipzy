import { z } from "zod";

// The edit plan the Reżyser (Claude) writes, plus a deterministic sanitizer that
// makes it safe to render: frame-exact, contiguous, and never touching the hard
// cuts inside a source clip (that is what produced flashing frames before).

export const FPS = 30;
export const FORMATS = ["4x5", "9x16", "1x1"] as const;
export type Format = (typeof FORMATS)[number];
export const FORMAT_SIZE: Record<Format, { width: number; height: number; label: string }> = {
  "4x5": { width: 1080, height: 1350, label: "4:5 (rekomendowane)" },
  "9x16": { width: 1080, height: 1920, label: "9:16 (Reels, Stories)" },
  "1x1": { width: 1080, height: 1080, label: "1:1" },
};

export const ICONS = [
  "razor", "wax", "foam", "plug", "battery", "clock", "money", "pain", "scissors", "bottle", "cream",
  "chemical", "drop", "trash", "box", "truck", "heart", "star", "loop", "check", "cross", "bolt", "phone", "hand",
] as const;
export type IconName = (typeof ICONS)[number];

const t = (d: string) => z.number().min(0).describe(d);
const pos = (d: string) => z.number().min(0).max(1).describe(d);

const Src = z.object({
  asset: z.string().describe("id pliku z listy materiałów"),
  from: z.number().min(0).describe("sekunda w pliku źródłowym, od której startuje ujęcie"),
  rate: z.number().min(0.5).max(2).default(1).describe("tempo: <1 zwolnienie, >1 przyspieszenie (max 1.5 przy szybkim ruchu dłoni)"),
});

const Look = z.object({
  gray: z.number().min(0).max(1).default(0).describe("0 kolor, 1 czarno-biały — problem / stara metoda"),
  zoom_from: z.number().min(1).max(1.6).default(1),
  zoom_to: z.number().min(1).max(1.6).default(1.06),
  shake_at: z.number().nullable().default(null).describe("czas reklamy (s) krótkiego wstrząsu — ból, szarpnięcie"),
});

const Mark = z.enum(["ok", "no", "none"]);

const ClipShot = z.object({
  type: z.literal("clip"),
  start: t("start na osi reklamy (s)"),
  end: t("koniec na osi reklamy (s)"),
  src: Src,
  look: Look.default({ gray: 0, zoom_from: 1, zoom_to: 1.06, shake_at: null }),
});

const SplitShot = z.object({
  type: z.literal("split"),
  start: t("start (s)"),
  end: t("koniec (s)"),
  top: Src,
  top_look: Look.default({ gray: 0, zoom_from: 1, zoom_to: 1.06, shake_at: null }),
  top_label: z.string().max(24).describe("np. „Przed”, „Maszynka”"),
  top_mark: Mark.default("none"),
  bottom: Src,
  bottom_look: Look.default({ gray: 0, zoom_from: 1, zoom_to: 1.06, shake_at: null }),
  bottom_label: z.string().max(24).describe("np. „Po”, nazwa produktu"),
  bottom_mark: Mark.default("none"),
  marks_at: z.number().nullable().default(null).describe("czas (s), kiedy pojawiają się ✓/✗"),
});

const Packshot = z.object({
  type: z.literal("packshot"),
  start: t("start (s)"),
  end: t("koniec (s) — zwykle koniec reklamy"),
  headline: z.string().max(40).describe("np. „Zamów Depli”"),
  chips: z.array(z.string().max(28)).max(3).describe("2–3 korzyści z ✓ — tylko z lektora/profilu, bez zmyślonych liczb"),
  cta: z.string().max(32).describe("np. „Kliknij link poniżej”"),
});

export const Shot = z.discriminatedUnion("type", [ClipShot, SplitShot, Packshot]);
export type Shot = z.infer<typeof Shot>;
export type SrcRef = z.infer<typeof Src>;
export type LookT = z.infer<typeof Look>;

export const Overlay = z.discriminatedUnion("type", [
  z.object({ type: z.literal("struck_icon"), icon: z.enum(ICONS), at: t("pojawienie"), strike_at: t("przekreślenie"), until: z.number().nullable().default(null).describe("zniknięcie; null = koniec ujęcia"), x: pos("środek x (0–1)"), y: pos("środek y (0–1)"), label: z.string().max(20).nullable().default(null) }),
  z.object({ type: z.literal("icon"), icon: z.enum(ICONS), at: t("pojawienie"), until: t("zniknięcie"), x: pos("x"), y: pos("y"), spin: z.boolean().default(false) }),
  z.object({ type: z.literal("badge"), ok: z.boolean(), at: t("pojawienie"), until: z.number().nullable().default(null).describe("zniknięcie; null = koniec ujęcia"), x: pos("x"), y: pos("y") }),
  z.object({ type: z.literal("ring"), at: t("pojawienie"), until: t("zniknięcie"), x: pos("x punktu problemu w kadrze"), y: pos("y"), r: z.number().min(0.03).max(0.25).default(0.07) }),
  z.object({ type: z.literal("sheen"), at: t("start"), len: z.number().min(0.3).max(2).default(0.8) }),
  z.object({ type: z.literal("sparkles"), at: t("start"), len: z.number().min(0.3).max(2).default(1) }),
  z.object({ type: z.literal("wipe"), at: t("przejście w kolorze marki, zwykle problem → rozwiązanie") }),
  z.object({ type: z.literal("logo"), at: t("pojawienie"), until: t("zniknięcie") }),
]);
export type Overlay = z.infer<typeof Overlay>;

const Sfx = z.object({ file: z.string(), at: t("czas"), volume: z.number().min(0).max(1).default(0.25) });
export type Sfx = z.infer<typeof Sfx>;

// Alternative openings for hook versions 2–5 (times from 0 to the end of that version's hook).
export const HookVariant = z.object({
  shots: z.array(Shot).min(1),
  overlays: z.array(Overlay).default([]),
  sfx: z.array(Sfx).default([]),
});
export type HookVariant = z.infer<typeof HookVariant>;

export const EditPlan = z.object({
  summary: z.string().describe("1–2 zdania dla użytkownika: jaki pomysł na reklamę i dlaczego"),
  shots: z.array(Shot).min(3),
  overlays: z.array(Overlay).default([]),
  caption_highlights: z.array(z.string()).default([]).describe("słowa (dokładnie jak w lektorze) wyróżnione tłem w kolorze marki — max 1 na planszę"),
  text_plates: z
    .array(z.object({ start: t("start"), end: t("koniec"), text: z.string().max(60), highlight: z.string().nullable().default(null) }))
    .default([])
    .describe("TYLKO dla sklejki bez lektora: plansze tekstowe 2–4 słowa"),
  music: z.object({ file: z.string().nullable().describe("ścieżka z biblioteki albo null"), start_at: z.number().min(0).default(0), volume: z.number().min(0).max(1).default(0.17) }),
  sfx: z.array(Sfx).default([]),
  original_audio: z
    .array(z.object({ asset: z.string(), from: z.number().min(0), at: t("czas reklamy"), len: z.number().min(0.2).max(5), volume: z.number().min(0).max(1).default(0.4) }))
    .default([])
    .describe("dźwięk z nagrania (np. ASMR pocierania) pod hookiem"),
  hooks: z.array(HookVariant).max(4).default([]).describe("otwarcia wersji 2–5 (hooki 2–5): czasy od 0 do końca hooka danej wersji; każde z innym obrazem"),
});
export type EditPlan = z.infer<typeof EditPlan>;

// ---------- sanitizer ----------

export type AssetInfo = { id: string; duration: number; cuts: number[]; mirrored?: boolean };

const MARGIN = 0.1; // keep this far from any hard cut inside a source clip
const snap = (s: number) => Math.round(s * FPS) / FPS;

export function cleanIntervals(a: AssetInfo): Array<[number, number]> {
  const cuts = [...a.cuts].filter((c) => c > 0.05 && c < a.duration - 0.05).sort((x, y) => x - y);
  const edges = [0, ...cuts, a.duration];
  const out: Array<[number, number]> = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const s = i === 0 ? 0 : edges[i] + MARGIN;
    const e = i === edges.length - 2 ? Math.max(0, a.duration - 0.05) : edges[i + 1] - MARGIN;
    if (e - s > 0.15) out.push([s, e]);
  }
  return out;
}

// Make a source range fit inside one clean interval; adjust start, then speed.
export function fitSrc(src: SrcRef, dur: number, a: AssetInfo | undefined, notes: string[]): SrcRef {
  if (!a) return src;
  const ints = cleanIntervals(a);
  if (ints.length === 0) return src;
  let rate = Math.min(2, Math.max(0.5, src.rate || 1));
  let from = src.from;
  let int = ints.find(([s, e]) => from >= s - 0.001 && from < e) ?? ints.reduce((best, x) => (Math.abs(x[0] - from) < Math.abs(best[0] - from) ? x : best));
  let need = dur * rate;
  if (int[1] - int[0] < need) {
    // the interval is too short at this speed: slow down (down to 0.6) or take the longest interval
    const slowed = (int[1] - int[0]) / dur;
    if (slowed >= 0.6) {
      rate = slowed;
    } else {
      const longest = ints.reduce((b, x) => (x[1] - x[0] > b[1] - b[0] ? x : b));
      int = longest;
      rate = Math.max(0.5, Math.min(rate, (longest[1] - longest[0]) / dur));
      notes.push(`ujęcie z ${a.id} za krótkie — wzięto najdłuższy czysty fragment`);
    }
    need = dur * rate;
  }
  from = Math.min(Math.max(from, int[0]), int[1] - need);
  return { asset: src.asset, from: Math.round(Math.max(int[0], from) * 1000) / 1000, rate: Math.round(rate * 1000) / 1000 };
}

export function sanitizePlan(plan: EditPlan, assets: AssetInfo[]): { plan: EditPlan; notes: string[] } {
  const notes: string[] = [];
  const byId = new Map(assets.map((a) => [a.id, a]));
  const shots = [...plan.shots].filter((s) => s.end - s.start > 0.1).sort((a, b) => a.start - b.start);
  // contiguous, frame-exact timeline from 0
  let cursor = 0;
  const fixed: Shot[] = shots.map((s) => {
    const len = Math.max(snap(s.end - s.start), 2 / FPS);
    const start = cursor;
    const end = snap(start + len);
    cursor = end;
    const dur = end - start;
    if (s.type === "clip") {
      if (!byId.has(s.src.asset)) notes.push(`nieznany plik ${s.src.asset}`);
      return { ...s, start, end, src: fitSrc(s.src, dur, byId.get(s.src.asset), notes) };
    }
    if (s.type === "split") {
      return { ...s, start, end, top: fitSrc(s.top, dur, byId.get(s.top.asset), notes), bottom: fitSrc(s.bottom, dur, byId.get(s.bottom.asset), notes) };
    }
    return { ...s, start, end };
  });
  const duration = cursor;
  const shift = (x: number) => Math.min(Math.max(0, x), duration);
  // end of the shot an overlay starts in — pop-ups disappear with their shot
  const shotEnd = (at: number) => fixed.find((s) => at >= s.start - 1e-6 && at < s.end)?.end ?? duration;
  const overlays = plan.overlays
    .filter((o) => o.at < duration)
    .map((o) => {
      const at = shift(o.at);
      if (o.type === "struck_icon") {
        const until = o.until === null ? shotEnd(at) : Math.max(at + 0.3, shift(o.until));
        return { ...o, at, strike_at: Math.min(until - 0.1, Math.max(at + 0.15, shift(o.strike_at))), until };
      }
      if (o.type === "badge") return { ...o, at, until: o.until === null ? shotEnd(at) : Math.max(at + 0.3, shift(o.until)) };
      if ("until" in o) return { ...o, at, until: Math.max(at + 0.2, shift(o.until)) };
      return { ...o, at };
    });
  return {
    plan: {
      ...plan,
      shots: fixed,
      overlays,
      sfx: plan.sfx.filter((x) => x.at < duration),
      original_audio: plan.original_audio.filter((x) => x.at < duration && byId.has(x.asset)),
      text_plates: plan.text_plates.filter((x) => x.start < duration),
    },
    notes,
  };
}

export function planDuration(plan: EditPlan) {
  return plan.shots.reduce((m, s) => Math.max(m, s.end), 0);
}
