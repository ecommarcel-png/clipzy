import { notFound } from "next/navigation";
import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { getBrand, getProduct, getProductImages } from "@/lib/data";
import { loadProject } from "@/lib/clips/pipeline";
import { signedUrls } from "@/lib/storage";
import { PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { ConfirmButton } from "@/components/confirm-button";
import { Studio, type StudioData } from "./studio";
import { deleteClipProject } from "../actions";
import { logoColors } from "@/lib/brand-colors";

// Each pipeline step (analysis, plan + Kontroler) runs as a server action on this page.
export const maxDuration = 300;

export default async function ClipPage({ params }: PageProps<"/clips/[clipId]">) {
  const { clipId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(clipId)) notFound();
  const { supabase, user } = await requireUser();
  const data = await loadProject(supabase, clipId);
  if (!data) notFound();
  const { project, assets } = data;

  // independent reads in parallel — every round trip to the database adds up on each click
  const [brand, product, images] = await Promise.all([
    getBrand(supabase, project.brand_id),
    project.product_id ? getProduct(supabase, project.brand_id, project.product_id).catch(() => null) : Promise.resolve(null),
    project.product_id ? getProductImages(supabase, project.product_id).catch(() => []) : Promise.resolve([]),
  ]);
  const paths = [...assets.map((a) => a.path ?? ""), ...assets.map((a) => (typeof a.meta.poster === "string" ? a.meta.poster : "")), brand.logo_path ?? "", images[0]?.storage_path ?? ""];
  // Long-lived links: the browser renders the video from these.
  const cachedLogo = Array.isArray(brand.source.logo_colors) ? (brand.source.logo_colors as string[]) : null;
  const [urls, fromLogo] = await Promise.all([
    signedUrls(supabase, paths, 6 * 3600),
    cachedLogo ? Promise.resolve(cachedLogo) : logoColors(supabase, brand.logo_path).catch(() => [] as string[]),
  ]);
  // logo colours are computed once and remembered on the brand
  if (!cachedLogo && brand.logo_path && fromLogo.length) {
    after(() => supabase.from("brands").update({ source: { ...brand.source, logo_colors: fromLogo } }).eq("id", brand.id));
  }
  const colors = brand.profile.colors as unknown as Record<string, string>;
  const isHex = (c: unknown): c is string => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c);
  const swatches = [...new Set([...fromLogo, colors.accent, colors.primary, colors.secondary].filter(isHex).map((c) => c.toLowerCase()))]
    .filter((c) => !["#ffffff", "#000000"].includes(c))
    .slice(0, 6);

  const studio: StudioData = {
    userId: user.id,
    project: {
      id: project.id,
      name: project.name,
      status: project.status,
      settings: project.settings,
      voiceover: project.voiceover
        ? {
            segments: project.voiceover.timeline.segments, captions: project.voiceover.captions, original: project.voiceover.timeline.original,
            duration: project.voiceover.timeline.duration, feedback: project.voiceover.feedback, assetId: project.voiceover.asset_id,
            variants: project.voiceover.variants?.map((v) => ({ assetId: v.asset_id, segments: v.timeline.segments, captions: v.captions, duration: v.timeline.duration, hookEnd: v.hookEnd, hookText: v.hookText })),
          }
        : null,
      plan: project.plan,
      error: project.error,
      feedback: project.feedback ?? [],
      missingNotes: (project.review as { missing_notes?: string } | null)?.missing_notes ?? null,
    },
    assets: assets.map((a) => ({
      id: a.id, kind: a.kind, name: a.name, status: a.status, error: a.error, url: a.path ? urls[a.path] ?? null : null,
      mirrored: Boolean(a.meta.mirrored), format: (a.meta.format as string) ?? null, duration: Number(a.meta.duration ?? 0) || null,
      cuts: Array.isArray(a.meta.cuts) ? (a.meta.cuts as number[]) : [],
      poster: typeof a.meta.poster === "string" ? urls[a.meta.poster] ?? null : null,
      fromLibrary: Boolean(a.meta.from_library),
      variant: Number(a.meta.variant) || null,
      review: a.kind === "render" ? (a.analysis as StudioData["assets"][number]["review"]) : null,
      created_at: a.created_at,
    })),
    brand: { name: brand.name, logoUrl: brand.logo_path ? urls[brand.logo_path] ?? null : null, accent: colors.accent || colors.primary || "#7E9A86", swatches, logoColors: fromLogo },
    product: { name: product?.name ?? null },
    packshotUrl: images[0] ? urls[images[0].storage_path] ?? null : null,
  };

  return (
    <>
      <PageHeader
        title={project.name}
        description={[brand.name, product?.name].filter(Boolean).join(" — ")}
        back={<BackLink href="/clips">Sklejki</BackLink>}
      />
      <Studio data={studio} />
      <div className="mt-16 flex justify-end">
        <form action={deleteClipProject}>
          <input type="hidden" name="projectId" value={project.id} />
          <ConfirmButton subtle message="Usunąć tę sklejkę razem z nagraniami i renderami?">Usuń sklejkę</ConfirmButton>
        </form>
      </div>
    </>
  );
}
