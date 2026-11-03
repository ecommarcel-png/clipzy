import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BUCKET } from "@/lib/storage";
import { cleanName, downloadName } from "@/lib/files";

// "Twoje pliki" storage. Until migration 0005 runs the table is missing:
// every helper then quietly does nothing, so renders keep working.

export async function recordFile(
  supabase: SupabaseClient,
  row: {
    id: string; userId: string; brandId: string; productId: string | null; projectId: string;
    path: string; format: string; variant?: number; name: string;
    meta: { brand_name: string; product_name: string | null; project_name: string };
  },
): Promise<void> {
  await supabase.from("ad_files").insert({
    id: row.id, user_id: row.userId, brand_id: row.brandId, product_id: row.productId, project_id: row.projectId,
    path: row.path, format: row.format, variant: row.variant ?? null, name: cleanName(row.name), meta: row.meta,
  });
}

export async function renameFile(supabase: SupabaseClient, id: string, name: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const clean = cleanName(name);
  if (!clean) return { ok: false, error: "Podaj nazwę." };
  const { data, error } = await supabase.from("ad_files").update({ name: clean }).eq("id", id).select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "Nie znaleziono pliku — uruchom migrację 0005_files.sql." };
  await supabase.from("clip_assets").update({ name: clean }).eq("id", id).eq("kind", "render");
  return { ok: true };
}

export async function deleteFile(supabase: SupabaseClient, id: string): Promise<void> {
  const { data } = await supabase.from("ad_files").select("path").eq("id", id).maybeSingle();
  const { data: asset } = await supabase.from("clip_assets").select("path").eq("id", id).eq("kind", "render").maybeSingle();
  const path = (data?.path ?? asset?.path) as string | undefined;
  await supabase.from("ad_files").delete().eq("id", id);
  await supabase.from("clip_assets").delete().eq("id", id).eq("kind", "render");
  if (path) await supabase.storage.from(BUCKET).remove([path]);
}

export async function fileNames(supabase: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!ids.length) return out;
  const { data } = await supabase.from("ad_files").select("id, name").in("id", ids);
  for (const r of (data ?? []) as Array<{ id: string; name: string }>) if (r.name) out.set(r.id, r.name);
  return out;
}

/** Signed links that download under the file's own name, keyed by id. */
export async function downloadLinks(supabase: SupabaseClient, items: Array<{ id: string; path: string; name: string; ext?: string }>, expiresIn = 3600): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(
    items.map(async (it) => {
      const { data } = await supabase.storage.from(BUCKET).createSignedUrl(it.path, expiresIn, { download: downloadName(it.name, it.ext) });
      if (data?.signedUrl) out[it.id] = data.signedUrl;
    }),
  );
  return out;
}
