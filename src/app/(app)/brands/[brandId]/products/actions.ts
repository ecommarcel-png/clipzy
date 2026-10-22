"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getProviderKey } from "@/lib/api-keys";
import { analyzeProduct, productEvidence, refineProduct, type ProductAnalysis } from "@/lib/ai/product";
import { reviewProfile } from "@/lib/ai/review";
import { controlLoop } from "@/lib/ai/control";
import { scrapeProductPage, type ProductSource } from "@/lib/scrape/product";
import { writeWithReview } from "@/lib/data";
import { EMPTY_BRAND_PROFILE, type BrandProfile } from "@/lib/profiles/brand";
import { EMPTY_PRODUCT_PROFILE, ProductProfileSchema, upgradeProductProfile } from "@/lib/profiles/product";
import { productCompleteness } from "@/lib/profiles/completeness";
import { cleanLists, withDefaults, type AnsweredQuestion } from "@/lib/profiles/common";
import { BUCKET, importImage, isClaudeReadableImage, productFolder, signedUrls } from "@/lib/storage";
import { userMessage } from "@/lib/errors";
import type { RefineResult, SaveResult } from "@/components/profile-editor";
import type { SupabaseClient } from "@supabase/supabase-js";

export type NewProductState = { error?: string };

const MAX_IMPORTED_IMAGES = 8;

async function brandProfile(supabase: SupabaseClient, brandId: string) {
  const { data } = await supabase.from("brands").select("id, profile").eq("id", brandId).maybeSingle();
  return data ? withDefaults(EMPTY_BRAND_PROFILE, data.profile) : null;
}

// Leave room for the final re-check inside the 300 s page limit.
const CONTROL_BUDGET_MS = 170_000;

// Questions are optional and capped: the profile must be usable without them.
const MAX_QUESTIONS = 3;

function normalizeDraft(d: ProductAnalysis): ProductAnalysis {
  return {
    ...d,
    profile: cleanLists(withDefaults(EMPTY_PRODUCT_PROFILE, upgradeProductProfile(d.profile))),
    questions: d.questions.slice(0, MAX_QUESTIONS),
  };
}

// Draft → independent Controller → correction → final check.
async function controlProduct(
  apiKey: string,
  draft: ProductAnalysis,
  ctx: { brand: BrandProfile; source: ProductSource | null; notes: string; answers: AnsweredQuestion[]; imageUrls: string[]; startedAt: number },
) {
  return controlLoop({
    draft: normalizeDraft(draft),
    review: (d) =>
      reviewProfile(apiKey, {
        kind: "produkt",
        profile: d.profile,
        brandProfile: ctx.brand,
        evidence: productEvidence(ctx.source, ctx.notes, ctx.answers),
      }),
    revise: async (d, issues) =>
      normalizeDraft(
        await refineProduct(apiKey, {
          brand: ctx.brand,
          profile: d.profile,
          answers: ctx.answers,
          imageUrls: ctx.imageUrls,
          source: ctx.source,
          notes: ctx.notes,
          controlIssues: issues,
          openQuestions: d.questions,
        }),
      ),
    hasTimeFor: () => Date.now() - ctx.startedAt < CONTROL_BUDGET_MS,
  });
}

export async function createProduct(brandId: string, _prev: NewProductState, formData: FormData): Promise<NewProductState> {
  const startedAt = Date.now();
  const { supabase, user } = await requireUser();
  const url = String(formData.get("url") ?? "").trim();
  const nameHint = String(formData.get("name") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 4000);
  if (!url && !nameHint) return { error: "Podaj link do produktu albo przynajmniej jego nazwę." };

  const brand = await brandProfile(supabase, brandId);
  if (!brand) return { error: "Nie znaleziono marki." };

  // The id is chosen up front so photos can be stored before the analysis:
  // Claude then sees our stored copies instead of the shop's own URLs.
  const productId = randomUUID();
  const folder = productFolder(user.id, productId);
  let storedPaths: string[] = [];
  try {
    const apiKey = await getProviderKey(supabase, "anthropic");
    const source = url ? await scrapeProductPage(url) : null;
    const name = nameHint || source?.title || "Nowy produkt";

    const images = (source?.images ?? []).slice(0, MAX_IMPORTED_IMAGES);
    const stored = await Promise.all(images.map((img, i) => importImage(supabase, img, folder, `src-${i}`)));
    storedPaths = stored.filter((p): p is string => Boolean(p));

    const readable = storedPaths.filter(isClaudeReadableImage).slice(0, 4);
    const signed = await signedUrls(supabase, readable, 900);
    const imageUrls = readable.map((p) => signed[p]).filter(Boolean);
    const analysis = await analyzeProduct(apiKey, { brand, source, nameHint: name, notes, imageUrls });
    if (nameHint) analysis.profile.name = nameHint;

    const { result, report } = await controlProduct(apiKey, analysis, { brand, source, notes, answers: [], imageUrls, startedAt });
    const profile = result.profile;
    if (nameHint) profile.name = nameHint;

    const { error } = await writeWithReview((payload) => supabase.from("products").insert(payload), {
      id: productId,
      user_id: user.id,
      brand_id: brandId,
      name: profile.name || name,
      product_url: source?.url ?? null,
      profile,
      questions: result.questions,
      completeness: productCompleteness(profile).score,
      summary: result.summary,
      review: report,
      source: { ...(source ?? {}), notes },
    });
    if (error) throw new Error(error.message);

    const rows = stored.flatMap((path, i) =>
      path ? [{ user_id: user.id, product_id: productId, storage_path: path, source_url: images[i], sort_order: i }] : [],
    );
    if (rows.length) await supabase.from("product_images").insert(rows);
  } catch (e) {
    // Don't leave orphaned files behind when the product wasn't created.
    if (storedPaths.length) await supabase.storage.from(BUCKET).remove(storedPaths);
    return { error: userMessage(e) };
  }

  revalidatePath(`/brands/${brandId}`);
  redirect(`/brands/${brandId}/products/${productId}`);
}

