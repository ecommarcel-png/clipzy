"use client";

import Link from "next/link";
import { useState } from "react";
import { cx } from "@/components/ui";
import { MAX_PICKS, MAX_SKLEJKI, type Focus } from "@/lib/clips/focus";

export type ProductFocusOptions = { id: string; problems: string[]; angles: Array<{ angle: string; hook: string }> };

// How many sklejki, and what each one is about: problems and angles from the product profile.
// Picks travel as hidden inputs (count, focus_<i>_problems, focus_<i>_angles).
export function FocusPicker({ brandId, product, onCount }: { brandId: string; product: ProductFocusOptions | null; onCount: (n: number) => void }) {
  const [count, setCount] = useState(1);
  const [picks, setPicks] = useState<Focus[]>(() => Array.from({ length: MAX_SKLEJKI }, () => ({ problems: [], angles: [] })));
  const [open, setOpen] = useState(0);
  const hasOptions = Boolean(product && (product.problems.length || product.angles.length));

  const toggle = (i: number, key: keyof Focus, value: string) =>
    setPicks((all) =>
      all.map((f, k) => {
        if (k !== i) return f;
        const list = f[key].includes(value) ? f[key].filter((v) => v !== value) : f[key].length < MAX_PICKS ? [...f[key], value] : f[key];
        return { ...f, [key]: list };
      }),
    );
  // the same angle in two sklejki of one series is allowed, but shown so it is a choice
  const takenElsewhere = (i: number, angle: string) => picks.some((f, k) => k !== i && k < count && f.angles.includes(angle));

  return (
    <div>
      <input type="hidden" name="count" value={count} />
      <span className="mb-1.5 block text-sm font-bold">Ile sklejek</span>
      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-bg p-1" role="radiogroup" aria-label="Ile sklejek">
        {Array.from({ length: MAX_SKLEJKI }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={count === n}
            onClick={() => {
              setCount(n);
              onCount(n);
              if (open >= n) setOpen(0);
            }}
            className={cx("h-8 min-w-10 flex-1 rounded-md px-3 text-sm font-medium transition-colors", count === n ? "bg-surface-3 text-text" : "text-muted hover:text-text")}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-faint">
        Każda sklejka to osobna reklama z 5 wersjami hooka. Nagrania wgrywasz raz — trafią do wszystkich sklejek z tej serii.
      </p>

      {!hasOptions ? (
        <p className="mt-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-xs text-muted">
          Profil tego produktu nie ma jeszcze listy problemów i kątów, więc Reżyser dobierze je sam.{" "}
          {product ? <Link href={`/brands/${brandId}/products/${product.id}`} className="font-medium text-text underline-offset-4 hover:underline">Uzupełnij profil produktu</Link> : null}
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {Array.from({ length: count }, (_, i) => {
            const f = picks[i];
            const chosen = f.problems.length + f.angles.length;
            return (
              <div key={i} className="rounded-xl border border-border bg-bg/40">
                <button type="button" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i} className="flex w-full items-center gap-3 px-3.5 py-3 text-left">
                  <span className="text-sm font-semibold">{count > 1 ? `Sklejka ${i + 1}` : "O czym ma być sklejka"}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted">
                    {chosen ? [...f.angles, ...f.problems].join(" · ") : count > 1 ? "Reżyser dobierze inny kąt niż w pozostałych" : "Reżyser dobierze"}
                  </span>
                  <svg viewBox="0 0 16 16" className={cx("h-3.5 w-3.5 shrink-0 text-faint transition", open === i && "rotate-180")} aria-hidden>
                    <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {f.problems.map((v) => <input key={`p${v}`} type="hidden" name={`focus_${i}_problems`} value={v} />)}
                {f.angles.map((v) => <input key={`a${v}`} type="hidden" name={`focus_${i}_angles`} value={v} />)}
                {open === i ? (
                  <div className="space-y-4 border-t border-border px-3.5 pb-4 pt-3">
                    {product!.problems.length ? (
                      <ChipGroup
                        title="Problemy"
                        hint={`do ${MAX_PICKS}`}
                        items={product!.problems.map((p) => ({ value: p, label: p }))}
                        selected={f.problems}
                        onToggle={(v) => toggle(i, "problems", v)}
                      />
                    ) : null}
                    {product!.angles.length ? (
                      <ChipGroup
                        title="Kąty marketingowe"
                        hint={`do ${MAX_PICKS}`}
                        items={product!.angles.map((a) => ({ value: a.angle, label: a.angle, sub: a.hook, mark: takenElsewhere(i, a.angle) ? "w innej sklejce" : undefined }))}
                        selected={f.angles}
                        onToggle={(v) => toggle(i, "angles", v)}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChipGroup({
  title, hint, items, selected, onToggle,
}: {
  title: string; hint: string; items: Array<{ value: string; label: string; sub?: string; mark?: string }>; selected: string[]; onToggle: (v: string) => void;
}) {
  const full = selected.length >= MAX_PICKS;
  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-xs font-medium text-muted">{title}</span>
        <span className="text-[11px] text-faint">{hint}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => {
          const on = selected.includes(it.value);
          return (
            <button
              key={it.value}
              type="button"
              aria-pressed={on}
              disabled={!on && full}
              onClick={() => onToggle(it.value)}
              title={it.sub || it.label}
              className={cx(
                "max-w-full rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                on ? "border-white/30 bg-accent-soft text-text" : "border-border text-muted hover:border-border-strong hover:text-text",
              )}
            >
              <span className="line-clamp-2">{on ? "✓ " : ""}{it.label}</span>
              {it.mark ? <span className="mt-0.5 block text-[10px] text-faint">{it.mark}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
