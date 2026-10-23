import { requireUser } from "@/lib/auth";
import { getBrand } from "@/lib/data";
import { PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { NewProductForm } from "./new-product-form";

export const maxDuration = 300;

export default async function NewProductPage({ params }: PageProps<"/brands/[brandId]/products/new">) {
  const { brandId } = await params;
  const { supabase } = await requireUser();
  const brand = await getBrand(supabase, brandId);

  return (
    <>
      <PageHeader
        title="Nowy produkt"
        description="Wklej link do produktu. Problemy, kąty reklamowe i hooki Claude przygotuje sam."
        back={<BackLink href={`/brands/${brand.id}`}>{brand.name}</BackLink>}
      />
      <NewProductForm brandId={brand.id} />
    </>
  );
}
