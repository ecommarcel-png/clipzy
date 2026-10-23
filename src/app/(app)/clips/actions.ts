"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { userMessage } from "@/lib/errors";
import {
  analyzeAsset, applyFeedback, loadProject, makePlan, pollGenerations, processVoiceover, requestMissing, reviewRendered,
  type ClipSettings,
} from "@/lib/clips/pipeline";
import { FORMATS } from "@/lib/clips/plan";
import { getProviderKey } from "@/lib/api-keys";
import type { Provider } from "@/lib/providers";

export type StepResult = { ok: true; message?: string } | { ok: false; error: string };

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

export async function createClipProject(_: unknown, form: FormData): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  const brandId = String(form.get("brandId") ?? "");
  const productId = String(form.get("productId") ?? "");
  if (!isUuid(brandId)) return { error: "Wybierz markę." };
  // The module needs these keys; say which one is missing before any upload.
  const needed: Provider[] = ["anthropic", "gemini"];
  if (form.get("voiceover") === "yes") needed.push("elevenlabs");
  for (const p of needed) {
    try {
      await getProviderKey(supabase, p);
    } catch (e) {
      return { error: userMessage(e) };
    }
  }
  const formats = FORMATS.filter((f) => form.getAll("formats").includes(f));
  const settings: ClipSettings = {
    voiceover: form.get("voiceover") === "yes",
    music: String(form.get("music") ?? "auto"),
    formats: formats.length ? formats : ["4x5"],
    notes: String(form.get("notes") ?? "").slice(0, 1000),
  };
  const id = randomUUID();
  const { error } = await supabase.from("clip_projects").insert({
    id,
    user_id: user.id,
    brand_id: brandId,
    product_id: isUuid(productId) ? productId : null,
    name: String(form.get("name") ?? "").slice(0, 80) || "Nowa sklejka",
    settings,
  });
  if (error) return { error: /relation|does not exist/i.test(error.message) ? "Uruchom w Supabase migrację 0003_clips.sql (instrukcja w README)." : error.message };
  redirect(`/clips/${id}`);
}

export async function registerUploads(projectId: string, files: Array<{ id: string; path: string; name: string; kind: "clip" | "voiceover" }>): Promise<StepResult> {
  const { supabase, user } = await requireUser();
  if (!isUuid(projectId)) return { ok: false, error: "Zły projekt." };
  const rows = files
    .filter((f) => isUuid(f.id) && f.path.startsWith(`${user.id}/clips/${projectId}/`))
    .map((f) => ({ id: f.id, user_id: user.id, project_id: projectId, kind: f.kind, path: f.path, name: f.name.slice(0, 120), status: "uploaded" }));
  if (!rows.length) return { ok: false, error: "Brak plików do zapisania." };
  const { error } = await supabase.from("clip_assets").insert(rows);
  if (error) return { ok: false, error: error.message };
  await supabase.from("clip_projects").update({ status: "analyzing" }).eq("id", projectId);
  return { ok: true };
}

async function withProject<T>(projectId: string, fn: (ctx: Awaited<ReturnType<typeof requireUser>> & { data: NonNullable<Awaited<ReturnType<typeof loadProject>>> }) => Promise<T>): Promise<T | StepResult> {
  try {
    const auth = await requireUser();
    const data = await loadProject(auth.supabase, projectId);
    if (!data) return { ok: false, error: "Nie znaleziono projektu." };
    return await fn({ ...auth, data });
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e; // redirects
    return { ok: false, error: userMessage(e) };
  }
}

export async function analyzeAssetAction(projectId: string, assetId: string): Promise<StepResult> {
  return withProject(projectId, async ({ supabase, data }) => {
    const asset = data.assets.find((a) => a.id === assetId);
    if (!asset) return { ok: false, error: "Nie znaleziono pliku." };
    await analyzeAsset(supabase, data.project, asset);
    return { ok: true };
  }) as Promise<StepResult>;
}

