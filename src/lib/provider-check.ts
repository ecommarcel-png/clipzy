import "server-only";
import type { Provider } from "@/lib/providers";

export type KeyCheck = { status: "ok" | "invalid" | "error"; note: string };

// Cheap, read-only calls that prove a key works without generating anything.
const CHECKS: Record<Provider, (key: string) => Promise<Response>> = {
  anthropic: (key) =>
    fetch("https://api.anthropic.com/v1/models?limit=1", {
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
    }),
  gemini: (key) =>
    fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", {
      headers: { "x-goog-api-key": key },
    }),
  fal: (key) =>
    fetch("https://api.fal.ai/v1/account/billing", {
      headers: { Authorization: `Key ${key}` },
    }),
  elevenlabs: (key) =>
    fetch("https://api.elevenlabs.io/v1/models", {
      headers: { "xi-api-key": key },
    }),
};

export async function checkProviderKey(provider: Provider, key: string): Promise<KeyCheck> {
  try {
    const res = await CHECKS[provider](key);
    if (res.ok) return { status: "ok", note: "Klucz działa." };
    if (res.status === 401) return { status: "invalid", note: "Klucz odrzucony (401). Sprawdź, czy skopiowałeś go w całości." };
    if (res.status === 403) {
      // fal/ElevenLabs keys can be scoped: authenticated but not allowed to read this endpoint.
      return provider === "fal" || provider === "elevenlabs"
        ? { status: "ok", note: "Klucz rozpoznany, ale ma ograniczone uprawnienia — upewnij się, że pozwala na generowanie." }
        : { status: "invalid", note: "Brak uprawnień (403)." };
    }
    if (res.status === 429) return { status: "ok", note: "Klucz działa, ale limit zapytań jest chwilowo wyczerpany (429)." };
    return { status: "error", note: `Nieoczekiwana odpowiedź serwera (${res.status}). Spróbuj ponownie później.` };
  } catch {
    return { status: "error", note: "Nie udało się połączyć z dostawcą. Spróbuj ponownie później." };
  }
}
