"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { encryptSecret, lastFour, decryptSecret } from "@/lib/crypto";
import { checkProviderKey } from "@/lib/provider-check";
import { isProvider } from "@/lib/providers";

export type KeyFormState = { ok?: string; error?: string };

export async function saveApiKey(_prev: KeyFormState, formData: FormData): Promise<KeyFormState> {
  const { supabase, user } = await requireUser();
  const provider = formData.get("provider");
  const key = String(formData.get("key") ?? "").trim();

  if (!isProvider(provider)) return { error: "Nieznany dostawca." };
  if (key.length < 10) return { error: "Wklej pełny klucz API." };

  // Test before saving so the user knows right away if something is wrong.
  const check = await checkProviderKey(provider, key);

  const { error } = await supabase.from("api_keys").upsert(
    {
      user_id: user.id,
      provider,
      ciphertext: encryptSecret(key),
      last4: lastFour(key),
      status: check.status,
      status_note: check.note,
      tested_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" },
  );
  if (error) return { error: `Nie udało się zapisać klucza: ${error.message}` };

  revalidatePath("/settings");
  return check.status === "ok" ? { ok: `Zapisano. ${check.note}` } : { error: `Zapisano, ale: ${check.note}` };
}

export async function retestApiKey(formData: FormData) {
  const { supabase } = await requireUser();
  const provider = formData.get("provider");
  if (!isProvider(provider)) return;

  const { data } = await supabase.from("api_keys").select("ciphertext").eq("provider", provider).maybeSingle();
  if (!data) return;

  const check = await checkProviderKey(provider, decryptSecret(data.ciphertext));
  await supabase
    .from("api_keys")
    .update({ status: check.status, status_note: check.note, tested_at: new Date().toISOString() })
    .eq("provider", provider);
  revalidatePath("/settings");
}

export async function deleteApiKey(formData: FormData) {
  const { supabase } = await requireUser();
  const provider = formData.get("provider");
  if (!isProvider(provider)) return;
  await supabase.from("api_keys").delete().eq("provider", provider);
  revalidatePath("/settings");
}
