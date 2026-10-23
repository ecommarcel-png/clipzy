// Quick manual edits of a finished plan — no AI involved. Every operation keeps
// the total length (the voiceover sets it) and is followed by sanitizePlan, so
// the result is still frame-exact and never touches a hard cut in a source clip.
import { cleanIntervals, sanitizePlan, type AssetInfo, type EditPlan, type Shot } from "./plan";
import type { CaptionChunk } from "./timeline";

export const MIN_SHOT = 0.4;

export type Mix = { vo: number; music: number; sfx: number };
export const DEFAULT_MIX: Mix = { vo: 1, music: 1, sfx: 1 };

export function normalizeMix(m: Partial<Mix> | null | undefined): Mix {
  const c = (x: unknown, max: number, d: number) => (typeof x === "number" && Number.isFinite(x) ? Math.min(max, Math.max(0, x)) : d);
  return { vo: c(m?.vo, 1, 1), music: c(m?.music, 2, 1), sfx: c(m?.sfx, 2, 1) };
}

const round = (n: number) => Math.round(n * 1000) / 1000;
const clone = (p: EditPlan): EditPlan => JSON.parse(JSON.stringify(p));

// Remove a clip/split shot; its time goes to the previous shot (or the next one if it is first).
export function removeShot(plan: EditPlan, i: number): EditPlan {
  const shot = plan.shots[i];
  if (!shot || shot.type === "packshot" || plan.shots.length <= 3) return plan;
  const p = clone(plan);
  const [removed] = p.shots.splice(i, 1);
  if (i > 0) p.shots[i - 1].end = removed.end;
  else p.shots[0].start = removed.start;
  // pop-ups that belonged to the removed shot would land on the wrong picture
  p.overlays = p.overlays.filter((o) => !(o.at >= removed.start - 1e-6 && o.at < removed.end && o.type !== "wipe"));
  return p;
}

// Longer (+) or shorter (−) by moving the cut to the next shot (for the last shot: the cut before it).
export function resizeShot(plan: EditPlan, i: number, delta: number): EditPlan {
  const n = plan.shots.length;
  if (!plan.shots[i] || n < 2) return plan;
  const p = clone(plan);
  const [a, b, d] = i < n - 1 ? [i, i + 1, delta] : [i - 1, i, -delta];
  const left = p.shots[a];
  const right = p.shots[b];
  const old = left.end;
  const cut = round(Math.min(right.end - MIN_SHOT, Math.max(left.start + MIN_SHOT, left.end + d)));
  left.end = cut;
  right.start = cut;
  // pop-ups that ended with the old cut follow it
  for (const o of p.overlays) if ("until" in o && typeof o.until === "number" && Math.abs(o.until - old) < 0.02) o.until = cut;
  return p;
}

type Side = "main" | "top" | "bottom";

function srcOf(shot: Shot, side: Side) {
  if (shot.type === "clip") return shot.src;
  if (shot.type === "split") return side === "bottom" ? shot.bottom : shot.top;
  return null;
}

// Use another file for a shot (starts at its longest clean fragment).
export function swapSource(plan: EditPlan, i: number, assetId: string, assets: AssetInfo[], side: Side = "main"): EditPlan {
  const a = assets.find((x) => x.id === assetId);
  const shot = plan.shots[i];
  if (!a || !shot || !srcOf(shot, side)) return plan;
  const ints = cleanIntervals(a);
  const longest = ints.length ? ints.reduce((b, x) => (x[1] - x[0] > b[1] - b[0] ? x : b)) : [0, a.duration];
  const p = clone(plan);
  const target = srcOf(p.shots[i], side)!;
  target.asset = assetId;
  target.from = round(longest[0]);
  target.rate = 1;
  return p;
}

// Another moment of the same file: the next clean fragment, or ~1.5 s later in a long one.
export function nextFragment(plan: EditPlan, i: number, assets: AssetInfo[], side: Side = "main"): EditPlan {
  const shot = plan.shots[i];
  const src = shot ? srcOf(shot, side) : null;
  const a = src ? assets.find((x) => x.id === src.asset) : null;
  if (!shot || !src || !a) return plan;
  const need = (shot.end - shot.start) * (src.rate || 1);
  const ints = cleanIntervals(a).filter(([s, e]) => e - s >= Math.min(need, 0.5));
  if (!ints.length) return plan;
  const cur = ints.findIndex(([s, e]) => src.from >= s - 0.001 && src.from < e);
  let from: number;
  if (cur >= 0 && src.from + 1.5 + need <= ints[cur][1]) from = src.from + 1.5;
  else from = ints[(cur + 1) % ints.length][0];
  const p = clone(plan);
  srcOf(p.shots[i], side)!.from = round(from);
  return p;
}

export function setPackshot(plan: EditPlan, i: number, fields: { headline?: string; chips?: string[]; cta?: string }): EditPlan {
  const shot = plan.shots[i];
  if (!shot || shot.type !== "packshot") return plan;
  const p = clone(plan);
  const s = p.shots[i] as Extract<Shot, { type: "packshot" }>;
  if (fields.headline !== undefined) s.headline = fields.headline.slice(0, 40);
  if (fields.cta !== undefined) s.cta = fields.cta.slice(0, 32);
  if (fields.chips) s.chips = fields.chips.map((c) => c.slice(0, 28)).filter((c) => c.trim()).slice(0, 3);
  return p;
}

export function setMusic(plan: EditPlan, file: string | null, start: number): EditPlan {
  const p = clone(plan);
  p.music = { ...p.music, file, start_at: file ? start : 0 };
  return p;
}

// Only the text changes — the timing stays as the voiceover dictates.
export function editCaptions(original: CaptionChunk[], texts: string[]): CaptionChunk[] {
  return original.map((c, i) => ({ ...c, text: (texts[i] ?? c.text).replace(/\s+/g, " ").trim().slice(0, 80) || c.text }));
}

export function finalize(plan: EditPlan, assets: AssetInfo[]) {
  return sanitizePlan(plan, assets);
}
