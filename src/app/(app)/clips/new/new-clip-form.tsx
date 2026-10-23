"use client";

import { useActionState, useState } from "react";
import { createClipProject } from "../actions";
import { Button, Card, Disclosure, Input, Label, Notice, Select, Spinner, Textarea, cx } from "@/components/ui";
import { FORMAT_SIZE, FORMATS } from "@/lib/clips/plan";
import type { LibraryCard } from "@/lib/clips/library-view";
import { LibraryPicker } from "./library-picker";

type Brand = { id: string; name: string; products: Array<{ id: string; name: string }> };

export function NewClipForm({
  brands, music, saved, initial,
}: { brands: Brand[]; music: Array<{ file: string; name: string }>; saved: LibraryCard[]; initial?: { brandId?: string; productId?: string } }) {
  const [state, action, pending] = useActionState(createClipProject, {} as { error?: string });
  const [brandId, setBrandId] = useState(brands.find((b) => b.id === initial?.brandId)?.id ?? brands[0]?.id ?? "");
  const products = brands.find((b) => b.id === brandId)?.products ?? [];
  const [productId, setProductId] = useState(products.find((p) => p.id === initial?.productId)?.id ?? products[0]?.id ?? "");
  const [voiceover, setVoiceover] = useState(true);
  const brandItems = saved.filter((i) => i.brandId === brandId);
  const [chosen, setChosen] = useState(() => brandItems.filter((i) => i.productId === productId && productId).length);
  const pickBrand = (id: string) => {
    setBrandId(id);
    const first = brands.find((b) => b.id === id)?.products[0]?.id ?? "";
    setProductId(first);
    setChosen(saved.filter((i) => i.brandId === id && i.productId === first && first).length);
  };
  const pickProduct = (id: string) => {
    setProductId(id);
    setChosen(brandItems.filter((i) => i.productId === id && id).length);
  };

  return (
    <Card className="max-w-2xl">
      <form action={action} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="brandId">Marka</Label>
            <Select id="brandId" name="brandId" value={brandId} onChange={(e) => pickBrand(e.target.value)}>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="productId">Produkt</Label>
            <Select id="productId" name="productId" value={productId} onChange={(e) => pickProduct(e.target.value)}>
              {products.length ? products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>) : <option value="">— brak produktów —</option>}
            </Select>
          </div>
        </div>

        {brandItems.length ? <LibraryPicker key={`${brandId}:${productId}`} items={brandItems} productId={productId} onCount={setChosen} /> : null}

        <div>
          <span className="mb-1.5 block text-sm font-bold">Lektor</span>
          <input type="hidden" name="voiceover" value={voiceover ? "yes" : "no"} />
          <div className="grid grid-cols-2 gap-2">
            {[
              { v: true, t: "Z lektorem", d: "wgrasz plik WAV/MP3" },
              { v: false, t: "Bez lektora", d: "muzyka + plansze tekstowe" },
            ].map((o) => (
              <button
                key={String(o.v)}
                type="button"
                onClick={() => setVoiceover(o.v)}
                className={cx("rounded-2xl border p-4 text-left transition", voiceover === o.v ? "border-accent bg-accent-soft" : "border-border hover:border-border-strong")}
              >
                <div className="font-bold">{o.t}</div>
                <div className="text-xs text-muted">{o.d}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="music" hint={music.length ? undefined : "Biblioteka jest pusta — wrzuć utwory do public/biblioteka/muzyka."}>Muzyka</Label>
            <Select id="music" name="music" defaultValue="auto">
              <option value="auto">Reżyser dobierze</option>
              {music.map((m) => <option key={m.file} value={m.file}>{m.name}</option>)}
              <option value="none">Bez muzyki</option>
            </Select>
          </div>
          <div>
            <span className="mb-1.5 block text-sm font-bold">Formaty</span>
            <div className="flex flex-wrap gap-3 pt-1">
              {FORMATS.map((f) => (
                <label key={f} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="formats" value={f} defaultChecked={f === "4x5" || f === "9x16"} className="h-4 w-4 accent-[var(--accent)]" />
                  {FORMAT_SIZE[f].label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <Disclosure plain title="Nazwa i uwagi (opcjonalnie)">
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nazwa</Label>
              <Input id="name" name="name" placeholder="np. Depli — truskawkowe nogi" />
            </div>
            <div>
              <Label htmlFor="notes" hint="Np. promocja, której nie ma na stronie, albo kąt, który chcesz przetestować.">Uwagi dla Reżysera</Label>
              <Textarea id="notes" name="notes" rows={3} />
            </div>
          </div>
        </Disclosure>

        {state.error ? <Notice tone="danger">{state.error}</Notice> : null}
        <Button type="submit" disabled={pending || !brandId}>
          {pending ? <Spinner /> : null}
          {chosen ? `Dalej: ${voiceover ? "wgraj lektora" : "zrób sklejkę"}` : "Dalej: wgraj nagrania"}
        </Button>
      </form>
    </Card>
  );
}
