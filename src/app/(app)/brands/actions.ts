"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getProviderKey } from "@/lib/api-keys";
import { analyzeBrand, brandEvidence, refineBrand, type BrandDraft } from "@/lib/ai/brand";
import { reviewProfile } from "@/lib/ai/review";
import { controlLoop } from "@/lib/ai/control";
import { scrapeBrandSite, type BrandSource } from "@/lib/scrape/site";
import { normalizeUrl } from "@/lib/scrape/safe-fetch";
import { BrandProfileSchema, EMPTY_BRAND_PROFILE } from "@/lib/profiles/brand";
import { cleanLists, withDefaults, type AnsweredQuestion } from "@/lib/profiles/common";
import { brandCompleteness } from "@/lib/profiles/completeness";
import { brandFolder, importImage } from "@/lib/storage";
import { writeWithReview } from "@/lib/data";
import { userMessage } from "@/lib/errors";
import type { RefineResult, SaveResult } from "@/components/profile-editor";

export type NewBrandState = { error?: string };

// Leave room for the final re-check inside the 300 s page limit.
const CONTROL_BUDGET_MS = 170_000;

// Questions are optional and capped: the profile must be usable without them.
const MAX_QUESTIONS = 3;

function normalizeDraft(d: BrandDraft): BrandDraft {
  return { ...d, profile: cleanLists(withDefaults(EMPTY_BRAND_PROFILE, d.profile)), questions: d.questions.slice(0, MAX_QUESTIONS) };
}

// Draft → independent Controller → correction → final check.
async function controlBrand(
  apiKey: string,
  draft: BrandDraft,
  ctx: { source: BrandSource | null; notes: string; answers: AnsweredQuestion[]; startedAt: number },
) {
  return controlLoop({
    draft: normalizeDraft(draft),
    review: (d) => reviewProfile(apiKey, { kind: "marka", profile: d.profile, evidence: brandEvidence(ctx.source, ctx.notes, ctx.answers) }),
    revise: async (d, issues) =>
      normalizeDraft(
        await refineBrand(apiKey, {
          profile: d.profile,
          answers: ctx.answers,
          source: ctx.source,
          notes: ctx.notes,
          controlIssues: issues,
          openQuestions: d.questions,
        }),
      ),
    hasTimeFor: () => Date.now() - ctx.startedAt < CONTROL_BUDGET_MS,
  });
}

export async function createBrand(_prev: NewBrandState, formData: FormData): Promise<NewBrandState> {
  const startedAt = Date.now();
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
    if (nameHint) analysis.profile.name = nameHint;

    const { result, report } = await controlBrand(apiKey, analysis, { source, notes, answers: [], startedAt });
    const profile = result.profile;
    if (nameHint) profile.name = nameHint;

    // Insert, then read back the id (the review column may not exist yet).
    let insertedId: string | null = null;
    const { error } = await writeWithReview(
      async (payload) => {
        const res = await supabase.from("brands").insert(payload).select("id").single();
        insertedId = res.data?.id ?? null;
        return { error: res.error };
      },
      {
        user_id: user.id,
        name: profile.name || nameHint || new URL(source?.url ?? normalizeUrl(rawUrl)).hostname,
        website_url: source?.url ?? null,
        profile,
        questions: result.questions,
        completeness: brandCompleteness(profile).score,
        summary: result.summary,
        review: report,
        source: { ...(source ?? {}), notes },
      },
    );
    if (error || !insertedId) throw new Error(error?.message ?? "Nie udało się zapisać marki.");
    brandId = insertedId;

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
  const startedAt = Date.now();
  const { supabase } = await requireUser();
  const profile = parseProfile(rawProfile);
  if (!profile) return { ok: false, error: "Niektóre pola mają nieprawidłowy format (np. wiek musi być liczbą)." };

  const { data: brand } = await supabase.from("brands").select("id, source").eq("id", brandId).maybeSingle();
  if (!brand) return { ok: false, error: "Nie znaleziono marki." };

  try {
    const apiKey = await getProviderKey(supabase, "anthropic");
    const stored = (brand.source ?? {}) as BrandSource & { url?: string; notes?: string };
    const source = stored.url ? (stored as BrandSource) : null;
    const notes = stored.notes ?? "";

    const focus = brandCompleteness(profile).missing;
    const draft = await refineBrand(apiKey, { profile, answers, source, notes, focus });
    const { result, report } = await controlBrand(apiKey, draft, { source, notes, answers, startedAt });

    const { error } = await writeWithReview(
      (payload) => supabase.from("brands").update(payload).eq("id", brandId),
      {
        profile: result.profile,
        name: result.profile.name || undefined,
        questions: result.questions,
        completeness: brandCompleteness(result.profile).score,
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

export async function saveBrandAction(brandId: string, rawProfile: Record<string, unknown>, finish: boolean): Promise<SaveResult> {
  const { supabase } = await requireUser();
  const profile = parseProfile(rawProfile);
  if (!profile) return { ok: false, error: "Niektóre pola mają nieprawidłowy format (np. wiek musi być liczbą)." };
  if (!profile.name.trim()) return { ok: false, error: "Marka musi mieć nazwę." };

  const { error } = await supabase
    .from("brands")
    .update({ profile, name: profile.name, completeness: brandCompleteness(profile).score, ...(finish ? { status: "ready" } : {}) })
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
