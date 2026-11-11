"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { userMessage } from "@/lib/errors";
import { MissingKeyError, getProviderKey } from "@/lib/api-keys";
import { BUCKET } from "@/lib/storage";
import { pathsInUse } from "@/lib/clips/library-store";
import { advanceCopy, loadItems, syncFile } from "@/lib/ad-copy/pipeline";

const isUuid = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f-]{36}$/i.test(s);
type Result = { ok: true } | { ok: false; error: string };

/** Keys first: nothing is uploaded when the work could not start. */
export async function adCopyReady(): Promise<Result> {
  const { supabase } = await requireUser();
  for (const p of ["gemini", "anthropic"] as const) {
    try {
      await getProviderKey(supabase, p);
    } catch (e) {
      return { ok: false, error: userMessage(e) };
    }
  }
  return { ok: true };
}

export async function registerCopyItems(input: {
  brandId: string; productId: string | null; note: string;
  uploads: Array<{ id: string; path: string; name: string; kind: "video" | "image" }>;
  files: string[];
}): Promise<Result> {
  const { supabase, user } = await requireUser();
  if (!isUuid(input.brandId)) return { ok: false, error: "Wybierz markę." };
  const base = { user_id: user.id, brand_id: input.brandId, product_id: isUuid(input.productId) ? input.productId : null, note: String(input.note ?? "").slice(0, 1000), stage: "analyze" };
  const rows: Array<Record<string, unknown>> = input.uploads
    .filter((u) => isUuid(u.id) && u.path.startsWith(`${user.id}/ad-copy/${u.id}/`))
    .slice(0, 30)
    .map((u) => ({ ...base, id: u.id, name: u.name.slice(0, 120), path: u.path, kind: u.kind === "image" ? "image" : "video" }));
  // finished ads from "Twoje pliki": the same file, no copy of it
  const fileIds = input.files.filter(isUuid).slice(0, 30);
  if (fileIds.length) {
    const { data } = await supabase.from("ad_files").select("id, path, name, kind").in("id", fileIds);
    for (const f of data ?? []) rows.push({ ...base, file_id: f.id, name: String(f.name).slice(0, 120), path: f.path, kind: f.kind === "image" ? "image" : "video" });
  }
  if (!rows.length) return { ok: false, error: "Brak kreacji." };
  const { error } = await supabase.from("copy_items").insert(rows);
  if (error) return { ok: false, error: /copy_items/.test(error.message) ? "Uruchom w Supabase migrację 0008_ad_copy.sql (instrukcja w README)." : error.message };
  return { ok: true };
}

export async function advanceCopyAction(): Promise<{ ok: true; active: number } | { ok: false; error: string; stop: boolean }> {
  const { supabase } = await requireUser();
  try {
    const r = await advanceCopy(supabase);
    return { ok: true, active: r.active };
  } catch (e) {
    return { ok: false, error: userMessage(e), stop: e instanceof MissingKeyError };
  }
}

/** "Inna wersja": the copywriter writes a different take, optionally following the user's request. */
export async function rewriteCopy(id: string, ask: string): Promise<Result> {
  const { supabase } = await requireUser();
  if (!isUuid(id)) return { ok: false, error: "Brak kreacji." };
  const [item] = await loadItems(supabase, [id]);
  if (!item) return { ok: false, error: "Brak kreacji." };
  const stage = item.analysis ? "write" : "analyze";
  await supabase.from("copy_items").update({ stage, error: null, copy: item.copy ? { ...item.copy, ask: String(ask ?? "").slice(0, 600) } : null }).eq("id", id);
  return { ok: true };
}

export async function saveCopy(id: string, fields: { primary: string; headline: string; description: string }): Promise<Result> {
  const { supabase } = await requireUser();
  if (!isUuid(id)) return { ok: false, error: "Brak kreacji." };
  const [item] = await loadItems(supabase, [id]);
  if (!item?.copy) return { ok: false, error: "Brak tekstu do zapisania." };
  const copy = { ...item.copy, primary: String(fields.primary).slice(0, 3000), headline: String(fields.headline).slice(0, 120), description: String(fields.description).slice(0, 120), edited: true };
  const { error } = await supabase.from("copy_items").update({ copy }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  if (item.file_id) await syncFile(supabase, item.file_id, copy);
  return { ok: true };
}

export async function retryCopy(id: string): Promise<Result> {
  const { supabase } = await requireUser();
  if (!isUuid(id)) return { ok: false, error: "Brak kreacji." };
  const [item] = await loadItems(supabase, [id]);
  if (!item) return { ok: false, error: "Brak kreacji." };
  await supabase.from("copy_items").update({ stage: item.analysis ? "write" : "analyze", error: null }).eq("id", id);
  return { ok: true };
}

export async function deleteCopyItem(form: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(form.get("itemId") ?? "");
  if (!isUuid(id)) return;
  const [item] = await loadItems(supabase, [id]);
  if (!item) return;
  // only a file uploaded here is removed; one from "Twoje pliki" stays there
  if (item.path.startsWith(`${user.id}/ad-copy/`)) {
    const keep = await pathsInUse(supabase, [item.path]);
    if (!keep.has(item.path)) await supabase.storage.from(BUCKET).remove([item.path]);
  }
  await supabase.from("copy_items").delete().eq("id", id);
  revalidatePath("/ad-copy");
}
