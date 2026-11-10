import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, buttonClass } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { library } from "@/lib/clips/library";
import { libraryCards } from "@/lib/clips/library-view";
import { NewClipForm } from "./new-clip-form";
import { VOICES } from "@/lib/voices";

export default async function NewClipPage({ searchParams }: PageProps<"/clips/new">) {
  const sp = await searchParams;
  const pick = (v: string | string[] | undefined) => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : undefined);
  const { supabase } = await requireUser();
  // problems and angles of each product: the user picks what each sklejka is about
  const { data: brands } = await supabase
    .from("brands")
    .select("id, name, products(id, name, problems:profile->problems, angles:profile->ad_angles)")
    .order("created_at", { ascending: false });
  const saved = brands?.length ? await libraryCards(supabase, {}) : [];

  return (
    <>
      <PageHeader title="Nowa sklejka" description="Wybierz produkt, ile sklejek i o czym ma być każda. Nagrania wgrasz na następnym ekranie." back={<BackLink href="/clips">Sklejki</BackLink>} />
      {!brands?.length ? (
        <Card className="max-w-2xl text-sm">
          Najpierw dodaj markę i produkt. <Link href="/brands/new" className={buttonClass("secondary", "ml-2")}>Dodaj markę</Link>
        </Card>
      ) : (
        <NewClipForm
          brands={brands.map((b) => ({
            id: b.id,
            name: b.name,
            products: ((b.products as unknown as Array<{ id: string; name: string; problems: unknown; angles: unknown }>) ?? []).map((p) => ({
              id: p.id,
              name: p.name,
              problems: Array.isArray(p.problems) ? p.problems.filter((x): x is string => typeof x === "string" && Boolean(x.trim())).slice(0, 20) : [],
              angles: Array.isArray(p.angles)
                ? p.angles
                    .map((a) => (typeof a === "string" ? { angle: a, hook: "" } : { angle: String((a as { angle?: unknown })?.angle ?? ""), hook: String((a as { hook?: unknown })?.hook ?? "") }))
                    .filter((a) => a.angle.trim())
                    .slice(0, 20)
                : [],
            })),
          }))}
          music={library.music.map((m) => ({ file: m.file, name: m.name }))}
          saved={saved}
          voices={VOICES.map((v) => ({ id: v.id, label: v.label, elevenName: v.elevenName }))}
          initial={{ brandId: pick(sp.brand), productId: pick(sp.product) }}
        />
      )}
    </>
  );
}
