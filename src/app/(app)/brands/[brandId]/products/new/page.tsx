import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getBrand } from "@/lib/data";
import { PageHeader, buttonClass } from "@/components/ui";
import { NewProductForm } from "./new-product-form";

export const maxDuration = 300;

export default async function NewProductPage({ params }: PageProps<"/brands/[brandId]/products/new">) {
  const { brandId } = await params;
  const { supabase } = await requireUser();
  const brand = await getBrand(supabase, brandId);

  return (
    <>
      <PageHeader
        title={`Nowy produkt — ${brand.name}`}
        description="Wklej link do strony produktu. Clipzy pobierze opis, cenę i zdjęcia, obejrzy je i sam przygotuje profil: problemy, które produkt rozwiązuje, mechanizm, obiekcje i 10–15 kątów reklamowych z hookami."
        actions={<Link href={`/brands/${brand.id}`} className={buttonClass("ghost")}>← Wróć</Link>}
      />
      <NewProductForm brandId={brand.id} />
    </>
  );
}
