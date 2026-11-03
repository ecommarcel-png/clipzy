"use client";

import { useState } from "react";
import { Button, Input, Label, Notice, Select, Spinner, Textarea, cx } from "@/components/ui";
import { AD_ICONS, type AdStyle, type Fields } from "@/lib/image-ads/templates";
import { saveImageAdEditsAction } from "../actions";
import type { StudioAd } from "./studio";

// Quick edit without AI: texts, look and copy — saved and redrawn on the server (free).

const LABEL: Record<string, string> = {
  eyebrow: "Nadtytuł", headline: "Nagłówek", subheadline: "Podtytuł", benefits: "Korzyści", cta: "Przycisk", badge: "Plakietka", trust: "Pasek zaufania",
  before_label: "Etykieta „przed”", after_label: "Etykieta „po”", callouts: "Podpisy cech", ours_label: "Nasza kolumna", theirs_label: "Kolumna „inni”", rows: "Wiersze",
  notes: "Karteczki", lines: "Linie na tablicy", banner: "Czerwony pasek", sub_banner: "Pod paskiem", note: "Notatka", caption: "Podpis", items: "Lista",
  question: "Pytanie", solution: "Rozwiązanie", offer: "Oferta", old_price: "Stara cena", new_price: "Nowa cena", perks: "Korzyści oferty", urgency: "Pilność",
  quote: "Cytat", author: "Autor", rating_note: "Ocena", problem_label: "Etykieta problemu", problem: "Problem", solution_label: "Etykieta rozwiązania", sub: "Pod pytaniem",
  icon: "Ikona", text: "Tekst", ours: "U nas", theirs: "U innych",
};

type Val = string | string[] | Array<Record<string, string>>;

