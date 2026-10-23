import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { signedUrls } from "@/lib/storage";
import { Badge, Card, PageHeader, buttonClass } from "@/components/ui";
import { Logo } from "@/components/logo";
import { plural } from "@/lib/plural";

export default async function BrandsPage() {
  const { supabase } = await requireUser();
  const { data: brands } = await supabase
    .from("brands")
    .select("id, name, website_url, status, completeness, logo_path, products(count)")
    .order("created_at", { ascending: false });

  const logos = await signedUrls(supabase, (brands ?? []).map((b) => b.logo_path ?? ""));

  return (
    <>
      <PageHeader
        title="Marki i produkty"
        description="Najpierw marka, potem jej produkty."
        actions={<Link href="/brands/new" className={buttonClass()}>+ Dodaj markę</Link>}
      />

      {!brands?.length ? (
        <Card className="py-12 text-center">
          <p className="text-lg font-extrabold">Dodaj pierwszą markę</p>
          <p className="mt-1 text-sm text-muted">Wystarczy link do sklepu.</p>
          <Link href="/brands/new" className={buttonClass("primary", "mt-5")}>+ Dodaj markę</Link>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map((b) => {
            const productCount = (b.products as unknown as Array<{ count: number }>)?.[0]?.count ?? 0;
            return (
              <Link key={b.id} href={`/brands/${b.id}`} className="group rounded-[22px] focus-visible:outline-2 focus-visible:outline-accent">
                <Card className="h-full transition group-hover:border-border-strong">
                  <div className="flex items-center gap-3">
                    <Logo url={b.logo_path ? logos[b.logo_path] : undefined} name={b.name} />
                    <div className="min-w-0">
                      <div className="truncate text-lg font-extrabold">{b.name}</div>
                      {b.website_url ? <div className="truncate text-xs text-muted">{new URL(b.website_url).hostname}</div> : null}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {b.status === "ready" ? <Badge tone="ok" dot>Gotowa</Badge> : <Badge tone="warn" dot>Do zatwierdzenia</Badge>}
                    <Badge>{productCount} {plural(productCount, "produkt", "produkty", "produktów")}</Badge>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
