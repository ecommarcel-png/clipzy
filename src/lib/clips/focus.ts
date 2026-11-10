// What one sklejka of a series is about: the problems and marketing angles the user picked from
// the product profile. Empty picks are filled so every sklejka of a series tells a different
// story. Pure, so it can be tested.

export type Focus = { problems: string[]; angles: string[] };
export type Batch = { id: string; index: number; total: number };

export const MAX_SKLEJKI = 5;
export const MAX_PICKS = 3;

const clean = (list: unknown[], allowed: string[]) =>
  [...new Set(list.map((v) => String(v).trim()).filter((v) => allowed.includes(v)))].slice(0, MAX_PICKS);

/** The form's picks, limited to what the profile offers; sklejki without an angle get one nobody else uses. */
export function planFocus(count: number, picks: Array<{ problems: unknown[]; angles: unknown[] }>, profile: { problems: string[]; angles: string[] }): Focus[] {
  const n = Math.min(MAX_SKLEJKI, Math.max(1, Math.round(count) || 1));
  const out: Focus[] = Array.from({ length: n }, (_, i) => ({
    problems: clean(picks[i]?.problems ?? [], profile.problems),
    angles: clean(picks[i]?.angles ?? [], profile.angles),
  }));
  if (n > 1) {
    const used = new Set(out.flatMap((f) => f.angles));
    const free = profile.angles.filter((a) => !used.has(a));
    for (const f of out) {
      if (f.angles.length || f.problems.length) continue;
      const next = free.shift();
      if (next) f.angles = [next];
    }
  }
  return out;
}

/** Short label for the name of a sklejka in a series. */
export function focusLabel(f: Focus | undefined): string {
  const first = f?.angles[0] ?? f?.problems[0] ?? "";
  const words = first.split(/\s+/).filter(Boolean);
  return words.length > 6 ? `${words.slice(0, 6).join(" ")}…` : first;
}

/** For the Reżyser: what this sklejka must be about (empty = he chooses). */
export function focusBlock(f: Focus | undefined): string {
  if (!f || (!f.problems.length && !f.angles.length)) return "";
  return `<fokus_tej_sklejki>${JSON.stringify({ problemy: f.problems, katy_marketingowe: f.angles })}</fokus_tej_sklejki>
Fokus wybrał użytkownik: skrypt, hooki, plan montażu i brakujące ujęcia budujesz WOKÓŁ tych problemów i kątów (inne problemy z profilu najwyżej wspomnij). To nadrzędne wobec Twojego wyboru kąta.`;
}
