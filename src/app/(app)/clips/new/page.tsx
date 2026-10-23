import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, buttonClass } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { library } from "@/lib/clips/library";
import { NewClipForm } from "./new-clip-form";

export default async function NewClipPage() {
  const { supabase } = await requireUser();
  const { data: brands } = await supabase.from("brands").select("id, name, products(id, name)").order("created_at", { ascending: false });

  return (
    <>
      <PageHeader title="Nowa sklejka" description="Wybierz produkt. Nagrania wgrasz na następnym ekranie." back={<BackLink href="/clips">Sklejki</BackLink>} />
      {!brands?.length ? (
        <Card className="max-w-2xl text-sm">
          Najpierw dodaj markę i produkt. <Link href="/brands/new" className={buttonClass("secondary", "ml-2")}>Dodaj markę</Link>
        </Card>
      ) : (
        <NewClipForm
          brands={brands.map((b) => ({ id: b.id, name: b.name, products: ((b.products as unknown as Array<{ id: string; name: string }>) ?? []).map((p) => ({ id: p.id, name: p.name })) }))}
          music={library.music.map((m) => ({ file: m.file, name: m.name }))}
        />
      )}
    </>
  );
}
