"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { Badge, Button, Card, Input, Label, Notice, Select, Spinner, Textarea, cx } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { prepareVideo } from "../clips/[clipId]/media";
import { LIMITS, firstLine } from "@/lib/ad-copy/steps";
import { adCopyReady, advanceCopyAction, deleteCopyItem, registerCopyItems, retryCopy, rewriteCopy, saveCopy } from "./actions";

type Fields = { primary: string; headline: string; description: string };
export type ItemView = {
  id: string; name: string; kind: "video" | "image"; stage: "analyze" | "write" | "done" | "error"; error: string | null; url: string | null;
  brand: string | null; product: string | null; fromFiles: boolean; rewriting: boolean;
  copy: (Fields & { angle: string; why: string }) | null;
};
export type PickableFile = { id: string; name: string; kind: "video" | "image"; format: string | null; brand: string | null; brandId: string | null; url: string | null };
type Brand = { id: string; name: string; products: Array<{ id: string; name: string }> };

const MAX_FILES = 20;
const isImage = (f: File) => f.type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(f.name);
const isVideo = (f: File) => f.type.startsWith("video/") || /\.(mp4|mov|webm)$/i.test(f.name);

export function AdCopyTool({ userId, brands, items, files }: { userId: string; brands: Brand[]; items: ItemView[]; files: PickableFile[] }) {
  const router = useRouter();
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const brand = brands.find((b) => b.id === brandId);
  const [productId, setProductId] = useState(brand?.products[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const looping = useRef(false);
  const active = items.some((i) => i.stage === "analyze" || i.stage === "write");

  const run = useCallback(async () => {
    if (looping.current) return;
    looping.current = true;
    setRunning(true);
    for (let n = 0; n < 200; n++) {
      const r = await advanceCopyAction();
      router.refresh();
      if (!r.ok) {
        setErr(r.error);
        if (r.stop) break;
        await new Promise((res) => setTimeout(res, 3000));
        continue;
      }
      if (!r.active) break;
    }
    looping.current = false;
    setRunning(false);
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => void run(), 50);
    return () => clearTimeout(t);
  }, [active, run]);

  async function start(list: File[], fileIds: string[]) {
    if (!brandId) return setErr("Wybierz markę.");
    const media = list.filter((f) => isImage(f) || isVideo(f));
    if (!media.length && !fileIds.length) return setErr("Wrzuć filmy (MP4, MOV, WEBM) albo grafiki (PNG, JPG, WEBP).");
    if (media.length + fileIds.length > MAX_FILES) return setErr(`Naraz maksymalnie ${MAX_FILES} kreacji.`);
    setErr(null);
    const ready = await adCopyReady();
    if (!ready.ok) return setErr(ready.error);
    const supabase = createClient();
    const uploads: Array<{ id: string; path: string; name: string; kind: "video" | "image" }> = [];
    try {
      for (const [i, raw] of media.entries()) {
        const kind = isImage(raw) ? "image" : "video";
        setBusy(`Przygotowuję ${i + 1}/${media.length}: ${raw.name}`);
        const file = kind === "video" ? await prepareVideo(raw, (p) => setBusy(`Zmniejszam ${raw.name}: ${Math.round(p * 100)}%`)) : raw;
        setBusy(`Wysyłam ${i + 1}/${media.length}: ${raw.name}`);
        const id = crypto.randomUUID();
        const ext = kind === "video" ? (file.type === "video/webm" ? "webm" : "mp4") : (raw.name.match(/\.(png|jpe?g|webp)$/i)?.[1] ?? "png").toLowerCase();
        const path = `${userId}/ad-copy/${id}/creative.${ext}`;
        const { error } = await supabase.storage.from("media").upload(path, file, { contentType: file.type || (kind === "video" ? "video/mp4" : `image/${ext === "jpg" ? "jpeg" : ext}`) });
        if (error) throw new Error(`${raw.name}: ${error.message}`);
        uploads.push({ id, path, name: raw.name, kind });
      }
      const r = await registerCopyItems({ brandId, productId: productId || null, note, uploads, files: fileIds });
      if (!r.ok) throw new Error(r.error);
      setPicked([]);
      setPicking(false);
      router.refresh();
      void run();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const brandFiles = files.filter((f) => !f.brandId || f.brandId === brandId);

  return (
    <div className="space-y-8">
      <Card className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="ac-brand">Marka</Label>
            <Select id="ac-brand" value={brandId} onChange={(e) => { setBrandId(e.target.value); setProductId(brands.find((b) => b.id === e.target.value)?.products[0]?.id ?? ""); }}>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="ac-product">Produkt</Label>
            <Select id="ac-product" value={productId} onChange={(e) => setProductId(e.target.value)}>
              {brand?.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              <option value="">Cała marka (bez konkretnego produktu)</option>
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="ac-note" hint="Opcjonalnie: aktualna promocja, dokąd prowadzi link, czego unikać.">Uwagi do tekstów</Label>
          <Textarea id="ac-note" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Np. „-30% do niedzieli, link prowadzi na stronę produktu”" />
        </div>

        <label
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); void start(Array.from(e.dataTransfer.files), []); }}
          className={cx("flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition", drag ? "border-accent bg-accent/10" : "border-border hover:border-border-strong")}
        >
          <input type="file" accept="video/mp4,video/quicktime,video/webm,image/png,image/jpeg,image/webp" multiple className="sr-only" disabled={Boolean(busy)} onChange={(e) => { void start(Array.from(e.target.files ?? []), []); e.target.value = ""; }} />
          {busy ? <><Spinner /><span className="text-sm font-semibold">{busy}</span></> : (
            <>
              <span className="text-lg font-extrabold">Wrzuć kreacje</span>
              <span className="text-sm text-muted">Filmy i grafiki, kilka naraz (do {MAX_FILES}). Przeciągnij tutaj albo kliknij.</span>
              <span className="text-xs text-faint">Koszt: Gemini ogląda kreację + Claude pisze tekst — kilka centów za kreację, z Twoich kluczy.</span>
            </>
          )}
        </label>

        <div>
          <button type="button" onClick={() => setPicking((v) => !v)} aria-expanded={picking} className="text-sm font-medium text-muted underline-offset-4 hover:text-text hover:underline">
            {picking ? "Schowaj Twoje pliki" : "…albo wybierz gotowe reklamy z „Twoich plików”"}
          </button>
          {picking ? (
            brandFiles.length ? (
              <div className="mt-3 space-y-3">
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
                  {brandFiles.map((f) => {
                    const on = picked.includes(f.id);
                    return (
                      <li key={f.id}>
                        <button type="button" aria-pressed={on} onClick={() => setPicked((p) => (on ? p.filter((x) => x !== f.id) : [...p, f.id]))}
                          className={cx("relative block w-full overflow-hidden rounded-lg border text-left transition", on ? "border-white ring-2 ring-white/40" : "border-border hover:border-border-strong")}>
                          <div className="flex aspect-[4/5] items-center justify-center bg-[#0a0a0a]">
                            {f.url ? (f.kind === "image" ? <img src={f.url} alt="" className="h-full w-full object-cover" /> : <video src={`${f.url}#t=0.1`} preload="metadata" muted playsInline className="h-full w-full object-cover" />) : null}
                          </div>
                          <span className="block truncate px-2 py-1.5 text-[11px] text-muted" title={f.name}>{f.name}</span>
                          {on ? <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-bold text-black">✓</span> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <Button disabled={!picked.length || Boolean(busy)} onClick={() => void start([], picked)}>
                  Napisz copy do {picked.length || ""} {picked.length === 1 ? "reklamy" : "reklam"}
                </Button>
              </div>
            ) : <p className="mt-2 text-sm text-faint">W „Twoich plikach” nie ma jeszcze reklam tej marki.</p>
          ) : null}
        </div>
      </Card>

      {err ? <Notice tone="danger">{err}</Notice> : null}
      {running ? <p className="flex items-center gap-2 text-xs text-muted"><Spinner /> Oglądam kreacje i piszę teksty — nie zamykaj tej strony. Po powrocie wznowię.</p> : null}

      {items.length ? (
        <ul className="space-y-4">
          {items.map((i) => <ItemCard key={i.id} item={i} onChanged={() => { router.refresh(); void run(); }} />)}
        </ul>
      ) : null}
    </div>
  );
}

function stageLabel(i: ItemView) {
  if (i.stage === "analyze") return "Oglądam kreację";
  if (i.stage === "write") return i.rewriting ? "Piszę inną wersję" : "Piszę tekst";
  if (i.stage === "error") return "Błąd";
  return "Gotowe";
}

function ItemCard({ item: i, onChanged }: { item: ItemView; onChanged: () => void }) {
  const working = i.stage === "analyze" || i.stage === "write";
  // the fields restart from the server text whenever a new version arrives
  const key = i.copy ? `${i.copy.primary}|${i.copy.headline}|${i.copy.description}` : "none";
  return (
    <li>
      <Card className="flex flex-col gap-5 p-4 sm:flex-row">
        <div className="relative flex h-80 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#0a0a0a] sm:h-auto sm:min-h-80 sm:w-56">
          {i.url ? (i.kind === "image" ? <img src={i.url} alt={i.name} className="max-h-full w-full object-contain" /> : <video src={`${i.url}#t=0.1`} preload="metadata" controls playsInline className="max-h-[28rem] w-full object-contain" />) : <span className="text-xs text-faint">Brak podglądu</span>}
        </div>
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 truncate font-semibold" title={i.name}>{i.name}</span>
            <Badge tone={i.stage === "done" ? "ok" : i.stage === "error" ? "danger" : "accent"} dot>{stageLabel(i)}</Badge>
            {i.fromFiles ? <Badge>z Twoich plików</Badge> : null}
            <span className="text-xs text-faint">{[i.brand, i.product].filter(Boolean).join(" — ")}</span>
          </div>
          {i.stage === "error" ? (
            <div className="space-y-2">
              <Notice tone="danger">{i.error ?? "Coś poszło nie tak."}</Notice>
              <Button variant="secondary" onClick={async () => { await retryCopy(i.id); onChanged(); }}>Spróbuj ponownie</Button>
            </div>
          ) : null}
          {working && !i.copy ? (
            <div className="space-y-3" aria-hidden>
              {[0, 1, 2].map((k) => <div key={k} className={cx("animate-pulse rounded-lg bg-surface-2", k ? "h-9" : "h-32")} />)}
            </div>
          ) : null}
          {i.copy ? <CopyEditor key={key} item={i} copy={i.copy} disabled={working} onChanged={onChanged} /> : null}
          <form action={deleteCopyItem} className="flex justify-end">
            <input type="hidden" name="itemId" value={i.id} />
            <ConfirmButton subtle message={`Usunąć tekst do „${i.name}”?${i.fromFiles ? " Reklama zostanie w „Twoich plikach”." : ""}`}>Usuń</ConfirmButton>
          </form>
        </div>
      </Card>
    </li>
  );
}

function CopyEditor({ item, copy, disabled, onChanged }: { item: ItemView; copy: NonNullable<ItemView["copy"]>; disabled: boolean; onChanged: () => void }) {
  const [f, setF] = useState<Fields>({ primary: copy.primary, headline: copy.headline, description: copy.description });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [ask, setAsk] = useState("");
  const dirty = f.primary !== copy.primary || f.headline !== copy.headline || f.description !== copy.description;
  const hook = firstLine(f.primary).length;
  const all = `${f.primary}\n\nNagłówek: ${f.headline}\nOpis: ${f.description}`;

  return (
    <div className="space-y-4">
      {copy.angle ? <p className="text-xs text-muted"><span className="text-faint">Kąt:</span> {copy.angle}</p> : null}
      <Field label="Tekst główny" count={`1. linijka ${hook}/${LIMITS.hook}`} over={hook > LIMITS.hook} text={f.primary}>
        <Textarea value={f.primary} disabled={disabled} onChange={(e) => setF({ ...f, primary: e.target.value })} rows={Math.min(16, Math.max(6, f.primary.split("\n").length + 1))} className="text-sm leading-relaxed" />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nagłówek" count={`${f.headline.length}/${LIMITS.headline}`} over={f.headline.length > LIMITS.headline} text={f.headline}>
          <Input value={f.headline} disabled={disabled} onChange={(e) => setF({ ...f, headline: e.target.value })} />
        </Field>
        <Field label="Opis" count={`${f.description.length}/${LIMITS.description}`} over={f.description.length > LIMITS.description} text={f.description}>
          <Input value={f.description} disabled={disabled} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
      </div>
      {copy.why ? <p className="text-xs text-faint">{copy.why}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <CopyButton text={all} label="Kopiuj wszystko" primary />
        {dirty ? (
          <Button variant="secondary" disabled={saving} onClick={async () => {
            setSaving(true);
            const r = await saveCopy(item.id, f);
            setSaving(false);
            setMsg(r.ok ? "Zapisano." : r.error);
            if (r.ok) onChanged();
          }}>{saving ? "Zapisuję…" : "Zapisz zmiany"}</Button>
        ) : null}
        <Button variant="ghost" disabled={disabled} onClick={() => setAsking((v) => !v)} aria-expanded={asking}>Inna wersja</Button>
        {msg ? <span className="text-xs text-muted">{msg}</span> : null}
      </div>
      {asking && !disabled ? (
        <div className="space-y-2 rounded-lg border border-border bg-surface-2/50 p-3">
          <Textarea rows={2} maxLength={600} value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Co zmienić? Np. „krócej”, „mocniej o truskawkowych nogach”, „więcej emocji”. Puste = po prostu inny hook." className="text-sm" />
          <div className="flex gap-2">
            <Button onClick={async () => { setAsking(false); await rewriteCopy(item.id, ask); setAsk(""); onChanged(); }}>Napisz inną wersję</Button>
            <Button variant="ghost" onClick={() => setAsking(false)}>Anuluj</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, count, over, text, children }: { label: string; count: string; over: boolean; text: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span className={cx("text-[11px] tabular-nums", over ? "text-danger" : "text-faint")} title={over ? "Na telefonie reszta się utnie" : undefined}>{count}</span>
        <span className="ml-auto"><CopyButton text={text} label="Kopiuj" /></span>
      </div>
      {children}
    </div>
  );
}

function CopyButton({ text, label, primary }: { text: string; label: string; primary?: boolean }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); }}
      className={primary ? "inline-flex h-9 items-center rounded-lg bg-accent px-3.5 text-sm font-medium text-on-accent hover:bg-[#e4e4e4]" : "text-xs font-medium text-muted hover:text-text"}
    >
      {ok ? "Skopiowano ✓" : label}
    </button>
  );
}
