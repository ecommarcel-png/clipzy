import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signedUrls } from "@/lib/storage";
import { listLibrary } from "./library-store";

// What the UI needs to show a library item (thumbnail + one line about it).
export type LibraryCard = {
  id: string;
  brandId: string;
  productId: string | null;
  kind: "clip" | "generated";
  name: string;
  posterUrl: string | null;
  videoUrl: string | null;
  duration: number;
  summary: string;
  uses: number;
  createdAt: string;
};

export async function libraryCards(supabase: SupabaseClient, filter: { brandId?: string; productId?: string }, withVideo = false): Promise<LibraryCard[]> {
  const items = await listLibrary(supabase, filter);
  const urls = await signedUrls(supabase, items.flatMap((i) => [i.poster_path ?? "", withVideo ? i.path : ""]), 3600);
  return items.map((i) => ({
    id: i.id,
    brandId: i.brand_id,
    productId: i.product_id,
    kind: i.kind,
    name: i.name,
    posterUrl: i.poster_path ? urls[i.poster_path] ?? null : null,
    videoUrl: withVideo ? urls[i.path] ?? null : null,
    duration: Number(i.meta.duration ?? 0),
    summary: String((i.analysis as { summary?: string } | null)?.summary ?? i.meta.purpose ?? "").slice(0, 220),
    uses: i.uses,
    createdAt: i.created_at,
  }));
}
