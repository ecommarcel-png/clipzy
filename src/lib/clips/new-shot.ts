// "Wygeneruj nowe ujęcie" in the editor: how long the AI shot is and what it costs. Pure.

/** Seedance 2.5 at 720p, fal price per second (Oct 2026) — shown before the user clicks. */
export const SHOT_PRICE_PER_S = 0.47;

/** Seconds an on-demand shot is generated for (Seedance takes 4–10 s; a little spare for fitting). */
export function shotSeconds(length: number) {
  return Math.min(8, Math.max(4, Math.ceil(length + 0.5)));
}

export function shotCost(length: number) {
  return shotSeconds(length) * SHOT_PRICE_PER_S;
}

/** What the voiceover says during [start, end] — the shot has to show it. */
export function spokenBetween(captions: Array<{ start: number; end: number; text: string }>, start: number, end: number) {
  return captions
    // a caption that only grazes the shot (cuts are rarely frame-exact on phrases) does not count
    .filter((c) => Math.min(c.end, end) - Math.max(c.start, start) > 0.15)
    .map((c) => c.text)
    .join(" ")
    .trim();
}
