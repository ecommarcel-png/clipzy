import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, buttonClass } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { NewImageAdsForm } from "./new-form";

export default async function NewImageAdsPage({ searchParams }: PageProps<"/image-ads/new">) {
  const sp = await searchParams;
  const pick = (v: string | string[] | undefined) => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : undefined);
  const { supabase } = await requireUser();
  const { data: brands } = await supabase.from("brands").select("id, name, products(id, name)").order("created_at", { ascending: false });
  return (
    <>
      <PageHeader title="Nowe image ads" description="Wybierz produkt i ile kreacji chcesz. Resztę robi zespół Clipzy." back={<BackLink href="/image-ads">Image ads</BackLink>} />
      {!brands?.length ? (
        <Card className="max-w-2xl text-sm">
          Najpierw dodaj markę i produkt. <Link href="/brands/new" className={buttonClass("secondary", "ml-2")}>Dodaj markę</Link>
        </Card>
      ) : (
        <NewImageAdsForm
          brands={brands.map((b) => ({ id: b.id, name: b.name, products: ((b.products as unknown as Array<{ id: string; name: string }>) ?? []).map((p) => ({ id: p.id, name: p.name })) }))}
          initial={{ brandId: pick(sp.brand), productId: pick(sp.product) }}
        />
      )}
    </>
  );
}
