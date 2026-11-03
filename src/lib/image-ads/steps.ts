// What the image ads pipeline does next, decided from a fresh snapshot of the
// server state. Pure, so it can be tested.

export type Stage = "copy" | "design" | "photos" | "render" | "review" | "fix" | "final" | "done" | "error";
export type PhotoState = "pending" | "submitted" | "done" | "error";

export type AdState = { id: string; stage: Stage; photos: PhotoState[] };

export type SetState = {
  hasAds: boolean;
  ads: AdState[];
  /** enough time passed since the last look at fal */
  pollDue: boolean;
};

export type Step =
  | { kind: "strategy" }
  | { kind: "copy" | "design" | "submit" | "render" | "review" | "fix" | "final"; ids: string[] }
  | { kind: "poll"; ids: string[]; wait: boolean }
  | { kind: "done" };

export const BATCH = { copy: 5, design: 5, submit: 6, render: 4, review: 3, fix: 5, final: 3 } as const;

export function nextStep(s: SetState): Step {
  if (!s.hasAds) return { kind: "strategy" };
  const at = (stage: Stage) => s.ads.filter((a) => a.stage === stage);
  const take = (kind: keyof typeof BATCH, list: AdState[]) => ({ kind, ids: list.slice(0, BATCH[kind]).map((a) => a.id) });

  const copy = at("copy");
  if (copy.length) return take("copy", copy);
  const design = at("design");
  if (design.length) return take("design", design);
  const photos = at("photos");
  const pending = photos.filter((a) => a.photos.includes("pending"));
  if (pending.length) return take("submit", pending);
  const running = photos.filter((a) => a.photos.includes("submitted")).map((a) => a.id);
  if (running.length && s.pollDue) return { kind: "poll", ids: running, wait: false };
  for (const stage of ["render", "review", "fix", "final"] as const) {
    const list = at(stage);
    if (list.length) return take(stage, list);
  }
  if (running.length) return { kind: "poll", ids: running, wait: true };
  return { kind: "done" };
}
