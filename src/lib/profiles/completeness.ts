import type { BrandProfile } from "./brand";
import type { ProductProfile } from "./product";

// Completeness = how ready the profile is to sell, computed from the fields
// that drive ads (audience, personas, problems, angles) — not a model's mood.
// Answering questions can only raise it.

export type Completeness = { score: number; missing: string[] };

type Check = { weight: number; ok: boolean; missing: string };

function filled(list: unknown[] | undefined, min: number) {
  return (list ?? []).filter((x) => (typeof x === "string" ? x.trim() : x)).length >= min;
}

function text(s: string | undefined, minChars = 12) {
  return (s ?? "").trim().length >= minChars;
}

function score(checks: Check[]): Completeness {
  const total = checks.reduce((a, c) => a + c.weight, 0);
  const got = checks.filter((c) => c.ok).reduce((a, c) => a + c.weight, 0);
  return { score: Math.round((got / total) * 100), missing: checks.filter((c) => !c.ok).map((c) => c.missing) };
}

export function brandCompleteness(p: BrandProfile): Completeness {
  const personas = p.personas.filter((x) => text(x.name, 2) && text(x.main_problem, 5));
  return score([
    { weight: 20, ok: text(p.target_audience.description, 20), missing: "opis klienta" },
    { weight: 10, ok: p.target_audience.age_to > p.target_audience.age_from, missing: "wiek grupy docelowej" },
    { weight: 25, ok: filled(p.target_audience.pains, 6), missing: "co najmniej 6 problemów klienta" },
    { weight: 15, ok: filled(p.target_audience.desires, 4), missing: "co najmniej 4 pragnienia klienta" },
    { weight: 20, ok: personas.length >= 3, missing: "co najmniej 3 persony" },
    { weight: 10, ok: text(p.tone_of_voice.description), missing: "ton komunikacji" },
  ]);
}

export function productCompleteness(p: ProductProfile): Completeness {
  const angles = p.ad_angles.filter((a) => text(a.angle, 8) && text(a.hook, 8));
  return score([
    { weight: 15, ok: text(p.problem, 15), missing: "główny problem" },
    { weight: 20, ok: filled(p.problems, 6), missing: "co najmniej 6 problemów" },
    { weight: 10, ok: text(p.mechanism, 20), missing: "mechanizm (dlaczego działa)" },
    { weight: 15, ok: filled(p.benefits, 5), missing: "co najmniej 5 korzyści" },
    { weight: 30, ok: angles.length >= 8, missing: "co najmniej 8 kątów reklamowych z hookiem" },
    { weight: 10, ok: filled(p.objections.filter((o) => text(o.answer, 5)), 3), missing: "co najmniej 3 obiekcje z odpowiedzią" },
  ]);
}

export function completenessSummary(c: Completeness): string {
  if (c.missing.length === 0) return "Profil gotowy do tworzenia reklam.";
  return `Do pełnego profilu brakuje: ${c.missing.join(", ")}.`;
}
