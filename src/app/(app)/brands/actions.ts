"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getProviderKey } from "@/lib/api-keys";
import { analyzeBrand, refineBrand } from "@/lib/ai/brand";
import { scrapeBrandSite, type BrandSource } from "@/lib/scrape/site";
import { normalizeUrl } from "@/lib/scrape/safe-fetch";
import { BrandProfileSchema, EMPTY_BRAND_PROFILE } from "@/lib/profiles/brand";
import { cleanLists, withDefaults, type AnsweredQuestion } from "@/lib/profiles/common";
import { brandFolder, importImage } from "@/lib/storage";
import { userMessage } from "@/lib/errors";
import type { RefineResult, SaveResult } from "@/components/profile-editor";

export type NewBrandState = { error?: string };

export async function createBrand(_prev: NewBrandState, formData: FormData): Promise<NewBrandState> {
  const { supabase, user } = await requireUser();
  const rawUrl = String(formData.get("url") ?? "").trim();
  const nameHint = String(formData.get("name") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 4000);

  if (!rawUrl && !nameHint) return { error: "Podaj adres sklepu albo przynajmniej nazwę marki." };

  let brandId: string;
  try {
    const apiKey = await getProviderKey(supabase, "anthropic");
    const source = rawUrl ? await scrapeBrandSite(rawUrl) : null;
    const analysis = await analyzeBrand(apiKey, { source, nameHint, notes });
    const profile = cleanLists(withDefaults(EMPTY_BRAND_PROFILE, analysis.profile));
    if (nameHint) profile.name = nameHint;

    const { data, error } = await supabase
      .from("brands")
      .insert({
        user_id: user.id,
        name: profile.name || nameHint || new URL(source?.url ?? normalizeUrl(rawUrl)).hostname,
        website_url: source?.url ?? null,
        profile,
        questions: analysis.questions,
        completeness: clampPct(analysis.completeness),
        summary: analysis.summary,
        source: { ...(source ?? {}), notes },
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    brandId = data.id;

    // Logo: Claude's pick first, then the other candidates.
    const candidates = [analysis.logo_url, ...(source?.home.logoCandidates ?? [])].filter(Boolean);
    for (const url of candidates.slice(0, 3)) {
      const path = await importImage(supabase, url, brandFolder(user.id, brandId), "logo");
      if (path) {
        await supabase.from("brands").update({ logo_path: path }).eq("id", brandId);
        break;
      }
    }
  } catch (e) {
    return { error: userMessage(e) };
  }

  revalidatePath("/brands");
  redirect(`/brands/${brandId}/setup`);
}

function clampPct(n: number) {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(n) ? n : 0)));
}

function parseProfile(raw: unknown) {
  const merged = cleanLists(withDefaults(EMPTY_BRAND_PROFILE, raw));
  const parsed = BrandProfileSchema.safeParse(merged);
  return parsed.success ? parsed.data : null;
}

export async function refineBrandAction(
  brandId: string,
  rawProfile: Record<string, unknown>,
  answers: AnsweredQuestion[],
): Promise<RefineResult> {
  const { supabase } = await requireUser();
  const profile = parseProfile(rawProfile);
  if (!profile) return { ok: false, error: "Niektóre pola mają nieprawidłowy format (np. wiek musi być liczbą)." };

  const { data: brand } = await supabase.from("brands").select("id, source").eq("id", brandId).maybeSingle();
  if (!brand) return { ok: false, error: "Nie znaleziono marki." };

  try {
    const apiKey = await getProviderKey(supabase, "anthropic");
    const source = (brand.source as BrandSource & { url?: string })?.url ? (brand.source as BrandSource) : null;
    const result = await refineBrand(apiKey, { profile, answers, source });
    const next = cleanLists(withDefaults(EMPTY_BRAND_PROFILE, result.profile));
    const completeness = clampPct(result.completeness);

    const { error } = await supabase
      .from("brands")
      .update({ profile: next, name: next.name || undefined, questions: result.questions, completeness, summary: result.summary })
      .eq("id", brandId);
    if (error) throw new Error(error.message);

    revalidatePath(`/brands/${brandId}`);
    return { ok: true, profile: next, questions: result.questions, completeness, summary: result.summary };
  } catch (e) {
    return { ok: false, error: userMessage(e) };
  }
}

export async function saveBrandAction(brandId: string, rawProfile: Record<string, unknown>, finish: boolean): Promise<SaveResult> {
  const { supabase } = await requireUser();
  const profile = parseProfile(rawProfile);
  if (!profile) return { ok: false, error: "Niektóre pola mają nieprawidłowy format (np. wiek musi być liczbą)." };
  if (!profile.name.trim()) return { ok: false, error: "Marka musi mieć nazwę." };

  const { error } = await supabase
    .from("brands")
    .update({ profile, name: profile.name, ...(finish ? { status: "ready" } : {}) })
    .eq("id", brandId);
  if (error) return { ok: false, error: `Nie udało się zapisać: ${error.message}` };

  revalidatePath("/brands");
  revalidatePath(`/brands/${brandId}`);
  if (finish) redirect(`/brands/${brandId}`);
  return { ok: true, message: "Zapisano." };
}

export async function setBrandLogo(brandId: string, path: string): Promise<SaveResult> {
  const { supabase, user } = await requireUser();
  if (!path.startsWith(`${brandFolder(user.id, brandId)}/`)) return { ok: false, error: "Nieprawidłowa ścieżka pliku." };
  const { error } = await supabase.from("brands").update({ logo_path: path }).eq("id", brandId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/brands/${brandId}`);
  return { ok: true, message: "Logo zapisane." };
}

export async function deleteBrand(formData: FormData) {
  const { supabase, user } = await requireUser();
  const brandId = String(formData.get("brandId") ?? "");
  // Remove stored files for the brand and its products, then the rows (cascade).
  const { data: products } = await supabase.from("products").select("id").eq("brand_id", brandId);
  const folders = [brandFolder(user.id, brandId), ...(products ?? []).map((p) => `${user.id}/products/${p.id}`)];
  for (const folder of folders) {
    const { data: files } = await supabase.storage.from("media").list(folder);
    if (files?.length) await supabase.storage.from("media").remove(files.map((f) => `${folder}/${f.name}`));
  }
  await supabase.from("brands").delete().eq("id", brandId);
  revalidatePath("/brands");
  redirect("/brands");
}
