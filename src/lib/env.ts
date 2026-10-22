// Environment access in one place, with readable errors when something is missing.

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Brak zmiennej środowiskowej ${name}. Ustaw ją w Vercelu (Settings → Environment Variables) albo w pliku .env.local.`,
    );
  }
  return value;
}

export function supabaseUrl(): string {
  return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
}

// Supabase calls this the "publishable" key (older projects: "anon" key). Either works.
export function supabasePublishableKey(): string {
  return required(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

// 32 random bytes, base64. Generate with: openssl rand -base64 32
export function encryptionKey(): string {
  return required("APP_ENCRYPTION_KEY", process.env.APP_ENCRYPTION_KEY);
}
