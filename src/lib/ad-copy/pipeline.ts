import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getProviderKey } from "@/lib/api-keys";
import { getBrand, getProduct } from "@/lib/data";
import { BUCKET } from "@/lib/storage";
import { analyzeCreative, CreativeAnalysis } from "@/lib/ai/gemini";
import { writeAdCopy, type AdCopy } from "@/lib/ai/ad-copy";
import { userMessage } from "@/lib/errors";
import { pickItems, type CopyStage } from "./steps";

// Ad copy: Gemini watches each creative, the copywriter writes the text that finishes it.

export type CopyItem = {
  id: string; brand_id: string | null; product_id: string | null; file_id: string | null;
  name: string; path: string; kind: "video" | "image"; note: string; stage: CopyStage;
  analysis: CreativeAnalysis | null;
  /** the text, plus a request for a different version (`ask`) while it is being rewritten */
  copy: (AdCopy & { ask?: string; edited?: boolean }) | null;
  error: string | null; created_at: string;
};

const COLS = "id, brand_id, product_id, file_id, name, path, kind, note, stage, analysis, copy, error, created_at";

export async function loadItems(supabase: SupabaseClient, ids?: string[]): Promise<CopyItem[]> {
  let q = supabase.from("copy_items").select(COLS).order("created_at", { ascending: false }).limit(200);
  if (ids) q = q.in("id", ids);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as CopyItem[];
}

function mimeOf(item: Pick<CopyItem, "kind" | "path">) {
  if (item.kind === "video") return /\.webm$/i.test(item.path) ? "video/webm" : /\.mov$/i.test(item.path) ? "video/quicktime" : "video/mp4";
  return /\.jpe?g$/i.test(item.path) ? "image/jpeg" : /\.webp$/i.test(item.path) ? "image/webp" : "image/png";
}

async function update(supabase: SupabaseClient, id: string, v: Record<string, unknown>) {
  await supabase.from("copy_items").update(v).eq("id", id);
}

/** One round: write what is analysed, analyse what is new — several items in parallel. */
export async function advanceCopy(supabase: SupabaseClient): Promise<{ active: number }> {
  const items = (await loadItems(supabase)).filter((i) => i.stage === "analyze" || i.stage === "write");
  const pick = pickItems(items);
  if (!pick.write.length && !pick.analyze.length) return { active: 0 };
  // a missing key stops everything (the page shows it), so ask for keys before any work
  const gemini = pick.analyze.length ? await getProviderKey(supabase, "gemini") : "";
  const anthropic = pick.write.length ? await getProviderKey(supabase, "anthropic") : "";

  const brands = new Map<string, Promise<Awaited<ReturnType<typeof getBrand>>>>();
  const products = new Map<string, Promise<Awaited<ReturnType<typeof getProduct>> | null>>();
  const brandOf = (id: string) => brands.get(id) ?? brands.set(id, getBrand(supabase, id)).get(id)!;
  const productOf = (brandId: string, id: string | null) =>
    !id ? Promise.resolve(null) : products.get(id) ?? products.set(id, getProduct(supabase, brandId, id).catch(() => null)).get(id)!;

  const byId = new Map(items.map((i) => [i.id, i]));
  await Promise.all([
    ...pick.analyze.map(async (id) => {
      const item = byId.get(id)!;
      try {
        await update(supabase, id, { error: null });
        const { data, error } = await supabase.storage.from(BUCKET).download(item.path);
        if (error || !data) throw new Error("Nie udało się pobrać kreacji z magazynu.");
        const product = item.brand_id ? await productOf(item.brand_id, item.product_id) : null;
        const analysis = await analyzeCreative(gemini, Buffer.from(await data.arrayBuffer()), mimeOf(item), product?.name ?? "produkt marki");
        await update(supabase, id, { analysis, stage: "write" });
      } catch (e) {
        await update(supabase, id, { stage: "error", error: userMessage(e) });
      }
    }),
    ...pick.write.map(async (id) => {
      const item = byId.get(id)!;
      try {
        if (!item.brand_id) throw new Error("Marka tej kreacji została usunięta — wybierz markę i wrzuć kreację ponownie.");
        if (!item.analysis) return update(supabase, id, { stage: "analyze" });
        const [brand, product] = await Promise.all([brandOf(item.brand_id), productOf(item.brand_id, item.product_id)]);
        const copy = await writeAdCopy(anthropic, {
          brand: { name: brand.name, profile: brand.profile },
          product: product ? { name: product.name, profile: product.profile } : null,
          creative: item.analysis,
          kind: item.kind,
          note: item.note,
          previous: item.copy,
          ask: item.copy?.ask,
        });
        await update(supabase, id, { copy, stage: "done" });
        if (item.file_id) await syncFile(supabase, item.file_id, copy);
      } catch (e) {
        await update(supabase, id, { stage: "error", error: userMessage(e) });
      }
    }),
  ]);
  const left = (await loadItems(supabase, items.map((i) => i.id))).filter((i) => i.stage === "analyze" || i.stage === "write").length;
  return { active: left };
}

/** A creative picked from "Twoje pliki" keeps its copy there too (copy button on the file). */
export async function syncFile(supabase: SupabaseClient, fileId: string, copy: Pick<AdCopy, "primary" | "headline" | "description">) {
  const { data } = await supabase.from("ad_files").select("meta").eq("id", fileId).maybeSingle();
  if (!data) return;
  const meta = (data.meta ?? {}) as Record<string, unknown>;
  await supabase.from("ad_files").update({ meta: { ...meta, copy: { primary_text: copy.primary, headline: copy.headline, description: copy.description } } }).eq("id", fileId);
}