async function productImageUrls(supabase: SupabaseClient, productId: string) {
  const { data } = await supabase.from("product_images").select("storage_path").eq("product_id", productId).order("sort_order");
  const paths = (data ?? []).map((r) => r.storage_path).filter(isClaudeReadableImage).slice(0, 4);
  const map = await signedUrls(supabase, paths, 900);
  return paths.map((p) => map[p]).filter(Boolean);
}

function parseProfile(raw: unknown) {
  const parsed = ProductProfileSchema.safeParse(cleanLists(withDefaults(EMPTY_PRODUCT_PROFILE, upgradeProductProfile(raw))));
  return parsed.success ? parsed.data : null;
}

export async function refineProductAction(
  brandId: string,
  productId: string,
  rawProfile: Record<string, unknown>,
  answers: AnsweredQuestion[],
): Promise<RefineResult> {
  const startedAt = Date.now();
  const { supabase } = await requireUser();
  const profile = parseProfile(rawProfile);
  if (!profile) return { ok: false, error: "Niektóre pola mają nieprawidłowy format." };
  const brand = await brandProfile(supabase, brandId);
  if (!brand) return { ok: false, error: "Nie znaleziono marki." };
  const { data: row } = await supabase.from("products").select("source").eq("id", productId).eq("brand_id", brandId).maybeSingle();
  if (!row) return { ok: false, error: "Nie znaleziono produktu." };

  try {
    const apiKey = await getProviderKey(supabase, "anthropic");
    const stored = (row.source ?? {}) as ProductSource & { notes?: string };
    const source = stored.url ? (stored as ProductSource) : null;
    const notes = stored.notes ?? "";
    const imageUrls = await productImageUrls(supabase, productId);

    const focus = productCompleteness(profile).missing;
    const draft = await refineProduct(apiKey, { brand, profile, answers, imageUrls, source, notes, focus });
    const { result, report } = await controlProduct(apiKey, draft, { brand, source, notes, answers, imageUrls, startedAt });

    const { error } = await writeWithReview(
      (payload) => supabase.from("products").update(payload).eq("id", productId).eq("brand_id", brandId),
      {
        profile: result.profile,
        name: result.profile.name || undefined,
        questions: result.questions,
        completeness: productCompleteness(result.profile).score,
        summary: result.summary,
        review: report,
      },
    );
    if (error) throw new Error(error.message);
    revalidatePath(`/brands/${brandId}`);
    return {
      ok: true,
      profile: result.profile as unknown as Record<string, unknown>,
      questions: result.questions,
      summary: result.summary,
      review: report,
    };
  } catch (e) {
    return { ok: false, error: userMessage(e) };
  }
}

export async function saveProductAction(
  brandId: string,
  productId: string,
  rawProfile: Record<string, unknown>,
  finish: boolean,
): Promise<SaveResult> {
  const { supabase } = await requireUser();
  const profile = parseProfile(rawProfile);
  if (!profile) return { ok: false, error: "Niektóre pola mają nieprawidłowy format." };
  if (!profile.name.trim()) return { ok: false, error: "Produkt musi mieć nazwę." };

  const { error } = await supabase
    .from("products")
    .update({ profile, name: profile.name, completeness: productCompleteness(profile).score, ...(finish ? { status: "ready" } : {}) })
    .eq("id", productId)
    .eq("brand_id", brandId);
  if (error) return { ok: false, error: `Nie udało się zapisać: ${error.message}` };
  revalidatePath(`/brands/${brandId}`);
  if (finish) redirect(`/brands/${brandId}`);
  return { ok: true, message: "Zapisano." };
}

export async function addProductImages(brandId: string, productId: string, paths: string[]): Promise<SaveResult> {
  const { supabase, user } = await requireUser();
  const folder = productFolder(user.id, productId);
  if (paths.some((p) => !p.startsWith(`${folder}/`))) return { ok: false, error: "Nieprawidłowa ścieżka pliku." };
  const { count } = await supabase.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", productId);
  const start = count ?? 0;
  const { error } = await supabase
    .from("product_images")
    .insert(paths.map((storage_path, i) => ({ user_id: user.id, product_id: productId, storage_path, sort_order: start + i })));
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/brands/${brandId}/products/${productId}`);
  return { ok: true, message: "Dodano zdjęcia." };
}

export async function deleteProductImage(formData: FormData) {
  const { supabase } = await requireUser();
  const imageId = String(formData.get("imageId") ?? "");
  const brandId = String(formData.get("brandId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const { data } = await supabase.from("product_images").select("storage_path").eq("id", imageId).maybeSingle();
  if (data) {
    await supabase.storage.from(BUCKET).remove([data.storage_path]);
    await supabase.from("product_images").delete().eq("id", imageId);
  }
  revalidatePath(`/brands/${brandId}/products/${productId}`);
}

export async function deleteProduct(formData: FormData) {
  const { supabase, user } = await requireUser();
  const brandId = String(formData.get("brandId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const folder = productFolder(user.id, productId);
  const { data: files } = await supabase.storage.from(BUCKET).list(folder);
  if (files?.length) await supabase.storage.from(BUCKET).remove(files.map((f) => `${folder}/${f.name}`));
  await supabase.from("products").delete().eq("id", productId).eq("brand_id", brandId);
  revalidatePath(`/brands/${brandId}`);
  redirect(`/brands/${brandId}`);
}
