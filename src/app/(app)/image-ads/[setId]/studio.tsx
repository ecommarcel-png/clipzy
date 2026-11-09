"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Disclosure, Label, Notice, Select, Spinner, Textarea, cx } from "@/components/ui";
import { TEMPLATES, TEMPLATE_INFO, type AdStyle, type Fields, type TemplateKey } from "@/lib/image-ads/templates";
import type { Stage } from "@/lib/image-ads/steps";
import { advanceImageSetAction, regenerateImageAdAction, retryImageSetAction } from "../actions";
import { EditPanel } from "./edit-panel";

export type StudioAd = {
  id: string; idx: number; stage: Stage; template: TemplateKey; label: string; angle: string;
  copy: { primary_text: string; headline: string; description: string } | null; fields: Fields | null; style: AdStyle | null; error: string | null;
  urls: { "1x1": string | null; "9x16": string | null }; downloads: { "1x1": string | null; "9x16": string | null };
  review: { score: number; issues: string[]; before: number | null } | null; version: number;
};

const STAGE: Record<Stage, string> = {
  copy: "Copywriter pisze teksty",
  design: "Fotograf i Grafik planują",
  photos: "Zdjęcia w fal.ai",
  render: "Grafik składa grafiki",
  review: "Kontroler sprawdza",
  fix: "Wdrażanie poprawek",
  final: "Kontroler — ocena po poprawkach",
  done: "Gotowe",
  error: "Błąd",
};
const WEIGHT: Record<Stage, number> = { copy: 0.05, design: 0.15, photos: 0.3, render: 0.55, review: 0.7, fix: 0.8, final: 0.9, done: 1, error: 1 };

const MAX_STEPS = 600;

