// The AI providers Clipzy uses. Each user brings their own key for each.

export const PROVIDERS = ["anthropic", "gemini", "fal", "elevenlabs"] as const;
export type Provider = (typeof PROVIDERS)[number];

export type ProviderInfo = {
  id: Provider;
  name: string;
  role: string;
  keyUrl: string;
  placeholder: string;
  requiredFor: string;
};

export const PROVIDER_INFO: Record<Provider, ProviderInfo> = {
  anthropic: {
    id: "anthropic",
    name: "Anthropic (Claude)",
    role: "Mózg narzędzia: analiza marki i produktu, skrypty, plan montażu, kontrola jakości.",
    keyUrl: "https://console.anthropic.com/settings/keys",
    placeholder: "sk-ant-…",
    requiredFor: "Wymagany do dodania marki i produktu.",
  },
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    role: "Ogląda i słucha nagrań wideo (wybór klipów na hook, analiza materiałów).",
    keyUrl: "https://aistudio.google.com/apikey",
    placeholder: "AIza… / AQ.…",
    requiredFor: "Potrzebny do sklejek i usuwania napisów.",
  },
  fal: {
    id: "fal",
    name: "fal.ai",
    role: "Modele generujące wideo i obrazy (AI nagrania, brakujące ujęcia, image ads).",
    keyUrl: "https://fal.ai/dashboard/keys",
    placeholder: "xxxxxxxx-xxxx-…:…",
    requiredFor: "Potrzebny do AI nagrań i image ads.",
  },
  elevenlabs: {
    id: "elevenlabs",
    name: "ElevenLabs",
    role: "Dokładna transkrypcja lektora po polsku (czas każdego słowa) i lektor AI.",
    keyUrl: "https://elevenlabs.io/app/settings/api-keys",
    placeholder: "sk_…",
    requiredFor: "Potrzebny do sklejek z lektorem.",
  },
};

export function isProvider(value: unknown): value is Provider {
  return typeof value === "string" && (PROVIDERS as readonly string[]).includes(value);
}
