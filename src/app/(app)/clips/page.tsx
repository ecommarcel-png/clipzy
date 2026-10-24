import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Card, PageHeader, buttonClass } from "@/components/ui";
import { ClipRow } from "./clip-row";

const STATUS: Record<string, { label: string; tone: "neutral" | "ok" | "warn" | "danger" | "accent" }> = {
  draft: { label: "Szkic", tone: "neutral" },
  analyzing: { label: "W toku", tone: "accent" },
  generating: { label: "W toku", tone: "accent" },
  planning: { label: "W toku", tone: "accent" },
  ready: { label: "Do renderu", tone: "warn" },
  rendered: { label: "Gotowa", tone: "ok" },
  error: { label: "Błąd", tone: "danger" },
};

export default async function ClipsPage() {
  const { supabase } = await requireUser();
  const { data: projects, error } = await supabase
    .from("clip_projects")
    .select("id, name, status, created_at, brands(name), products(name)")
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader
        title="Sklejki"
        description="Wgrywasz nagrania produktu, Reżyser montuje z nich reklamę."
        actions={<Link href="/clips/new" className={buttonClass()}>+ Nowa sklejka</Link>}
      />
      {error ? (
        <Card className="text-sm text-muted">Uruchom w Supabase migrację <code>0003_clips.sql</code> (instrukcja w README), żeby włączyć sklejki.</Card>
      ) : !projects?.length ? (
        <Card className="py-12 text-center">
          <p className="text-lg font-extrabold">Pierwsza sklejka</p>
          <p className="mt-1 text-sm text-muted">Wystarczą nagrania produktu z telefonu. Lektor jest opcjonalny.</p>
          <Link href="/clips/new" className={buttonClass("primary", "mt-5")}>+ Nowa sklejka</Link>
        </Card>
      ) : (
        <div className="grid gap-3">
          {projects.map((p) => {
            const st = STATUS[p.status] ?? STATUS.draft;
            const brand = (p.brands as unknown as { name: string } | null)?.name;
            const product = (p.products as unknown as { name: string } | null)?.name;
            const date = new Date(p.created_at).toLocaleString("pl-PL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" });
            return <ClipRow key={p.id} id={p.id} name={p.name} status={st} meta={[brand, product, date].filter(Boolean).join(" — ")} />;
          })}
        </div>
      )}
    </>
  );
}
