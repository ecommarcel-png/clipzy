import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getBrand } from "@/lib/data";
import { CAPTION_PROFILES } from "@/lib/profiles/brand";
import { signedUrls } from "@/lib/storage";
import { Logo } from "@/components/logo";
import { BackLink } from "@/components/back-link";
import { Badge, Card, Disclosure, buttonClass } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { ProductTile, AddTile } from "./product-tile";
import { deleteBrand } from "../actions";

export default async function BrandPage({ params }: PageProps<"/brands/[brandId]">) {
  const { brandId } = await params;
  const { supabase } = await requireUser();
  const [brand, { data: products }] = await Promise.all([
    getBrand(supabase, brandId),
    supabase
      .from("products")
      .select("id, name, status, completeness, product_images(storage_path, sort_order)")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false }),
  ]);
  const p = brand.profile;

  const thumbs = (products ?? []).map((pr) => {
    const imgs = (pr.product_images as Array<{ storage_path: string; sort_order: number }>) ?? [];
    return imgs.sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path ?? "";
  });
  const urls = await signedUrls(supabase, [brand.logo_path ?? "", ...thumbs]);
  const caption = CAPTION_PROFILES.find((c) => c.value === p.caption_profile);
  const audience = `${p.target_audience.gender === "wszyscy" ? "Kobiety i mężczyźni" : capitalize(p.target_audience.gender)}, ${p.target_audience.age_from}–${p.target_audience.age_to} lat`;
  const swatches = (["primary", "secondary", "accent", "caption_text"] as const).map((k) => p.colors[k]).filter(Boolean);

  return (
    <>
      <div className="mb-3">
        <BackLink href="/brands">Marki</BackLink>
      </div>
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <Logo url={brand.logo_path ? urls[brand.logo_path] : undefined} name={brand.name} size={60} />
        <div className="min-w-0 flex-1 basis-56">
          <h1 className="truncate text-3xl font-extrabold tracking-tight">{brand.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-muted">
            {brand.status === "ready" ? <Badge tone="ok" dot>Zatwierdzona</Badge> : <Badge tone="warn" dot>Do zatwierdzenia</Badge>}
            {brand.website_url ? (
              <a href={brand.website_url} target="_blank" rel="noreferrer" className="hover:text-text">{new URL(brand.website_url).hostname} ↗</a>
            ) : null}
          </div>
        </div>
        <Link href={`/brands/${brand.id}/setup`} className={buttonClass(brand.status === "ready" ? "secondary" : "primary")}>
          {brand.status === "ready" ? "Edytuj profil" : "Sprawdź i zatwierdź"}
        </Link>
      </div>

      <Card>
        {p.tagline ? <p className="max-w-2xl text-lg font-semibold leading-snug">{p.tagline}</p> : null}
        <div className="mt-5 flex flex-wrap items-start gap-x-10 gap-y-5">
          <Fact label="Dla kogo">{audience}</Fact>
          {p.personas.length > 0 ? (
            <Fact label={`Persony (${p.personas.length})`}>
              <div className="flex flex-wrap gap-1.5">
                {p.personas.map((persona, i) => (
                  <span key={i} title={persona.who} className="rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-xs font-bold">
                    {persona.name || "Persona"}
                  </span>
                ))}
              </div>
            </Fact>
          ) : null}
          {swatches.length > 0 ? (
            <Fact label="Kolory">
              <div className="flex -space-x-1.5">
                {swatches.map((hex, i) => (
                  <span key={i} title={hex} className="h-6 w-6 rounded-full ring-2 ring-surface" style={{ background: hex }} />
                ))}
              </div>
            </Fact>
          ) : null}
        </div>

        <div className="mt-5 border-t border-border pt-3">
          <Disclosure plain title="Szczegóły profilu">
            <div className="grid gap-4 text-sm sm:grid-cols-2">
              <Fact label="Nisza">{p.niche || "—"}</Fact>
              <Fact label="Napisy w sklejkach">{caption?.label.split(" — ")[0] ?? p.caption_profile}</Fact>
              <Fact label="Problemy klientów">{p.target_audience.pains.length}</Fact>
              <Fact label="Pragnienia">{p.target_audience.desires.length}</Fact>
              {p.tone_of_voice.description ? (
                <div className="sm:col-span-2">
                  <Fact label="Ton">{p.tone_of_voice.description}</Fact>
                </div>
              ) : null}
            </div>
          </Disclosure>
        </div>
      </Card>

      <div className="mb-4 mt-12 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
          Produkty
          {products?.length ? <span className="rounded-full bg-surface-3 px-2 text-sm text-muted">{products.length}</span> : null}
        </h2>
        {products?.length ? (
          <Link href={`/brands/${brand.id}/products/new`} className={buttonClass()}>+ Dodaj produkt</Link>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {(products ?? []).map((pr, i) => (
          <ProductTile
            key={pr.id}
            href={`/brands/${brand.id}/products/${pr.id}`}
            name={pr.name}
            ready={pr.status === "ready"}
            image={thumbs[i] ? urls[thumbs[i]] : undefined}
          />
        ))}
        <AddTile href={`/brands/${brand.id}/products/new`} first={!products?.length} />
      </div>

      <div className="mt-16 flex justify-end">
        <form action={deleteBrand}>
          <input type="hidden" name="brandId" value={brand.id} />
          <ConfirmButton subtle message={`Usunąć markę „${brand.name}” razem z produktami i zdjęciami? Tego nie da się cofnąć.`}>
            Usuń markę
          </ConfirmButton>
        </form>
      </div>
    </>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-faint">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
