// What the sklejka pipeline does next, decided from a fresh snapshot of the
// server state (never from stale UI data). Pure, so it can be tested.

export type PipelineState = {
  assets: Array<{ id: string; kind: "clip" | "generated" | "voiceover" | "render"; status: string }>;
  /** none = no voiceover in this sklejka; pending = uploaded, not processed yet */
  voiceover: "none" | "pending" | "done" | "error" | "script_needed" | "script_ready";
  /** settings.generated — "done" once the Reżyser decided what to generate */
  generated: string | undefined;
  /** some AI shot is still being generated at fal */
  generating: boolean;
  hasPlan: boolean;
};

export type Step = { kind: "analyze"; ids: string[] } | { kind: "script" } | { kind: "wait_user" } | { kind: "voiceover" } | { kind: "missing" } | { kind: "poll" } | { kind: "plan" } | { kind: "done" };

export const ANALYZE_BATCH = 3;

export function nextStep(s: PipelineState): Step {
  const waiting = s.assets
    .filter((a) => (a.kind === "clip" || a.kind === "generated") && (a.status === "uploaded" || a.status === "analyzing"))
    .map((a) => a.id);
  if (waiting.length) return { kind: "analyze", ids: waiting.slice(0, ANALYZE_BATCH) };
  // generated voiceover: the script is written, then the user edits it and clicks "Generuj lektora"
  if (s.voiceover === "script_needed") return { kind: "script" };
  if (s.voiceover === "script_ready") return { kind: "wait_user" };
  if (s.voiceover === "pending") return { kind: "voiceover" };
  if (s.generated !== "done") return { kind: "missing" };
  if (s.generating) return { kind: "poll" };
  if (!s.hasPlan) return { kind: "plan" };
  return { kind: "done" };
}
