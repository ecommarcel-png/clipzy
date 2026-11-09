"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { userMessage } from "@/lib/errors";
import { MissingKeyError, getProviderKey } from "@/lib/api-keys";
import { FalError } from "@/lib/ai/fal";
import { BUCKET } from "@/lib/storage";
import { pathsInUse } from "@/lib/clips/library-store";
import { advanceJobs, loadJobs, type Piece } from "@/lib/text-remover/pipeline";

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

/** Check the keys before the browser uploads anything. */
export async function textRemoverReady(): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase } = await requireUser();
  for (const p of ["gemini", "fal"] as const) {
    try {
      await getProviderKey(supabase, p);
    } catch (e) {
      return { ok: false, error: userMessage(e) };
    }
  }
  return { ok: true };
}

export async function registerTextJobs(files: Array<{ id: string; path: string; name: string }>): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, user } = await requireUser();
  const rows = files
    .filter((f) => isUuid(f.id) && f.path.startsWith(`${user.id}/text-remover/${f.id}/`))
    .map((f) => ({ id: f.id, user_id: user.id, name: f.name.slice(0, 120), src_path: f.path, stage: "detect" }));
  if (!rows.length) return { ok: false, error: "Brak plików." };
  const { error } = await supabase.from("text_jobs").insert(rows);
  if (error) return { ok: false, error: /text_jobs/.test(error.message) ? "Uruchom w Supabase migrację 0007_text_remover.sql (instrukcja w README)." : error.message };
  return { ok: true };
}

export type TickResponse = { ok: true; active: number; wait: boolean } | { ok: false; error: string; stop: boolean };

export async function advanceTextJobsAction(): Promise<TickResponse> {
  const { supabase } = await requireUser();
  try {
    const r = await advanceJobs(supabase);
    if (!r.active) revalidatePath("/files");
    return { ok: true, active: r.active, wait: r.wait };
  } catch (e) {
    const stop = e instanceof MissingKeyError || (e instanceof FalError && /środków|odrzucony/.test(e.message));
    return { ok: false, error: userMessage(e), stop };
  }
}

export async function retryTextJob(id: string): Promise<{ ok: boolean }> {
  const { supabase } = await requireUser();
  if (!isUuid(id)) return { ok: false };
  const [job] = await loadJobs(supabase, [id]);
  if (!job) return { ok: false };
  // keep what fal already repainted, redo only what failed
  const pieces = (job.plan.pieces ?? []).map((p: Piece) => (p.state === "error" ? { ...p, state: "pending" as const, attempts: 0 } : p));
  const stage = !job.plan.band ? "detect" : pieces.some((p) => p.state === "pending") ? "submit" : pieces.every((p) => p.state === "done") ? "compose" : "running";
  await supabase.from("text_jobs").update({ stage, error: null, plan: { ...job.plan, pieces } }).eq("id", id);
  return { ok: true };
}

export async function deleteTextJob(form: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(form.get("jobId") ?? "");
  if (!isUuid(id)) return;
  const dir = `${user.id}/text-remover/${id}`;
  const { data: files } = await supabase.storage.from(BUCKET).list(dir, { limit: 100 });
  const all = (files ?? []).map((f) => `${dir}/${f.name}`);
  // the finished film stays in "Twoje pliki"
  const keep = await pathsInUse(supabase, all);
  const gone = all.filter((p) => !keep.has(p));
  if (gone.length) await supabase.storage.from(BUCKET).remove(gone);
  await supabase.from("text_jobs").delete().eq("id", id);
  revalidatePath("/text-remover");
}
