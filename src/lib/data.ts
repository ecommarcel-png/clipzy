import "server-only";
import { notFound } from "next/navigation";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { EMPTY_BRAND_PROFILE, type BrandProfile } from "@/lib/profiles/brand";
import { EMPTY_PRODUCT_PROFILE, type ProductProfile } from "@/lib/profiles/product";
import { withDefaults, type Question } from "@/lib/profiles/common";
import type { ControlReport } from "@/lib/ai/control";

// Typed reads used by several pages. Row level security limits them to the
// signed-in user; a missing row means "not yours or doesn't exist" → 404.
// select("*") keeps pages working even before an optional migration is run.

export type BrandRow = {
  id: string;
  name: string;
  website_url: string | null;
  status: "draft" | "ready";
  logo_path: string | null;
  profile: BrandProfile;
  questions: Question[];
  completeness: number;
  summary: string;
  review: ControlReport | null;
  source: Record<string, unknown>;
};

export async function getBrand(supabase: SupabaseClient, id: string): Promise<BrandRow> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data } = await supabase.from("brands").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  return {
    ...data,
    profile: withDefaults(EMPTY_BRAND_PROFILE, data.profile),
    questions: (data.questions as Question[]) ?? [],
    review: (data.review as ControlReport | undefined) ?? null,
    source: (data.source as Record<string, unknown>) ?? {},
  } as BrandRow;
}

export type ProductRow = {
  id: string;
  brand_id: string;
  name: string;
  product_url: string | null;
  status: "draft" | "ready";
  profile: ProductProfile;
  questions: Question[];
  completeness: number;
  summary: string;
  review: ControlReport | null;
  source: Record<string, unknown>;
};

export async function getProduct(supabase: SupabaseClient, brandId: string, id: string): Promise<ProductRow> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data } = await supabase.from("products").select("*").eq("id", id).eq("brand_id", brandId).maybeSingle();
  if (!data) notFound();
  return {
    ...data,
    profile: withDefaults(EMPTY_PRODUCT_PROFILE, data.profile),
    questions: (data.questions as Question[]) ?? [],
    review: (data.review as ControlReport | undefined) ?? null,
    source: (data.source as Record<string, unknown>) ?? {},
  } as ProductRow;
}

export async function getProductImages(supabase: SupabaseClient, productId: string) {
  const { data } = await supabase
    .from("product_images")
    .select("id, storage_path, sort_order")
    .eq("product_id", productId)
    .order("sort_order");
  return data ?? [];
}

// The `review` column comes from migration 0002. If it hasn't been run yet,
// save everything else instead of failing the whole operation.
function missingReviewColumn(error: PostgrestError | null) {
  return Boolean(error && /review/.test(error.message) && /(column|schema cache)/i.test(error.message));
}

export async function writeWithReview(
  run: (payload: Record<string, unknown>) => PromiseLike<{ error: PostgrestError | null }>,
  payload: Record<string, unknown>,
): Promise<{ error: PostgrestError | null }> {
  const first = await run(payload);
  if (!missingReviewColumn(first.error)) return first;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { review, ...rest } = payload;
  return run(rest);
}
