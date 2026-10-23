import type { Phrase, Word } from "./timeline";

// Hook versions of a voiceover: 5 different first sentences + one shared rest.
export const HOOK_GAP = 0.15;

export function variantWords(hook: { words: Word[]; duration: number }, body: { words: Word[] }, gap = HOOK_GAP): Word[] {
  const shift = hook.duration + gap;
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return [...hook.words, ...body.words.map((w) => ({ ...w, start: r(w.start + shift), end: r(w.end + shift) }))];
}

export function activeHooks(hooks: Array<{ text: string }>): string[] {
  return hooks.map((h) => h.text.trim()).filter(Boolean);
}

// Uploaded voiceover: the hook is the opening (1.2–3.5 s), ending on a phrase boundary when one fits.
export function uploadHookEnd(phrases: Phrase[], min = 1.2, max = 3.5): number {
  const hit = phrases.find((p) => p.end >= min);
  if (hit && hit.end <= max) return hit.end;
  return Math.min(3, phrases.at(-1)?.end ?? 3);
}

export function hookEndBetween(lastHookWordEnd: number, firstRestWordStart: number) {
  return Math.round(((lastHookWordEnd + firstRestWordStart) / 2) * 1000) / 1000;
}
