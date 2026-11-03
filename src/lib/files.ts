// "Twoje pliki": finished ads from every tool. Pure helpers, shared by server and browser.

export type AdFile = {
  id: string;
  name: string;
  path: string;
  format: string | null;
  variant: number | null;
  brandId: string | null;
  brandName: string | null;
  productName: string | null;
  projectId: string | null;
  createdAt: string;
  review: { score: number } | null;
  kind: "video" | "image";
  /** where the file came from: the sklejka or the image ads set */
  source: { href: string; label: string } | null;
  copy: { primary_text: string; headline: string; description: string } | null;
  /** signed link for the preview */
  url: string | null;
  /** signed link that downloads under the file's name */
  downloadUrl: string | null;
};

export const NAME_MAX = 80;

const ascii = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/ł/g, "l").replace(/Ł/g, "L");

export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, NAME_MAX).trim();
}

export function formatRatio(format: string): string {
  return format.replace("x", ":");
}

export function defaultFileName(p: { brand: string; product?: string | null; format: string; variant?: number | null }): string {
  const who = cleanName(p.product || "") || cleanName(p.brand) || "Reklama";
  return cleanName([who, formatRatio(p.format), p.variant ? `hook ${p.variant}` : null].filter(Boolean).join(" · "));
}

export function downloadName(name: string, ext = "mp4"): string {
  const base = ascii(name).replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, NAME_MAX).replace(/-+$/, "");
  return `${base || "reklama"}.${ext}`;
}

export function filterFiles(files: AdFile[], f: { brandId?: string; format?: string; q?: string }): AdFile[] {
  const q = ascii((f.q ?? "").trim().toLowerCase());
  return files.filter(
    (x) =>
      (!f.brandId || x.brandId === f.brandId) &&
      (!f.format || x.format === f.format) &&
      (!q || ascii(x.name.toLowerCase()).includes(q)),
  );
}
