import type { EditPlan, Overlay, Shot } from "./plan";

// Hook versions of one plan: version 1 = plan.shots (its hook ends at hookEnds[0]);
// version k ≥ 2 = plan.hooks[k-2] (0..hookEnds[k-1]) + the shared rest shifted by the hook difference.

const r = (n: number) => Math.round(n * 1000) / 1000;

function shiftShot(s: Shot, d: number): Shot {
  const out = { ...s, start: r(s.start + d), end: r(s.end + d) } as Shot;
  if (out.type === "clip" && out.look.shake_at !== null) out.look = { ...out.look, shake_at: r(out.look.shake_at + d) };
  if (out.type === "split" && out.marks_at !== null) out.marks_at = r(out.marks_at + d);
  return out;
}

function shiftOverlay(o: Overlay, d: number): Overlay {
  const out = { ...o, at: r(o.at + d) } as Overlay;
  if ("until" in out && typeof out.until === "number") out.until = r(out.until + d);
  if (out.type === "struck_icon") out.strike_at = r(out.strike_at + d);
  return out;
}

// shots that start before `end`, the last one ending exactly at `end`
function clipTo(shots: Shot[], end: number): Shot[] {
  const kept = [...shots].sort((a, b) => a.start - b.start).filter((s) => s.start < end - 1e-6);
  if (kept.length) kept[kept.length - 1] = { ...kept[kept.length - 1], end } as Shot;
  return kept;
}

// shots after `from`, the first one starting exactly at `from`
function restFrom(shots: Shot[], from: number): Shot[] {
  const kept = [...shots].sort((a, b) => a.start - b.start).filter((s) => s.end > from + 1e-6);
  if (kept.length) kept[0] = { ...kept[0], start: from } as Shot;
  return kept;
}

export function composeVariant(plan: EditPlan, k: number, hookEnds: number[]): EditPlan {
  const hook = plan.hooks[k - 2];
  if (k <= 1 || !hook || hookEnds[k - 1] === undefined) return plan;
  const h1 = hookEnds[0];
  const hk = hookEnds[k - 1];
  const d = hk - h1;
  return {
    ...plan,
    shots: [...clipTo(hook.shots, hk), ...restFrom(plan.shots, h1).map((s) => shiftShot(s, d))],
    overlays: [...hook.overlays.filter((o) => o.at < hk), ...plan.overlays.filter((o) => o.at >= h1).map((o) => shiftOverlay(o, d))],
    sfx: [...hook.sfx.filter((x) => x.at < hk), ...plan.sfx.filter((x) => x.at >= h1).map((x) => ({ ...x, at: r(x.at + d) }))],
    text_plates: plan.text_plates.filter((x) => x.start >= h1).map((x) => ({ ...x, start: r(x.start + d), end: r(x.end + d) })),
    original_audio: plan.original_audio.filter((x) => x.at >= h1).map((x) => ({ ...x, at: r(x.at + d) })),
    hooks: [],
  };
}

// Back from an edited version to the stored plan; the hook/rest boundary stays where it is.
export function decomposeVariant(edited: EditPlan, base: EditPlan, k: number, hookEnds: number[]): EditPlan {
  if (k <= 1 || !base.hooks[k - 2]) return { ...edited, hooks: base.hooks };
  const h1 = hookEnds[0];
  const hk = hookEnds[k - 1];
  const d = hk - h1;
  const hooks = [...base.hooks];
  hooks[k - 2] = {
    shots: clipTo(edited.shots, hk),
    overlays: edited.overlays.filter((o) => o.at < hk),
    sfx: edited.sfx.filter((x) => x.at < hk),
  };
  return {
    ...edited,
    shots: [...clipTo(base.shots, h1), ...restFrom(edited.shots, hk).map((s) => shiftShot(s, -d))],
    overlays: [...base.overlays.filter((o) => o.at < h1), ...edited.overlays.filter((o) => o.at >= hk).map((o) => shiftOverlay(o, -d))],
    sfx: [...base.sfx.filter((x) => x.at < h1), ...edited.sfx.filter((x) => x.at >= hk).map((x) => ({ ...x, at: r(x.at - d) }))],
    text_plates: [...base.text_plates.filter((x) => x.start < h1), ...edited.text_plates.filter((x) => x.start >= hk).map((x) => ({ ...x, start: r(x.start - d), end: r(x.end - d) }))],
    original_audio: [...base.original_audio.filter((x) => x.at < h1), ...edited.original_audio.filter((x) => x.at >= hk).map((x) => ({ ...x, at: r(x.at - d) }))],
    hooks,
  };
}