function FieldInput({ name, value, onChange }: { name: string; value: Val; onChange: (v: Val) => void }) {
  const label = LABEL[name] ?? name;
  if (typeof value === "string") {
    return (
      <div>
        <Label htmlFor={`f-${name}`}>{label}</Label>
        {value.length > 60 ? <Textarea id={`f-${name}`} rows={3} value={value} onChange={(e) => onChange(e.target.value)} /> : <Input id={`f-${name}`} value={value} onChange={(e) => onChange(e.target.value)} />}
      </div>
    );
  }
  const list = value as Array<string | Record<string, string>>;
  return (
    <div className="space-y-2">
      <span className="block text-sm font-bold">{label}</span>
      {list.map((item, i) => (
        <div key={i} className="flex gap-2">
          {typeof item === "string" ? (
            <Input aria-label={`${label} ${i + 1}`} value={item} onChange={(e) => onChange(list.map((x, j) => (j === i ? e.target.value : x)) as Val)} />
          ) : (
            Object.entries(item).map(([k, v]) =>
              k === "icon" ? (
                <Select key={k} aria-label="Ikona" value={v} onChange={(e) => onChange(list.map((x, j) => (j === i ? { ...(x as Record<string, string>), icon: e.target.value } : x)) as Val)} className="w-32 shrink-0">
                  {AD_ICONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
                </Select>
              ) : (
                <Input key={k} aria-label={`${LABEL[k] ?? k} ${i + 1}`} placeholder={LABEL[k] ?? k} value={v} onChange={(e) => onChange(list.map((x, j) => (j === i ? { ...(x as Record<string, string>), [k]: e.target.value } : x)) as Val)} />
              ),
            )
          )}
        </div>
      ))}
    </div>
  );
}

export function EditPanel({ setId, ad, palette, onClose, onSaved }: { setId: string; ad: StudioAd; palette: string[]; onClose: () => void; onSaved: () => void }) {
  const [fields, setFields] = useState<Record<string, Val>>(ad.fields as unknown as Record<string, Val>);
  const [style, setStyle] = useState<AdStyle>(ad.style!);
  const [copy, setCopy] = useState(ad.copy ?? { primary_text: "", headline: "", description: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const colors = [...new Set([...palette, style.accent.toLowerCase()])];

  async function save() {
    setBusy(true);
    setErr(null);
    const r = await saveImageAdEditsAction(setId, ad.id, { fields: fields as unknown as Fields, style, copy });
    setBusy(false);
    if (!r.ok) return setErr(r.error ?? "Nie udało się zapisać.");
    onSaved();
  }

  const chip = (on: boolean) => cx("rounded-full border px-3 py-1.5 text-sm font-semibold transition", on ? "border-accent bg-accent/15 text-text" : "border-border text-muted hover:text-text");

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-8" role="dialog" aria-modal="true" aria-label={`Edycja kreacji #${ad.idx + 1}`}>
      <div className="w-full max-w-5xl rounded-3xl border border-border bg-surface p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">Edycja kreacji #{ad.idx + 1} <span className="text-sm font-semibold text-muted">— {ad.label}</span></h2>
          <button type="button" onClick={onClose} className="text-sm font-bold text-muted hover:text-text">Zamknij</button>
        </div>
        <div className="grid gap-6 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="space-y-3">
            {ad.urls["1x1"] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ad.urls["1x1"]} alt="" className="w-full rounded-xl" />
            ) : null}
            <p className="text-xs text-muted">Bez AI i bez kosztów: po zapisaniu grafika (1:1 i 9:16) przerysuje się od razu, a plik w „Twoich plikach” się zaktualizuje.</p>
          </div>
          <div className="space-y-5">
            <section className="space-y-3">
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-faint">Teksty na grafice</h3>
              {Object.entries(fields).map(([k, v]) => <FieldInput key={k} name={k} value={v} onChange={(nv) => setFields({ ...fields, [k]: nv })} />)}
            </section>
            <section className="space-y-3">
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-faint">Wygląd</h3>
              <div className="flex flex-wrap gap-1.5">
                {(["light", "dark", "brand"] as const).map((t) => <button key={t} type="button" className={chip(style.theme === t)} onClick={() => setStyle({ ...style, theme: t })}>{t === "light" ? "Jasny" : t === "dark" ? "Ciemny" : "Kolor marki"}</button>)}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(["anton", "inter", "bricolage"] as const).map((f) => <button key={f} type="button" className={chip(style.font === f)} onClick={() => setStyle({ ...style, font: f })}>{f === "anton" ? "WĄSKI CAPS" : f === "inter" ? "Nowoczesny" : "Miękki"}</button>)}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {colors.map((c) => <button key={c} type="button" aria-label={`Akcent ${c}`} onClick={() => setStyle({ ...style, accent: c })} className={cx("h-8 w-8 rounded-full border-2", style.accent.toLowerCase() === c ? "border-text" : "border-transparent")} style={{ background: c }} />)}
                <label className="flex items-center gap-2 text-sm text-muted">Inny <input type="color" value={style.accent} onChange={(e) => setStyle({ ...style, accent: e.target.value })} className="h-8 w-10 cursor-pointer rounded" /></label>
              </div>
              <div>
                <Label htmlFor="hl">Wyróżnione słowa (po przecinku)</Label>
                <Input id="hl" value={style.highlight.join(", ")} onChange={(e) => setStyle({ ...style, highlight: e.target.value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 4) })} />
              </div>
              <div>
                <Label htmlFor="focus">Kadr zdjęcia</Label>
                <Select id="focus" value={style.focus} onChange={(e) => setStyle({ ...style, focus: e.target.value as AdStyle["focus"] })}>
                  <option value="center">Środek</option><option value="top">Góra</option><option value="bottom">Dół</option><option value="left">Lewo</option><option value="right">Prawo</option>
                </Select>
              </div>
            </section>
            <section className="space-y-3">
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-faint">Copy reklamy</h3>
              <div><Label htmlFor="pt">Tekst główny</Label><Textarea id="pt" rows={8} value={copy.primary_text} onChange={(e) => setCopy({ ...copy, primary_text: e.target.value })} /></div>
              <div><Label htmlFor="hd" hint="max 40 znaków">Nagłówek</Label><Input id="hd" maxLength={40} value={copy.headline} onChange={(e) => setCopy({ ...copy, headline: e.target.value })} /></div>
              <div><Label htmlFor="ds" hint="max 30 znaków">Opis</Label><Input id="ds" maxLength={30} value={copy.description} onChange={(e) => setCopy({ ...copy, description: e.target.value })} /></div>
            </section>
            {err ? <Notice tone="danger">{err}</Notice> : null}
            <div className="flex gap-3">
              <Button onClick={() => void save()} disabled={busy}>{busy ? <><Spinner /> Rysuję…</> : "Zapisz i przerysuj"}</Button>
              <Button variant="secondary" onClick={onClose} disabled={busy}>Anuluj</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
