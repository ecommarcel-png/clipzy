"use client";

// Quick manual fixes under the preview — instant, no AI. The draft lives in the
// parent (Result) so the preview and the renderer always show what is edited here.
import { useState } from "react";
import { Button, Card, Chevron, Input, Notice, Select, Spinner, cx } from "@/components/ui";
import type { AssetInfo, EditPlan, Shot } from "@/lib/clips/plan";
import type { CaptionChunk } from "@/lib/clips/timeline";
import { finalize, nextFragment, removeShot, resizeShot, setMusic, setPackshot, swapSource, type Mix } from "@/lib/clips/edit";
import { library } from "@/lib/clips/library";

export type Draft = { plan: EditPlan; captions: string[]; mix: Mix; accent: string };

type Media = { id: string; name: string; kind: string; url: string | null; info: AssetInfo };

const fmt = (s: number) => `${s.toFixed(1).replace(".", ",")} s`;
const pct = (v: number) => `${Math.round(v * 100)}%`;

export function QuickEdit({
  draft,
  setDraft,
  dirty,
  captions,
  media,
  hasDirector,
  saving,
  message,
  onSave,
  onUndo,
  onRestore,
  onSeek,
  swatches,
  logoColors,
}: {
  swatches: string[];
  logoColors: string[];
  draft: Draft;
  setDraft: (d: Draft) => void;
  dirty: boolean;
  captions: CaptionChunk[];
  media: Media[];
  hasDirector: boolean;
  saving: boolean;
  message: { tone: "ok" | "danger"; text: string } | null;
  onSave: () => void;
  onUndo: () => void;
  onRestore: () => void;
  onSeek: (t: number) => void;
}) {
  const infos = media.map((m) => m.info);
  const plan = draft.plan;
  const setPlan = (p: EditPlan) => setDraft({ ...draft, plan: finalize(p, infos).plan });
  const nameOf = (id: string) => media.find((m) => m.id === id)?.name ?? "plik";
  const packshotIndex = plan.shots.findIndex((s) => s.type === "packshot");
  const packshot = packshotIndex >= 0 ? (plan.shots[packshotIndex] as Extract<Shot, { type: "packshot" }>) : null;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold">Szybkie poprawki</h2>
          <p className="text-xs text-faint">Działają od razu w podglądzie, bez AI. Długość reklamy zostaje ta sama — dyktuje ją lektor.</p>
        </div>
        {dirty ? <span className="rounded-full bg-warn-soft px-2.5 py-1 text-xs font-bold text-warn">Niezapisane zmiany</span> : null}
      </div>

      <div className="mt-4 space-y-3">
        <Section title="Kolor marki" defaultOpen>
          <p className="mt-1 text-xs text-faint">Wyróżnienia w napisach, przejścia, ikonki. Zapisze się w marce i zostanie w kolejnych sklejkach.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {swatches.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setDraft({ ...draft, accent: c })}
                aria-label={`Kolor ${c}`}
                aria-pressed={draft.accent === c}
                title={logoColors.includes(c) ? `${c} — z logo` : c}
                className={cx("relative h-9 w-9 rounded-full border-2 transition", draft.accent === c ? "border-text ring-2 ring-accent/60" : "border-border hover:border-border-strong")}
                style={{ backgroundColor: c }}
              >
                {logoColors.includes(c) ? <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-surface-3 px-1 text-[8px] font-extrabold uppercase text-text">logo</span> : null}
              </button>
            ))}
            <label className="flex h-9 cursor-pointer items-center gap-2 rounded-full border border-border px-3 text-xs font-bold text-muted hover:text-text">
              <input type="color" value={draft.accent} onChange={(e) => setDraft({ ...draft, accent: e.target.value.toLowerCase() })} className="h-5 w-5 cursor-pointer rounded-full border-0 bg-transparent p-0" />
              Inny
            </label>
          </div>
        </Section>

        <Section title="Głośność i muzyka" defaultOpen>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <Slider label="Lektor" value={draft.mix.vo} max={1} onChange={(vo) => setDraft({ ...draft, mix: { ...draft.mix, vo } })} />
            <Slider label="Muzyka" value={draft.mix.music} max={2} onChange={(music) => setDraft({ ...draft, mix: { ...draft.mix, music } })} />
            <Slider label="Efekty (SFX)" value={draft.mix.sfx} max={2} onChange={(sfx) => setDraft({ ...draft, mix: { ...draft.mix, sfx } })} />
          </div>
          <p className="mt-1 text-xs text-faint">100% = poziom ustawiony przez Reżysera.</p>
          <div className="mt-3 max-w-sm">
            <Select
              aria-label="Utwór"
              value={plan.music.file ?? ""}
              onChange={(e) => {
                const track = library.music.find((m) => m.file === e.target.value);
                setPlan(setMusic(plan, track?.file ?? null, track?.start ?? 0));
              }}
            >
              <option value="">Bez muzyki</option>
              {library.music.map((m) => (
                <option key={m.file} value={m.file}>{m.name}</option>
              ))}
            </Select>
          </div>
        </Section>

        <Section title={`Ujęcia (${plan.shots.length})`}>
          <ol className="mt-2 space-y-2">
            {plan.shots.map((s, i) => (
              <li key={i} className="rounded-2xl border border-border bg-bg/40 p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => onSeek(s.start)} className="flex min-w-[13rem] flex-1 items-center gap-2 text-left" title="Pokaż w podglądzie">
                    <Thumb media={media} shot={s} />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold">
                        {i + 1}. {s.type === "clip" ? "Ujęcie" : s.type === "split" ? "Przed / po" : "Packshot"}
                        <span className="ml-2 whitespace-nowrap font-normal text-faint">{fmt(s.start)}–{fmt(s.end)}</span>
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {s.type === "clip" ? nameOf(s.src.asset) : s.type === "split" ? `${nameOf(s.top.asset)} / ${nameOf(s.bottom.asset)}` : s.headline}
                      </span>
                    </span>
                  </button>
                  <div className="flex flex-wrap items-center gap-1">
                    <Mini onClick={() => setPlan(resizeShot(plan, i, -0.5))} title="Krócej o 0,5 s">−0,5 s</Mini>
                    <Mini onClick={() => setPlan(resizeShot(plan, i, 0.5))} title="Dłużej o 0,5 s">+0,5 s</Mini>
                    {s.type !== "packshot" ? (
                      <Mini onClick={() => setPlan(removeShot(plan, i))} disabled={plan.shots.length <= 3} title="Usuń — czas przejmie sąsiednie ujęcie" danger>
                        Usuń
                      </Mini>
                    ) : null}
                  </div>
                </div>
                {s.type === "clip" ? (
                  <SourceRow media={media} value={s.src.asset} onPick={(id) => setPlan(swapSource(plan, i, id, infos))} onNext={() => setPlan(nextFragment(plan, i, infos))} />
                ) : s.type === "split" ? (
                  <>
                    <SourceRow label="Góra" media={media} value={s.top.asset} onPick={(id) => setPlan(swapSource(plan, i, id, infos, "top"))} onNext={() => setPlan(nextFragment(plan, i, infos, "top"))} />
                    <SourceRow label="Dół" media={media} value={s.bottom.asset} onPick={(id) => setPlan(swapSource(plan, i, id, infos, "bottom"))} onNext={() => setPlan(nextFragment(plan, i, infos, "bottom"))} />
                  </>
                ) : null}
              </li>
            ))}
          </ol>
        </Section>

        {captions.length ? (
          <Section title={`Napisy (${captions.length})`}>
            <p className="mt-1 text-xs text-faint">Popraw literówki albo słowa źle usłyszane z lektora. Czas napisów zostaje.</p>
            <ol className="mt-2 space-y-1.5">
              {captions.map((c, i) => (
                <li key={i} className="flex items-center gap-2">
                  <button type="button" onClick={() => onSeek(c.start + 0.05)} className="w-14 shrink-0 text-right text-xs text-faint hover:text-text">{fmt(c.start)}</button>
                  <Input
                    value={draft.captions[i] ?? c.text}
                    maxLength={80}
                    onChange={(e) => setDraft({ ...draft, captions: draft.captions.map((t, k) => (k === i ? e.target.value : t)) })}
                    className="py-1.5"
                  />
                </li>
              ))}
            </ol>
          </Section>
        ) : plan.text_plates.length ? (
          <Section title={`Plansze tekstowe (${plan.text_plates.length})`}>
            <ol className="mt-2 space-y-1.5">
              {plan.text_plates.map((t, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-14 shrink-0 text-right text-xs text-faint">{fmt(t.start)}</span>
                  <Input
                    value={t.text}
                    maxLength={60}
                    onChange={(e) => setDraft({ ...draft, plan: { ...plan, text_plates: plan.text_plates.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)) } })}
                    className="py-1.5"
                  />
                </li>
              ))}
            </ol>
          </Section>
        ) : null}

        {packshot ? (
          <Section title="Packshot (koniec)">
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <Field label="Nagłówek" value={packshot.headline} max={40} onChange={(v) => setDraft({ ...draft, plan: setPackshot(plan, packshotIndex, { headline: v }) })} />
              <Field label="Przycisk (CTA)" value={packshot.cta} max={32} onChange={(v) => setDraft({ ...draft, plan: setPackshot(plan, packshotIndex, { cta: v }) })} />
              {[0, 1, 2].map((k) => (
                <Field
                  key={k}
                  label={`Korzyść ${k + 1}`}
                  value={packshot.chips[k] ?? ""}
                  max={28}
                  onChange={(v) => {
                    const chips = [0, 1, 2].map((j) => (j === k ? v : packshot.chips[j] ?? ""));
                    // keep empty slots while typing; empty chips are dropped when saving
                    const p = structuredClone(plan);
                    (p.shots[packshotIndex] as typeof packshot).chips = chips;
                    setDraft({ ...draft, plan: p });
                  }}
                />
              ))}
            </div>
          </Section>
        ) : null}
      </div>

      {message ? <div className="mt-4"><Notice tone={message.tone}>{message.text}</Notice></div> : null}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button onClick={onSave} disabled={!dirty || saving}>
          {saving ? <Spinner /> : null}
          {saving ? "Zapisuję…" : "Zapisz zmiany"}
        </Button>
        {dirty ? <Button variant="ghost" onClick={onUndo} disabled={saving}>Cofnij niezapisane</Button> : null}
        {hasDirector && !dirty ? (
          <Button variant="ghost" onClick={onRestore} disabled={saving}>Przywróć wersję Reżysera</Button>
        ) : null}
      </div>
    </Card>
  );
}

