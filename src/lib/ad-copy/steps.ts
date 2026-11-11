// Which ad copy items move on in one server action. Pure, so it can be tested.

export type CopyStage = "analyze" | "write" | "done" | "error";

/** items handled in parallel per action (Gemini watching a film or Claude writing: ~15–60 s each) */
export const PER_TICK = 4;

export function pickItems(items: Array<{ id: string; stage: CopyStage }>) {
  // writing finishes what is already analysed; oldest first, so results come in upload order
  const oldest = (s: CopyStage) => items.filter((i) => i.stage === s).map((i) => i.id).reverse();
  const write = oldest("write").slice(0, PER_TICK);
  const analyze = oldest("analyze").slice(0, PER_TICK - write.length);
  const active = items.filter((i) => i.stage === "analyze" || i.stage === "write").length;
  return { write, analyze, active };
}

/** Character limits shown next to the fields (what Meta shows on a phone before cutting). */
export const LIMITS = { hook: 125, headline: 40, description: 30 } as const;

export function firstLine(text: string) {
  return text.split(/\n/).find((l) => l.trim())?.trim() ?? "";
}