export function ImageAdsStudio({ set, ads, palette }: { set: { id: string; count: number; status: string; error: string | null }; ads: StudioAd[]; palette: string[] }) {
  const router = useRouter();
  const looping = useRef(false);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fmt, setFmt] = useState<"1x1" | "9x16">("1x1");
  const [editing, setEditing] = useState<string | null>(null);
  const [redo, setRedo] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (looping.current) return;
    looping.current = true;
    setRunning(true);
    setErr(null);
    let fails = 0;
    for (let i = 0; i < MAX_STEPS; i++) {
      // the retry of a failed step marks its creatives as failed, so one bad batch never stops the set
      const r = await advanceImageSetAction(set.id, fails > 0);
      if (!r.ok) {
        if (r.stop) {
          setErr(r.error);
          break;
        }
        fails++;
        if (fails >= 2) {
          setErr(r.error);
          fails = 0;
        }
        router.refresh();
        await new Promise((res) => setTimeout(res, 1500));
        continue;
      }
      fails = 0;
      router.refresh();
      if (r.done) break;
    }
    looping.current = false;
    setRunning(false);
    router.refresh();
  }, [router, set.id]);

  useEffect(() => {
    if (set.status !== "running") return;
    const t = setTimeout(() => void run(), 50);
    return () => clearTimeout(t);
  }, [set.status, run]);

  const done = ads.filter((a) => a.stage === "done").length;
  const failed = ads.filter((a) => a.stage === "error").length;
  const progress = ads.length ? ads.reduce((s, a) => s + WEIGHT[a.stage], 0) / ads.length : 0;
  const active = ads.length ? (Object.keys(STAGE) as Stage[]).filter((s) => s !== "done" && s !== "error" && ads.some((a) => a.stage === s)) : [];

  return (
    <div className="space-y-6">
      {set.status === "error" ? (
        <Card className="space-y-3">
          <Notice tone="danger">{set.error ?? "Strateg nie zaplanował zestawu."}</Notice>
          <Button onClick={async () => { await retryImageSetAction(set.id); router.refresh(); }}>Spróbuj ponownie</Button>
        </Card>
      ) : done + failed < Math.max(ads.length, 1) || running ? (
        <Card className="space-y-3">
          <div className="flex items-center gap-3">
            {running ? <Spinner /> : null}
            <div className="flex-1 font-extrabold">
              {!ads.length ? "Strateg planuje zestaw…" : `Gotowe ${done} z ${ads.length}`}
            </div>
            {!running && set.status === "running" ? <Button variant="secondary" onClick={() => void run()}>Wznów</Button> : null}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.round((ads.length ? progress : 0.03) * 100)}%` }} /></div>
          {active.length ? <div className="flex flex-wrap gap-2">{active.map((s) => <Badge key={s} tone="accent" dot>{STAGE[s]} ({ads.filter((a) => a.stage === s).length})</Badge>)}</div> : null}
          <p className="text-xs text-muted">Nie zamykaj tej strony — zespół pracuje, gdy jest otwarta. Po powrocie wznowi od miejsca, w którym skończył.</p>
        </Card>
      ) : null}
      {err ? <Notice tone="danger">{err}</Notice> : null}

      {ads.length ? (
        <div className="flex items-center gap-2">
          {(["1x1", "9x16"] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFmt(f)} aria-pressed={fmt === f} className={cx("rounded-full border px-4 py-1.5 text-sm font-semibold transition", fmt === f ? "border-accent bg-accent/15 text-text" : "border-border text-muted hover:text-text")}>
              {f === "1x1" ? "1:1 (feed)" : "9:16 (Reels, Stories)"}
            </button>
          ))}
        </div>
      ) : null}

      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {ads.map((a) => (
          <AdCard
            key={a.id}
            ad={a}
            fmt={fmt}
            busy={running}
            onEdit={() => setEditing(a.id)}
            onRegenerate={() => setRedo(a.id)}
          />
        ))}
      </ul>

      {redo ? (
        <RegenerateDialog
          ad={ads.find((a) => a.id === redo)!}
          onClose={() => setRedo(null)}
          onConfirm={async (change) => {
            const r = await regenerateImageAdAction(set.id, redo, change);
            setRedo(null);
            if (!r.ok) return setErr(r.error ?? "Nie udało się.");
            router.refresh();
            void run();
          }}
        />
      ) : null}

      {editing ? (
        <EditPanel
          setId={set.id}
          ad={ads.find((a) => a.id === editing)!}
          palette={palette}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh(); }}
        />
      ) : null}
    </div>
  );
}

function CopyRow({ label, text }: { label: string; text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-faint">{label}</span>
        <button type="button" className="text-xs font-bold text-accent hover:text-accent-strong" onClick={async () => { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); }}>
          {ok ? "Skopiowano" : "Kopiuj"}
        </button>
      </div>
      <p className="whitespace-pre-line text-sm">{text}</p>
    </div>
  );
}

function AdCard({ ad, fmt, busy, onEdit, onRegenerate }: { ad: StudioAd; fmt: "1x1" | "9x16"; busy: boolean; onEdit: () => void; onRegenerate: () => void }) {
  const url = ad.urls[fmt];
  const ready = ad.stage === "done" || ad.stage === "final" || ad.stage === "review";
  return (
    <li>
      <Card className="flex h-full flex-col gap-3 p-3">
        <div className={cx("relative flex items-center justify-center overflow-hidden rounded-xl bg-[#0a0a0a]", fmt === "1x1" ? "aspect-square" : "aspect-[9/16]")}>
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={ad.copy?.headline ?? ad.label} className="h-full w-full object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted">
              {ad.stage === "error" ? null : <Spinner />}
              <span>{STAGE[ad.stage]}</span>
            </div>
          )}
          {url && !ready && ad.stage !== "error" ? <div className="absolute left-2 top-2"><Badge tone="accent" dot>{STAGE[ad.stage]}</Badge></div> : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-extrabold">#{ad.idx + 1}</span>
          <Badge tone="neutral">{ad.label}</Badge>
          {ad.review ? <Badge tone={ad.review.score >= 8 ? "ok" : "warn"} dot>Kontroler {ad.review.score}/10{ad.review.before ? ` (było ${ad.review.before})` : ""}</Badge> : null}
        </div>
        {ad.stage === "error" ? <Notice tone="danger">{ad.error ?? "Coś poszło nie tak."}</Notice> : <p className="text-xs text-muted">{ad.angle}</p>}
        {ad.review?.issues.length ? (
          <Disclosure plain title={`Uwagi Kontrolera (${ad.review.issues.length})`}>
            <ul className="list-disc space-y-1 pl-4 text-sm text-muted">{ad.review.issues.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </Disclosure>
        ) : null}
        {ad.copy ? (
          <Disclosure plain title="Copy reklamy">
            <div className="space-y-3">
              <CopyRow label="Tekst główny" text={ad.copy.primary_text} />
              <CopyRow label="Nagłówek" text={ad.copy.headline} />
              <CopyRow label="Opis" text={ad.copy.description} />
            </div>
          </Disclosure>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-border pt-3 text-sm">
          {ad.downloads["1x1"] ? <a href={ad.downloads["1x1"]} download className="font-bold text-accent hover:text-accent-strong">Pobierz 1:1</a> : null}
          {ad.downloads["9x16"] ? <a href={ad.downloads["9x16"]} download className="font-bold text-accent hover:text-accent-strong">Pobierz 9:16</a> : null}
          {ad.fields && ad.style && ad.stage === "done" ? <button type="button" onClick={onEdit} className="font-semibold text-muted hover:text-text">Edytuj</button> : null}
          {ad.stage === "done" || ad.stage === "error" ? <button type="button" disabled={busy && ad.stage !== "error"} onClick={onRegenerate} className="ml-auto font-semibold text-muted hover:text-text disabled:opacity-40">Przegeneruj</button> : null}
        </div>
      </Card>
    </li>
  );
}

function RegenerateDialog({ ad, onClose, onConfirm }: { ad: StudioAd; onClose: () => void; onConfirm: (c: { template: TemplateKey; note: string }) => Promise<void> }) {
  const [template, setTemplate] = useState<TemplateKey>(ad.template);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-10" role="dialog" aria-modal="true" aria-label={`Przegeneruj kreację #${ad.idx + 1}`}>
      <div className="w-full max-w-lg space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold">Przegeneruj kreację #{ad.idx + 1}</h2>
          <button type="button" onClick={onClose} className="text-sm font-bold text-muted hover:text-text">Zamknij</button>
        </div>
        <div>
          <Label htmlFor="rg-template">Format</Label>
          <Select id="rg-template" value={template} onChange={(e) => setTemplate(e.target.value as TemplateKey)}>
            {TEMPLATES.map((t) => <option key={t} value={t}>{TEMPLATE_INFO[t].label}{t === ad.template ? " (obecny)" : ""}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="rg-note" hint="opcjonalnie">Co ma być w tej kreacji</Label>
          <Textarea id="rg-note" rows={4} maxLength={600} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Np. przed: truskawkowe nogi (ciemne kropki w porach), po: gładka skóra. Nagłówek prosto: Koniec z truskawkowymi nogami." />
        </div>
        <p className="text-xs text-muted">Zespół zrobi tę kreację od nowa (teksty, zdjęcie, grafika) — zużyje kredyty fal.ai i Claude. Pozostałe kreacje zostają bez zmian.</p>
        <div className="flex gap-3">
          <Button disabled={busy} onClick={async () => { setBusy(true); await onConfirm({ template, note }); }}>{busy ? <><Spinner /> Zaczynam…</> : "Przegeneruj"}</Button>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Anuluj</Button>
        </div>
      </div>
    </div>
  );
}