function Slider({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-sm"><span className="font-bold">{label}</span><span className="tabular-nums text-muted">{pct(value)}</span></span>
      <input type="range" min={0} max={max} step={0.05} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-[var(--color-accent)]" />
    </label>
  );
}

function Mini({ danger, className, ...props }: React.ComponentProps<"button"> & { danger?: boolean }) {
  return (
    <button
      type="button"
      className={cx(
        "rounded-full border border-border px-2.5 py-1 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40",
        danger ? "text-danger hover:bg-danger-soft" : "text-muted hover:bg-surface-2 hover:text-text",
        className,
      )}
      {...props}
    />
  );
}

function SourceRow({ label, media, value, onPick, onNext }: { label?: string; media: Media[]; value: string; onPick: (id: string) => void; onNext: () => void }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {label ? <span className="w-9 text-xs font-bold text-faint">{label}</span> : null}
      <Select aria-label="Plik ujęcia" value={value} onChange={(e) => onPick(e.target.value)} className="max-w-[260px] flex-1 py-1.5 text-xs">
        {media.map((m) => (
          <option key={m.id} value={m.id}>{m.kind === "generated" ? "AI: " : ""}{m.name}</option>
        ))}
      </Select>
      <Mini onClick={onNext} title="Inny moment z tego samego pliku">Inny fragment</Mini>
    </div>
  );
}

function Field({ label, value, max, onChange }: { label: string; value: string; max: number; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-muted">{label}</span>
      <Input value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} className="py-1.5" />
    </label>
  );
}

function Thumb({ media, shot }: { media: Media[]; shot: Shot }) {
  const src = shot.type === "clip" ? shot.src : shot.type === "split" ? shot.top : null;
  const m = src ? media.find((x) => x.id === src.asset) : null;
  if (!src || !m?.url) return <span className="h-12 w-9 shrink-0 rounded-lg bg-surface-3" aria-hidden />;
  return <video src={`${m.url}#t=${(src.from + 0.05).toFixed(2)}`} muted playsInline preload="metadata" className="h-12 w-9 shrink-0 rounded-lg bg-surface-3 object-cover" aria-hidden />;
}

// Content mounts only when opened — the shot list holds video thumbnails.
function Section({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  return (
    <div className="border-t border-border pt-3 first:border-t-0 first:pt-0">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 py-1 text-left text-sm font-semibold text-muted hover:text-text">
        <span className="flex-1">{title}</span>
        <Chevron className={cx("transition", open && "rotate-180")} />
      </button>
      {open ? children : null}
    </div>
  );
}
