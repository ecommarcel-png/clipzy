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
        description="Najpierw marka, potem produkty. Im dokładniejszy profil, tym lepiej dopasowane sklejki, nagrania i grafiki."
        actions={<Link href="/brands/new" className={buttonClass()}>+ Dodaj markę</Link>}
      />

      {!brands?.length ? (
        <Card className="text-center">
          <p className="font-medium">Nie masz jeszcze żadnej marki.</p>
          <p className="mt-1 text-sm text-muted">Wklej link do sklepu — Clipzy przeczyta stronę, przygotuje profil i dopyta o resztę.</p>
          <Link href="/brands/new" className={buttonClass("primary", "mt-4")}>Dodaj pierwszą markę</Link>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map((b) => {
            const productCount = (b.products as unknown as Array<{ count: number }>)?.[0]?.count ?? 0;
            return (
              <Link key={b.id} href={`/brands/${b.id}`} className="group">
                <Card className="h-full transition group-hover:border-accent">
                  <div className="flex items-center gap-3">
                    <Logo url={b.logo_path ? logos[b.logo_path] : undefined} name={b.name} />
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{b.name}</div>
                      {b.website_url ? <div className="truncate text-xs text-muted">{new URL(b.website_url).hostname}</div> : null}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {b.status === "ready" ? <Badge tone="ok">Gotowa</Badge> : <Badge tone="warn">Szkic · {b.completeness}%</Badge>}
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
