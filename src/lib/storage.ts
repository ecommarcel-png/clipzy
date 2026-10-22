import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { safeFetch } from "@/lib/scrape/safe-fetch";

export const BUCKET = "media";

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/avif": "avif",
};

export function brandFolder(userId: string, brandId: string) {
  return `${userId}/brands/${brandId}`;
}

export function productFolder(userId: string, productId: string) {
  return `${userId}/products/${productId}`;
}

// Download a public image (SSRF-safe) and store it in the user's folder.
// Returns the storage path, or null when the URL isn't a usable image.
export async function importImage(supabase: SupabaseClient, url: string, folder: string, name: string): Promise<string | null> {
  try {
    const res = await safeFetch(url, { maxBytes: 15_000_000, accept: "image/*" });
    const type = res.contentType.split(";")[0].trim().toLowerCase();
    const ext = EXT[type];
    if (res.status >= 400 || !ext || res.body.length === 0) return null;
    const path = `${folder}/${name}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, res.body, { contentType: type, upsert: true });
    return error ? null : path;
  } catch {
    return null;
  }
}

// Claude reads JPEG, PNG, GIF and WebP only.
export function isClaudeReadableImage(path: string) {
  return /\.(png|jpe?g|gif|webp)$/i.test(path);
}

// Short-lived URLs for showing private files (and for letting Claude see them).
export async function signedUrls(supabase: SupabaseClient, paths: string[], expiresIn = 3600): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return {};
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(unique, expiresIn);
  const out: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
  }
  return out;
}
