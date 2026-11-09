import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { signedUrls } from "@/lib/storage";
import { downloadLinks } from "@/lib/files-store";
import type { AdFile } from "@/lib/files";
import { Card, PageHeader, buttonClass } from "@/components/ui";
import { FilesGrid } from "./files-grid";

const LIMIT = 200;

type Row = {
  id: string; path: string; name: string; format: string | null; variant: number | null; brand_id: string | null; project_id: string | null;
  kind: string; tool: string; image_set_id?: string | null;
  meta: { brand_name?: string; product_name?: string | null; copy?: AdFile["copy"] } | null; review: { score?: number } | null; created_at: string;
  brands: { name: string } | null; products: { name: string } | null; clip_projects: { id: string } | null; image_ad_sets?: { id: string } | null;
};

export default async function FilesPage() {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("ad_files")
    .select("id, path, name, format, variant, brand_id, project_id, kind, tool, image_set_id, meta, review, created_at, brands(name), products(name), clip_projects(id), image_ad_sets(id)")
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  // before migration 0006 there is no image ads link — read the archive without it
  const fallback = error && /image_set_id|image_ad_sets/.test(error.message)
    ? await supabase.from("ad_files").select("id, path, name, format, variant, brand_id, project_id, kind, tool, meta, review, created_at, brands(name), products(name), clip_projects(id)").order("created_at", { ascending: false }).limit(LIMIT)
    : null;
  const rows = ((fallback ? fallback.data : data) ?? []) as unknown as Row[];
  const failed = fallback ? fallback.error : error;

  const [previews, downloads] = await Promise.all([
    signedUrls(supabase, rows.map((r) => r.path), 6 * 3600),
    downloadLinks(supabase, rows.map((r) => ({ id: r.id, path: r.path, name: r.name, ext: r.kind === "image" ? "png" : "mp4" })), 6 * 3600),
  ]);

  const files: AdFile[] = rows.map((r) => ({
    id: r.id,
    name: r.name || "Reklama",
    path: r.path,
    format: r.format,
    variant: r.variant,
    brandId: r.brand_id,
    // brand/product deleted: the names remembered when the file was made
    brandName: r.brands?.name ?? r.meta?.brand_name ?? null,
    productName: r.products?.name ?? r.meta?.product_name ?? null,
    projectId: r.clip_projects?.id ?? null,
    kind: r.kind === "image" ? "image" : "video",
    source: r.clip_projects?.id
      ? { href: `/clips/${r.clip_projects.id}`, label: "Otwórz sklejkę" }
      : r.image_ad_sets?.id
        ? { href: `/image-ads/${r.image_ad_sets.id}`, label: "Otwórz zestaw" }
        : r.tool === "text-remover"
          ? { href: "/text-remover", label: "Usuwanie napisów" }
          : null,
    copy: r.meta?.copy ?? null,
    createdAt: r.created_at,
    review: typeof r.review?.score === "number" ? { score: r.review.score } : null,
    url: previews[r.path] ?? null,
    downloadUrl: downloads[r.id] ?? null,
  }));

  return (
    <>
      <PageHeader title="Twoje pliki" description="Wszystkie gotowe reklamy w jednym miejscu: sklejki i image ads. Zostają tu nawet po usunięciu projektu." />
      {failed ? (
        <Card className="text-sm text-muted">Uruchom w Supabase migrację <code>0005_files.sql</code> (instrukcja w README), żeby włączyć „Twoje pliki”.</Card>
      ) : !files.length ? (
        <Card className="py-12 text-center">
          <p className="text-lg font-extrabold">Tu pojawią się Twoje reklamy</p>
          <p className="mt-1 text-sm text-muted">Każdy wyrenderowany film ze sklejki i każda grafika z image ads trafia tu automatycznie.</p>
          <Link href="/clips" className={buttonClass("primary", "mt-5")}>Przejdź do sklejek</Link>
        </Card>
      ) : (
        <>
          <FilesGrid files={files} />
          {files.length === LIMIT ? <p className="mt-6 text-center text-xs text-faint">Pokazuję {LIMIT} najnowszych plików.</p> : null}
        </>
      )}
    </>
  );
}
