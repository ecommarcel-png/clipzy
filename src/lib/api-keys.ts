import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptSecret } from "@/lib/crypto";
import { PROVIDER_INFO, type Provider } from "@/lib/providers";

export class MissingKeyError extends Error {
  constructor(public provider: Provider) {
    super(
      `Brak klucza API: ${PROVIDER_INFO[provider].name}. Dodaj go w Ustawieniach, żeby korzystać z tej funkcji.`,
    );
  }
}

// Returns the user's decrypted key for a provider. Server-side only.
export async function getProviderKey(supabase: SupabaseClient, provider: Provider): Promise<string> {
  const { data, error } = await supabase.from("api_keys").select("ciphertext").eq("provider", provider).maybeSingle();
  if (error) throw new Error(`Nie udało się odczytać klucza: ${error.message}`);
  if (!data) throw new MissingKeyError(provider);
  return decryptSecret(data.ciphertext);
}
