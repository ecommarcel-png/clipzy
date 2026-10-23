import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BUCKET } from "@/lib/storage";
import { logoPalette } from "@/lib/media/palette";

// Colours of the logo itself — the brand identity (shop CSS is full of sale reds and UI greys).
export async function logoColors(supabase: SupabaseClient, logoPath: string | null): Promise<string[]> {
  if (!logoPath) return [];
  const { data } = await supabase.storage.from(BUCKET).download(logoPath);
  if (!data) return [];
  return logoPalette(Buffer.from(await data.arrayBuffer()));
}

// After a logo is saved: remember its colours and make the main one the ad accent.
export async function applyLogoColors(supabase: SupabaseClient, brandId: string, logoPath: string, setAccent = true) {
  const palette = await logoColors(supabase, logoPath);
  if (!palette.length) return;
  const { data: brand } = await supabase.from("brands").select("profile, source").eq("id", brandId).maybeSingle();
  if (!brand) return;
  const profile = (brand.profile ?? {}) as { colors?: Record<string, string> };
  const source = (brand.source ?? {}) as Record<string, unknown>;
  await supabase
    .from("brands")
    .update({
      ...(setAccent ? { profile: { ...profile, colors: { ...(profile.colors ?? {}), accent: palette[0] } } } : {}),
      source: { ...source, logo_colors: palette },
    })
    .eq("id", brandId);
}
