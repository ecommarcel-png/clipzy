import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getBrand } from "@/lib/data";
import { signedUrls } from "@/lib/storage";
import { downloadLinks } from "@/lib/files-store";
import { isHex } from "@/lib/image-ads/colors";
import { loadSet } from "@/lib/image-ads/pipeline";
import { TEMPLATE_INFO, AD_FORMATS } from "@/lib/image-ads/templates";
import { PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { ConfirmButton } from "@/components/confirm-button";
import { deleteImageAdSet } from "../actions";
import { ImageAdsStudio, type StudioAd } from "./studio";

// Each step (Strateg, copy, photos, render, Kontroler) runs as a server action on this page.
export const maxDuration = 300;

export default async function ImageAdSetPage({ params }: PageProps<"/image-ads/[setId]">) {
  const { setId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(setId)) notFound();
  const { supabase } = await requireUser();
  const loaded = await loadSet(supabase, setId);
  if (!loaded) notFound();
  const { set, ads } = loaded;
  const brand = await getBrand(supabase, set.brand_id);
  const paths = ads.flatMap((a) => AD_FORMATS.map((f) => a.renders[f] ?? "")).filter(Boolean);
  const safe = (s: string) => s.replace(/\s+/g, " ").trim();
  const [urls, downloads] = await Promise.all([
    signedUrls(supabase, paths, 6 * 3600),
    downloadLinks(supabase, ads.flatMap((a) => AD_FORMATS.filter((f) => a.renders[f]).map((f) => ({ id: `${a.id}:${f}`, path: a.renders[f]!, name: safe(`${brand.name} ${a.idx + 1} ${a.copy?.headline ?? ""} ${f.replace("x", "-")}`), ext: "png" }))), 6 * 3600),
  ]);
  const colors = brand.profile.colors as unknown as Record<string, string>;
  const fromLogo = Array.isArray(brand.source.logo_colors) ? (brand.source.logo_colors as string[]) : [];
  const palette = [...new Set([colors.accent, ...fromLogo, colors.primary, colors.secondary].filter(isHex).map((c) => c.toLowerCase()))].filter((c) => !["#ffffff", "#000000"].includes(c));

  const studioAds: StudioAd[] = ads.map((a) => ({
    id: a.id, idx: a.idx, stage: a.stage, template: a.template, label: TEMPLATE_INFO[a.template].label, angle: a.concept.angle,
    copy: a.copy, fields: a.fields, style: a.style, error: a.error,
    urls: Object.fromEntries(AD_FORMATS.map((f) => [f, a.renders[f] ? urls[a.renders[f]!] ?? null : null])) as StudioAd["urls"],
    downloads: Object.fromEntries(AD_FORMATS.map((f) => [f, downloads[`${a.id}:${f}`] ?? null])) as StudioAd["downloads"],
    review: a.review?.final ? { score: a.review.final.score, issues: a.review.final.issues, before: a.review.first && a.review.first !== a.review.final ? a.review.first.score : null } : null,
    version: a.renders.v ?? 0,
  }));

  return (
    <>
      <PageHeader title={set.name} description={brand.name} back={<BackLink href="/image-ads">Image ads</BackLink>} />
      <ImageAdsStudio set={{ id: set.id, count: set.count, status: set.status, error: set.error }} ads={studioAds} palette={palette.length ? palette : ["#ff5a36"]} />
      <div className="mt-16 flex justify-end">
        <form action={deleteImageAdSet}>
          <input type="hidden" name="setId" value={set.id} />
          <ConfirmButton subtle message="Usunąć ten zestaw? Gotowe grafiki zostaną w „Twoich plikach”.">Usuń zestaw</ConfirmButton>
        </form>
      </div>
    </>
  );
}