export async function voiceoverAction(projectId: string): Promise<StepResult> {
  return withProject(projectId, async ({ supabase, data }) => {
    const vo = data.assets.find((a) => a.kind === "voiceover");
    if (!vo) return { ok: true, message: "Bez lektora." };
    const r = await processVoiceover(supabase, data.project, vo);
    return { ok: true, message: `Lektor: ${r.timeline.original.toFixed(1)} s → ${r.timeline.duration.toFixed(1)} s po wycięciu pauz.` };
  }) as Promise<StepResult>;
}

export async function missingAction(projectId: string): Promise<StepResult> {
  return withProject(projectId, async ({ supabase, user, data }) => {
    await supabase.from("clip_projects").update({ status: "generating" }).eq("id", projectId);
    const r = await requestMissing(supabase, user.id, data.project, data.assets);
    return { ok: true, message: r.notes };
  }) as Promise<StepResult>;
}

export async function pollAction(projectId: string): Promise<StepResult & { pending?: number }> {
  return withProject(projectId, async ({ supabase, user, data }) => {
    const r = await pollGenerations(supabase, user.id, data.project, data.assets);
    return { ok: true as const, pending: r.pending };
  }) as Promise<StepResult & { pending?: number }>;
}

export async function planAction(projectId: string): Promise<StepResult> {
  return withProject(projectId, async ({ supabase, data }) => {
    await supabase.from("clip_projects").update({ status: "planning", error: null }).eq("id", projectId);
    try {
      await makePlan(supabase, data.project, data.assets);
    } catch (e) {
      await supabase.from("clip_projects").update({ status: "error", error: userMessage(e) }).eq("id", projectId);
      throw e;
    }
    revalidatePath(`/clips/${projectId}`);
    return { ok: true };
  }) as Promise<StepResult>;
}

export async function feedbackAction(projectId: string, text: string): Promise<StepResult> {
  if (!text.trim()) return { ok: false, error: "Napisz, co zmienić." };
  return withProject(projectId, async ({ supabase, data }) => {
    await supabase.from("clip_projects").update({ status: "planning" }).eq("id", projectId);
    const r = await applyFeedback(supabase, data.project, data.assets, text.slice(0, 2000));
    revalidatePath(`/clips/${projectId}`);
    return {
      ok: true,
      message: r.preferences.length ? `Zapamiętane dla marki: ${r.preferences.join("; ")}.` : "Plan poprawiony.",
    };
  }) as Promise<StepResult>;
}

export async function saveRenderAction(projectId: string, file: { id: string; path: string; format: string }): Promise<StepResult & { assetId?: string }> {
  return withProject(projectId, async ({ supabase, user }) => {
    if (!isUuid(file.id) || !file.path.startsWith(`${user.id}/clips/${projectId}/`)) return { ok: false as const, error: "Zła ścieżka renderu." };
    const { error } = await supabase.from("clip_assets").insert({
      id: file.id, user_id: user.id, project_id: projectId, kind: "render", path: file.path, name: `Render ${file.format}`, status: "ready", meta: { format: file.format },
    });
    if (error) return { ok: false as const, error: error.message };
    await supabase.from("clip_projects").update({ status: "rendered" }).eq("id", projectId);
    return { ok: true as const, assetId: file.id };
  }) as Promise<StepResult & { assetId?: string }>;
}

export async function reviewRenderAction(projectId: string, renderId: string): Promise<StepResult> {
  return withProject(projectId, async ({ supabase, data }) => {
    const r = data.assets.find((a) => a.id === renderId && a.kind === "render");
    if (!r) return { ok: false, error: "Nie znaleziono renderu." };
    const review = await reviewRendered(supabase, data.project, r);
    return { ok: true, message: `Kontroler: ${review.score}/10` };
  }) as Promise<StepResult>;
}

export async function deleteClipProject(form: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(form.get("projectId") ?? "");
  if (!isUuid(id)) return;
  const { data: files } = await supabase.storage.from("media").list(`${user.id}/clips/${id}`, { limit: 1000 });
  if (files?.length) await supabase.storage.from("media").remove(files.map((f) => `${user.id}/clips/${id}/${f.name}`));
  await supabase.from("clip_projects").delete().eq("id", id);
  redirect("/clips");
}
