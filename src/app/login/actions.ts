"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; info?: string; mode: "login" | "signup" };

const credentials = z.object({
  email: z.email("Podaj poprawny adres e-mail."),
  password: z.string().min(8, "Hasło musi mieć co najmniej 8 znaków."),
});

export async function authenticate(prev: AuthState, formData: FormData): Promise<AuthState> {
  const mode = formData.get("mode") === "signup" ? "signup" : "login";
  const parsed = credentials.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) {
    return { mode, error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane." };
  }

  const supabase = await createClient();

  if (mode === "signup") {
    const h = await headers();
    const origin = h.get("origin") ?? `https://${h.get("host")}`;
    const { data, error } = await supabase.auth.signUp({
      ...parsed.data,
      options: { emailRedirectTo: `${origin}/auth/confirm` },
    });
    if (error) return { mode, error: translateAuthError(error.message) };
    if (!data.session) {
      return { mode: "login", info: "Konto założone. Sprawdź skrzynkę e-mail i kliknij link potwierdzający, a potem zaloguj się." };
    }
    redirect("/brands");
  }

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { mode, error: translateAuthError(error.message) };
  redirect("/brands");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Nieprawidłowy e-mail lub hasło.";
  if (m.includes("email not confirmed")) return "Potwierdź najpierw adres e-mail (link w skrzynce).";
  if (m.includes("already registered")) return "Konto z tym adresem już istnieje — zaloguj się.";
  if (m.includes("rate limit")) return "Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie.";
  return message;
}
