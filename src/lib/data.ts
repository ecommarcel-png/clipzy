import "server-only";
import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EMPTY_BRAND_PROFILE, type BrandProfile } from "@/lib/profiles/brand";
import { EMPTY_PRODUCT_PROFILE, type ProductProfile } from "@/lib/profiles/product";
import { withDefaults, type Question } from "@/lib/profiles/common";

// Typed reads used by several pages. Row level security limits them to the
// signed-in user; a missing row means "not yours or doesn't exist" → 404.

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
};

export async function getBrand(supabase: SupabaseClient, id: string): Promise<BrandRow> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data } = await supabase
    .from("brands")
    .select("id, name, website_url, status, logo_path, profile, questions, completeness, summary")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  return {
    ...data,
    profile: withDefaults(EMPTY_BRAND_PROFILE, data.profile),
    questions: (data.questions as Question[]) ?? [],
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
};

export async function getProduct(supabase: SupabaseClient, brandId: string, id: string): Promise<ProductRow> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data } = await supabase
    .from("products")
    .select("id, brand_id, name, product_url, status, profile, questions, completeness, summary")
    .eq("id", id)
    .eq("brand_id", brandId)
    .maybeSingle();
  if (!data) notFound();
  return {
    ...data,
    profile: withDefaults(EMPTY_PRODUCT_PROFILE, data.profile),
    questions: (data.questions as Question[]) ?? [],
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
