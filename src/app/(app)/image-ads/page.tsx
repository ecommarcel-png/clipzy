import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Badge, Card, PageHeader, buttonClass } from "@/components/ui";

export default async function ImageAdsPage() {
  const { supabase } = await requireUser();
  const { data: sets, error } = await supabase
    .from("image_ad_sets")
    .select("id, name, count, status, created_at, brands(name), products(name)")
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader
        title="Image ads"
        description="Statyczne reklamy pod Meta: 1:1 i 9:16 z gotowym copy. Zespół AI robi cały zestaw naraz."
        actions={<Link href="/image-ads/new" className={buttonClass()}>+ Nowe image ads</Link>}
      />
      {error ? (
        <Card className="text-sm text-muted">Uruchom w Supabase migracje <code>0005_files.sql</code> i <code>0006_image_ads.sql</code> (instrukcja w README), żeby włączyć image ads.</Card>
      ) : !sets?.length ? (
        <Card className="py-12 text-center">
          <p className="text-lg font-extrabold">Pierwszy zestaw reklam</p>
          <p className="mt-1 text-sm text-muted">Wybierasz produkt i liczbę kreacji — dostajesz gotowe grafiki z copy.</p>
          <Link href="/image-ads/new" className={buttonClass("primary", "mt-5")}>+ Nowe image ads</Link>
        </Card>
      ) : (
        <div className="grid gap-3">
          {sets.map((s) => {
            const brand = (s.brands as unknown as { name: string } | null)?.name;
            const product = (s.products as unknown as { name: string } | null)?.name;
            const date = new Date(s.created_at).toLocaleString("pl-PL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" });
            return (
              <Link key={s.id} href={`/image-ads/${s.id}`} className="block">
                <Card className="flex items-center gap-3 py-4 transition hover:border-border-strong">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-extrabold">{s.name}</div>
                    <div className="truncate text-xs text-muted">{[brand, product, date].filter(Boolean).join(" — ")}</div>
                  </div>
                  <Badge tone={s.status === "done" ? "ok" : s.status === "error" ? "danger" : "accent"} dot>{s.status === "done" ? "Gotowe" : s.status === "error" ? "Błąd" : "W toku"}</Badge>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
