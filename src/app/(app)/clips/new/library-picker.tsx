"use client";

import { useState } from "react";
import { LibraryTile } from "@/components/library-tile";
import { cx } from "@/components/ui";
import type { LibraryCard } from "@/lib/clips/library-view";

// Saved materials for the chosen product, all pre-selected: a new voiceover is
// usually the only thing a second sklejka needs.
const SEEDANCE_PER_S = 0.46; // fal, 720p pionowo

export function LibraryPicker({ items, productId, onCount }: { items: LibraryCard[]; productId: string; onCount: (n: number) => void }) {
  const mine = items.filter((i) => i.productId === productId && productId);
  const others = items.filter((i) => !(i.productId === productId && productId));
  const [selected, setSelected] = useState<Set<string>>(() => new Set(mine.map((i) => i.id)));
  const [showOthers, setShowOthers] = useState(mine.length === 0);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    onCount(next.size);
  };
  const setAll = (list: LibraryCard[], on: boolean) => {
    const next = new Set(selected);
    for (const i of list) {
      if (on) next.add(i.id);
      else next.delete(i.id);
    }
    setSelected(next);
    onCount(next.size);
  };

  if (!items.length) return null;
  const ai = items.filter((i) => i.kind === "generated" && selected.has(i.id));
  const saved = ai.reduce((s, i) => s + i.duration, 0) * SEEDANCE_PER_S;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <span className="block text-sm font-bold">Zapisane materiały</span>
          <span className="block text-xs text-faint">
            Zaznaczone wejdą do sklejki od razu — bez ponownej analizy i generowania. Nowe nagrania dodasz na następnym ekranie.
          </span>
        </div>
        {selected.size ? (
          <span className="rounded-full bg-ok-soft px-2.5 py-1 text-xs font-bold text-ok">
            {selected.size} wybrane{ai.length ? ` · ${ai.length} AI (~$${saved.toFixed(0)} mniej)` : ""}
          </span>
        ) : null}
      </div>
      {[...selected].map((id) => <input key={id} type="hidden" name="library" value={id} />)}

      {mine.length ? (
        <Group title={`Ten produkt (${mine.length})`} list={mine} selected={selected} toggle={toggle} setAll={setAll} />
      ) : (
        <p className="mt-3 text-xs text-muted">Ten produkt nie ma jeszcze zapisanych materiałów — pojawią się tu po pierwszej sklejce.</p>
      )}

      {others.length ? (
        <div className="mt-3">
          <button type="button" onClick={() => setShowOthers((v) => !v)} className="text-xs font-bold text-muted hover:text-text">
            {showOthers ? "Ukryj" : "Pokaż"} inne materiały marki ({others.length})
          </button>
          {showOthers ? <Group title="Inne produkty marki" list={others} selected={selected} toggle={toggle} setAll={setAll} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function Group({
  title, list, selected, toggle, setAll,
}: { title: string; list: LibraryCard[]; selected: Set<string>; toggle: (id: string) => void; setAll: (l: LibraryCard[], on: boolean) => void }) {
  const all = list.every((i) => selected.has(i.id));
  return (
    <div className="mt-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-bold text-muted">{title}</span>
        <button type="button" onClick={() => setAll(list, !all)} className="font-bold text-accent hover:text-accent-strong">
          {all ? "Odznacz wszystkie" : "Zaznacz wszystkie"}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {list.map((i) => {
          const on = selected.has(i.id);
          return (
            <button key={i.id} type="button" onClick={() => toggle(i.id)} aria-pressed={on} title={i.summary || i.name} className="text-left">
              <LibraryTile name={i.name} posterUrl={i.posterUrl} kind={i.kind} duration={i.duration} selected={on} dim={!on}>
                <span
                  className={cx(
                    "absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 text-[11px] font-black",
                    on ? "border-accent bg-accent text-on-accent" : "border-white/70 bg-black/40 text-transparent",
                  )}
                  aria-hidden
                >
                  ✓
                </span>
              </LibraryTile>
            </button>
          );
        })}
      </div>
    </div>
  );
}
