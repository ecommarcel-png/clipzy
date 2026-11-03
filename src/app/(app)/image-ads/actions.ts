"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { userMessage } from "@/lib/errors";
import { MissingKeyError, getProviderKey } from "@/lib/api-keys";
import { FalError } from "@/lib/ai/fal";
import { BUCKET } from "@/lib/storage";
import { pathsInUse } from "@/lib/clips/library-store";
import { advance, failStep, loadSet, resetAd, saveEdits } from "@/lib/image-ads/pipeline";

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

export async function createImageAdSet(_: unknown, form: FormData): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  const brandId = String(form.get("brandId") ?? "");
  const productId = String(form.get("productId") ?? "");
  if (!isUuid(brandId)) return { error: "Wybierz markę." };
  for (const p of ["anthropic", "fal"] as const) {
    try {
      await getProviderKey(supabase, p);
    } catch (e) {
      return { error: userMessage(e) };
    }
  }
  const count = Math.min(20, Math.max(1, Math.round(Number(form.get("count") ?? 10)) || 10));
  const [{ data: brand }, { data: product }] = await Promise.all([
    supabase.from("brands").select("name").eq("id", brandId).maybeSingle(),
    isUuid(productId) ? supabase.from("products").select("name").eq("id", productId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!brand) return { error: "Nie znaleziono marki." };
  const date = new Date().toLocaleDateString("pl-PL", { day: "numeric", month: "short", timeZone: "Europe/Warsaw" });
  const id = randomUUID();
  const { error } = await supabase.from("image_ad_sets").insert({
    id, user_id: user.id, brand_id: brandId, product_id: product ? productId : null, count,
    name: `${(product?.name as string | undefined) ?? brand.name} — ${count} ${count === 1 ? "kreacja" : count < 5 ? "kreacje" : "kreacji"}, ${date}`,
  });
  if (error) return { error: /image_ad_sets/.test(error.message) ? "Uruchom w Supabase migrację 0006_image_ads.sql (instrukcja w README)." : error.message };
  redirect(`/image-ads/${id}`);
}

export type AdvanceResponse = { ok: true; done: boolean; step: string } | { ok: false; error: string; stop: boolean };

/** One step of the set. `final`: this is the retry — on failure the creatives of this step get the error and the set moves on. */
export async function advanceImageSetAction(setId: string, final = false): Promise<AdvanceResponse> {
  const { supabase } = await requireUser();
  if (!isUuid(setId)) return { ok: false, error: "Nie znaleziono zestawu.", stop: true };
  try {
    const r = await advance(supabase, setId);
    return { ok: true, done: r.done, step: r.step };
  } catch (e) {
    const message = userMessage(e);
    // missing key / empty fal balance: nothing to retry until the user fixes it
    const stop = e instanceof MissingKeyError || (e instanceof FalError && /środków|odrzucony/.test(e.message));
    if (!stop && final) await failStep(supabase, setId, message);
    return { ok: false, error: message, stop };
  }
}

export async function retryImageSetAction(setId: string): Promise<{ ok: boolean }> {
  const { supabase } = await requireUser();
  if (!isUuid(setId)) return { ok: false };
  await supabase.from("image_ad_sets").update({ status: "running", error: null }).eq("id", setId);
  return { ok: true };
}

export async function regenerateImageAdAction(setId: string, adId: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await requireUser();
  const loaded = isUuid(setId) ? await loadSet(supabase, setId) : null;
  const ad = loaded?.ads.find((a) => a.id === adId);
  if (!ad) return { ok: false, error: "Nie znaleziono kreacji." };
  await resetAd(supabase, ad);
  return { ok: true };
}

export async function saveImageAdEditsAction(setId: string, adId: string, edits: { fields: unknown; style: unknown; copy: unknown }): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await requireUser();
  try {
    await saveEdits(supabase, setId, adId, edits);
    revalidatePath("/files");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error && !(e instanceof TypeError) ? e.message : userMessage(e) };
  }
}

export async function renameImageAdSet(setId: string, name: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await requireUser();
  const clean = name.replace(/\s+/g, " ").trim().slice(0, 80);
  if (!isUuid(setId) || !clean) return { ok: false, error: "Podaj nazwę." };
  const { error } = await supabase.from("image_ad_sets").update({ name: clean }).eq("id", setId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/image-ads");
  return { ok: true };
}

export async function deleteImageAdSet(form: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(form.get("setId") ?? "");
  if (!isUuid(id)) return;
  const dir = `${user.id}/image-ads/${id}`;
  const { data: files } = await supabase.storage.from(BUCKET).list(dir, { limit: 1000 });
  const all = (files ?? []).map((f) => `${dir}/${f.name}`);
  // finished graphics stay in "Twoje pliki"
  const keep = await pathsInUse(supabase, all);
  const gone = all.filter((p) => !keep.has(p));
  if (gone.length) await supabase.storage.from(BUCKET).remove(gone);
  await supabase.from("image_ad_sets").delete().eq("id", id);
  redirect("/image-ads");
}
