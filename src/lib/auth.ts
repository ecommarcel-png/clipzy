import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; email: string | null };

// Data access layer entry point: every server page and action that touches
// user data starts here, so authorization never depends on the client.
export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || !sub) {
    redirect("/login");
  }
  const user: CurrentUser = { id: sub, email: (data.claims.email as string | undefined) ?? null };
  return { supabase, user };
}
