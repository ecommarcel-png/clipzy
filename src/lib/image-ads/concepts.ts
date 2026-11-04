import { TEMPLATES, type TemplateKey } from "./templates";

// The Strateg's set, kept within the rules whatever the model returned. Pure.

export type Concept = {
  template: TemplateKey; angle: string; persona: string; awareness: string; visual: string; idea: string;
  /** the user's instruction for this creative (Przegeneruj z poleceniem) — beats everything else */
  note?: string;
};

export type Allowed = { beforeAfter: boolean; testimonial: boolean; offer: boolean };

export function allowedTemplates(a: Allowed): TemplateKey[] {
  return TEMPLATES.filter((t) => (t !== "before_after" || a.beforeAfter) && (t !== "testimonial" || a.testimonial) && (t !== "offer" || a.offer));
}

/** How many before/afters a set gets when the product has a visible effect: about half, at least one. */
export function beforeAfterTarget(count: number, on: boolean): number {
  return on ? Math.max(1, Math.round(count * 0.5)) : 0;
}

/** Exactly `count` concepts: forbidden layouts swapped out; with a visible effect about half are before/after, one of them first. */
export function balanceConcepts(raw: Concept[], count: number, a: Allowed): Concept[] {
  const ok = new Set(allowedTemplates(a));
  const spare = allowedTemplates(a).filter((t) => t !== "before_after");
  let k = 0;
  const swap = (c: Concept): Concept => {
    if (ok.has(c.template)) return c;
    const used = new Set(raw.map((x) => x.template));
    const pick = spare.find((t) => !used.has(t)) ?? spare[k++ % spare.length];
    return { ...c, template: pick };
  };
  let list = raw.map(swap);
  if (a.beforeAfter && list.length && !list.some((c) => c.template === "before_after")) list[0] = { ...list[0], template: "before_after" };
  if (a.beforeAfter) {
    const i = list.findIndex((c) => c.template === "before_after");
    if (i > 0) list = [list[i], ...list.slice(0, i), ...list.slice(i + 1)];
  }
  if (!list.length) return [];
  const out = list.slice(0, count);
  for (let i = 0; out.length < count; i++) out.push({ ...list[i % list.length] });
  // too few before/afters: turn the last other concepts into before/after, keeping their angle (each a different problem)
  const target = beforeAfterTarget(count, a.beforeAfter);
  for (let i = out.length - 1; i >= 0 && out.filter((c) => c.template === "before_after").length < target; i--) {
    if (out[i].template !== "before_after") out[i] = { ...out[i], template: "before_after" };
  }
  return out;
}
