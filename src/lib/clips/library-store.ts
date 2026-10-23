import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BUCKET } from "@/lib/storage";

// Media library: every analysed upload and every AI shot is kept per brand/product,
// so the next sklejka reuses it without paying for analysis or generation again.

export type LibraryItem = {
  id: string;
  brand_id: string;
  product_id: string | null;
  kind: "clip" | "generated";
  path: string;
  poster_path: string | null;
  name: string;
  meta: Record<string, unknown>;
  analysis: unknown;
  uses: number;
  last_used_at: string;
  created_at: string;
};

export const posterPathFor = (videoPath: string) => videoPath.replace(/\.[^./]+$/, "") + ".poster.jpg";

const KEEP_META = ["duration", "width", "height", "fps", "has_audio", "cuts", "mirrored", "purpose", "prompt", "mode", "poster"];

function libraryMeta(meta: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(meta).filter(([k]) => KEEP_META.includes(k)));
}

// Library is optional until migration 0004 runs — never break a sklejka because of it.
function missingTable(e: { message?: string; code?: string } | null) {
  return Boolean(e && (e.code === "42P01" || e.code === "PGRST205" || /media_library|library_id|does not exist|schema cache/i.test(e.message ?? "")));
}

export async function saveToLibrary(
  supabase: SupabaseClient,
  project: { id: string; brand_id: string; product_id: string | null },
  asset: { id: string; kind: string; path: string | null; name: string; meta: Record<string, unknown>; analysis: unknown; library_id?: string | null },
) {
  if (asset.kind !== "clip" && asset.kind !== "generated") return;
  if (!asset.path || asset.library_id) return;
  const { data, error } = await supabase
    .from("media_library")
    .upsert(
      {
        brand_id: project.brand_id,
        product_id: project.product_id,
        kind: asset.kind,
        path: asset.path,
        poster_path: (asset.meta.poster as string) ?? null,
        name: asset.name,
        meta: libraryMeta(asset.meta),
        analysis: asset.analysis,
        source_project_id: project.id,
      },
      { onConflict: "user_id,path" },
    )
    .select("id")
    .single();
  if (error) {
    if (!missingTable(error)) console.error("library save", error.message);
    return;
  }
  await supabase.from("clip_assets").update({ library_id: data.id }).eq("id", asset.id);
}

export async function listLibrary(supabase: SupabaseClient, filter: { brandId?: string; productId?: string }): Promise<LibraryItem[]> {
  let q = supabase.from("media_library").select("*").order("last_used_at", { ascending: false }).limit(300);
  if (filter.brandId) q = q.eq("brand_id", filter.brandId);
  if (filter.productId) q = q.eq("product_id", filter.productId);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as LibraryItem[];
}

// Copy chosen library items into a new project as ready-to-use assets (no new analysis).
export async function attachLibrary(supabase: SupabaseClient, userId: string, project: { id: string; brand_id: string }, ids: string[]) {
  if (!ids.length) return 0;
  const { data, error } = await supabase.from("media_library").select("*").in("id", ids).eq("brand_id", project.brand_id);
  if (error || !data?.length) return 0;
  const items = data as LibraryItem[];
  const rows = items.map((l) => ({
    user_id: userId,
    project_id: project.id,
    kind: l.kind,
    path: l.path,
    name: l.name,
    status: "ready",
    meta: { ...l.meta, from_library: true },
    analysis: l.analysis,
    library_id: l.id,
  }));
  const { error: insErr } = await supabase.from("clip_assets").insert(rows);
  if (insErr) throw new Error(insErr.message);
  const now = new Date().toISOString();
  await Promise.all(items.map((l) => supabase.from("media_library").update({ uses: l.uses + 1, last_used_at: now }).eq("id", l.id)));
  return items.length;
}

// Storage paths that something else still needs: the library, or another sklejka.
export async function pathsInUse(supabase: SupabaseClient, paths: string[], exceptProjectId?: string): Promise<Set<string>> {
  const keep = new Set<string>();
  if (!paths.length) return keep;
  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100);
    const [byPath, byPoster] = await Promise.all([
      supabase.from("media_library").select("path, poster_path").in("path", chunk),
      supabase.from("media_library").select("path, poster_path").in("poster_path", chunk),
    ]);
    for (const r of [...(byPath.data ?? []), ...(byPoster.data ?? [])] as Array<{ path: string; poster_path: string | null }>) {
      keep.add(r.path);
      if (r.poster_path) keep.add(r.poster_path);
    }
    let a = supabase.from("clip_assets").select("path, meta").in("path", chunk);
    if (exceptProjectId) a = a.neq("project_id", exceptProjectId);
    const used = await a;
    for (const r of (used.data ?? []) as Array<{ path: string; meta: Record<string, unknown> }>) {
      keep.add(r.path);
      if (typeof r.meta?.poster === "string") keep.add(r.meta.poster);
    }
  }
  for (const p of [...keep]) keep.add(posterPathFor(p));
  return keep;
}

export async function deleteLibraryItem(supabase: SupabaseClient, id: string) {
  const { data } = await supabase.from("media_library").select("*").eq("id", id).maybeSingle();
  if (!data) return;
  const item = data as LibraryItem;
  await supabase.from("media_library").delete().eq("id", id);
  // the file goes only when no sklejka uses it any more
  const files = [item.path, item.poster_path].filter((x): x is string => Boolean(x));
  const keep = await pathsInUse(supabase, files);
  const gone = files.filter((f) => !keep.has(f));
  if (gone.length) await supabase.storage.from(BUCKET).remove(gone);
}
