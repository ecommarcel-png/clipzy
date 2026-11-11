import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { signedUrls } from "@/lib/storage";
import { loadItems, type CopyItem } from "@/lib/ad-copy/pipeline";
import { Card, PageHeader, buttonClass } from "@/components/ui";
import { AdCopyTool, type ItemView, type PickableFile } from "./ad-copy";

// Gemini watches each creative and Claude writes its copy — server actions on this page.
export const maxDuration = 300;

export default async function AdCopyPage() {
  const { supabase, user } = await requireUser();
  let items: CopyItem[] = [];
  let missing = false;
  try {
    items = await loadItems(supabase);
  } catch {
    missing = true;
  }
  const [{ data: brands }, { data: files }] = await Promise.all([
    supabase.from("brands").select("id, name, products(id, name)").order("created_at", { ascending: false }),
    supabase.from("ad_files").select("id, name, path, kind, format, brand_id, created_at, brands(name)").order("created_at", { ascending: false }).limit(60),
  ]);
  const urls = await signedUrls(supabase, [...items.map((i) => i.path), ...(files ?? []).map((f) => f.path as string)], 6 * 3600);
  const names = new Map((brands ?? []).flatMap((b) => [[b.id, b.name] as const, ...((b.products as unknown as Array<{ id: string; name: string }>) ?? []).map((p) => [p.id, p.name] as const)]));

  const views: ItemView[] = items.map((i) => ({
    id: i.id, name: i.name, kind: i.kind, stage: i.stage, error: i.error, url: urls[i.path] ?? null,
    brand: i.brand_id ? names.get(i.brand_id) ?? null : null, product: i.product_id ? names.get(i.product_id) ?? null : null,
    fromFiles: Boolean(i.file_id), rewriting: i.stage === "write" && Boolean(i.copy),
    copy: i.copy ? { primary: i.copy.primary, headline: i.copy.headline, description: i.copy.description, angle: i.copy.angle, why: i.copy.why } : null,
  }));
  const pickable: PickableFile[] = (files ?? []).map((f) => ({
    id: f.id as string, name: f.name as string, kind: f.kind === "image" ? "image" : "video", format: (f.format as string | null) ?? null,
    brand: (f.brands as unknown as { name: string } | null)?.name ?? null, brandId: (f.brand_id as string | null) ?? null, url: urls[f.path as string] ?? null,
  }));

  return (
    <>
      <PageHeader
        title="Ad copy"
        description="Wrzuć gotowe kreacje — do każdej dostaniesz tekst główny, nagłówek i opis, które ją dopełniają: problem, rozwiązanie i produkt prosto, językiem Twojej grupy docelowej."
      />
      {missing ? (
        <Card className="text-sm text-muted">Uruchom w Supabase migrację <code>0008_ad_copy.sql</code> (instrukcja w README), żeby włączyć ad copy.</Card>
      ) : !brands?.length ? (
        <Card className="max-w-2xl text-sm">
          Najpierw dodaj markę i produkt — copy powstaje z ich profilu. <Link href="/brands/new" className={buttonClass("secondary", "ml-2")}>Dodaj markę</Link>
        </Card>
      ) : (
        <AdCopyTool
          userId={user.id}
          brands={brands.map((b) => ({ id: b.id, name: b.name, products: ((b.products as unknown as Array<{ id: string; name: string }>) ?? []).map((p) => ({ id: p.id, name: p.name })) }))}
          items={views}
          files={pickable}
        />
      )}
    </>
  );
}
