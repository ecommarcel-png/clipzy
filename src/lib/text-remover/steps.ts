// Which text-remover jobs move on in one server action. Pure, so it can be tested.

export type JobStage = "detect" | "submit" | "running" | "compose" | "done" | "error";

/** heavy steps per action (they download the film and run ffmpeg / Gemini) */
export const HEAVY = 2;

export function tick(jobs: Array<{ id: string; stage: JobStage }>) {
  const at = (s: JobStage) => jobs.filter((j) => j.stage === s).map((j) => j.id);
  // oldest first, so a big upload finishes film by film
  const oldest = (ids: string[]) => [...ids].reverse();
  let budget = HEAVY;
  const take = (ids: string[]) => {
    const out = oldest(ids).slice(0, budget);
    budget -= out.length;
    return out;
  };
  // finishing films comes first, then sending work to fal, then new films
  const compose = take(at("compose"));
  const submit = take(at("submit"));
  const detect = take(at("detect"));
  const poll = at("running");
  const active = jobs.filter((j) => j.stage !== "done" && j.stage !== "error").length;
  return { compose, submit, detect, poll, active, onlyWaiting: active > 0 && !compose.length && !submit.length && !detect.length };
}
