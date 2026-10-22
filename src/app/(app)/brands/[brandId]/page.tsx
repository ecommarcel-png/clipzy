import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getBrand } from "@/lib/data";
import { CAPTION_PROFILES } from "@/lib/profiles/brand";
import { signedUrls } from "@/lib/storage";
import { Logo } from "@/components/logo";
import { Badge, Card, buttonClass } from "@/components/ui";
import { deleteBrand } from "../actions";
import { ConfirmButton } from "@/components/confirm-button";

export default async function BrandPage({ params }: PageProps<"/brands/[brandId]">) {
  const { brandId } = await params;
  const { supabase } = await requireUser();
  const brand = await getBrand(supabase, brandId);
  const p = brand.profile;

  const { data: products } = await supabase
    .from("products")
    .select("id, name, status, completeness, product_images(storage_path, sort_order)")
    .eq("brand_id", brand.id)
    .order("created_at", { ascending: false });

  const thumbs = (products ?? []).map((pr) => {
    const imgs = (pr.product_images as Array<{ storage_path: string; sort_order: number }>) ?? [];
    return imgs.sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path ?? "";
  });
  const urls = await signedUrls(supabase, [brand.logo_path ?? "", ...thumbs]);
  const caption = CAPTION_PROFILES.find((c) => c.value === p.caption_profile);

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <Logo url={brand.logo_path ? urls[brand.logo_path] : undefined} name={brand.name} size={56} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{brand.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            {brand.status === "ready" ? <Badge tone="ok">Profil zatwierdzony</Badge> : <Badge tone="warn">Szkic · {brand.completeness}%</Badge>}
            {brand.website_url ? (
              <a href={brand.website_url} target="_blank" rel="noreferrer" className="hover:text-text">{new URL(brand.website_url).hostname} ↗</a>
            ) : null}
          </div>
        </div>
        <Link href={`/brands/${brand.id}/setup`} className={buttonClass("secondary")}>Edytuj profil</Link>
      </div>

      {brand.status !== "ready" ? (
        <Card className="mb-6 border-warn/40 bg-warn-soft">
          <p className="text-sm">
            Profil marki nie jest jeszcze zatwierdzony. Dokończ go, zanim zaczniesz tworzyć reklamy — od niego zależy styl napisów, ton i muzyka.{" "}
            <Link href={`/brands/${brand.id}/setup`} className="font-medium text-accent hover:underline">Dokończ profil →</Link>
          </p>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <h2 className="font-semibold">W skrócie</h2>
          <p className="mt-2 text-sm">{p.tagline || "—"}</p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <Item label="Grupa docelowa">
              {p.target_audience.gender}, {p.target_audience.age_from}–{p.target_audience.age_to} lat
            </Item>
            <Item label="Nisza">{p.niche || "—"}</Item>
            <Item label="Napisy w sklejkach">{caption?.label.split(" — ")[0] ?? p.caption_profile}</Item>
            <Item label="Ton">{p.tone_of_voice.description || "—"}</Item>
          </dl>
        </Card>
        <Card>
          <h2 className="font-semibold">Kolory</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(["primary", "secondary", "accent", "caption_text"] as const).map((k) => (
              <div key={k} className="flex items-center gap-2 text-xs">
                <span className="h-6 w-6 rounded border border-border" style={{ background: p.colors[k] }} />
                <span className="font-mono text-muted">{p.colors[k]}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mb-4 mt-10 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Produkty</h2>
          <p className="text-sm text-muted">Każdy produkt ma własny profil i zdjęcia — na nich pracują sklejki, AI nagrania i image ads.</p>
        </div>
        <Link href={`/brands/${brand.id}/products/new`} className={buttonClass()}>+ Dodaj produkt</Link>
      </div>

      {!products?.length ? (
        <Card className="text-center text-sm text-muted">Brak produktów. Dodaj pierwszy — wystarczy link do strony produktu.</Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((pr, i) => (
            <Link key={pr.id} href={`/brands/${brand.id}/products/${pr.id}`} className="group">
              <Card className="h-full p-0 transition group-hover:border-accent">
                <div className="aspect-square overflow-hidden rounded-t-2xl bg-surface-2">
                  {thumbs[i] && urls[thumbs[i]] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={urls[thumbs[i]]} alt={pr.name} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="p-4">
                  <div className="truncate font-medium">{pr.name}</div>
                  <div className="mt-2">
                    {pr.status === "ready" ? <Badge tone="ok">Gotowy</Badge> : <Badge tone="warn">Szkic · {pr.completeness}%</Badge>}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-16 border-t border-border pt-6">
        <form action={deleteBrand}>
          <input type="hidden" name="brandId" value={brand.id} />
          <ConfirmButton message={`Usunąć markę „${brand.name}” razem z produktami i zdjęciami? Tego nie da się cofnąć.`}>
            Usuń markę
          </ConfirmButton>
        </form>
      </div>
    </>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
