"use client";

import { useActionState, useState } from "react";
import { createImageAdSet } from "../actions";
import { Button, Card, Label, Notice, Select, Spinner, Textarea } from "@/components/ui";

type Brand = { id: string; name: string; products: Array<{ id: string; name: string }> };

const TEAM = [
  ["Strateg", "dobiera formaty i kąty — przed/po, gdy produkt ma efekt"],
  ["Copywriter", "teksty na grafikę + tekst główny, nagłówek i opis"],
  ["Fotograf", "zamawia zdjęcia z produktem w fal.ai"],
  ["Grafik", "składa 1:1 i 9:16 w kolorach marki"],
  ["Kontroler", "ogląda każdą grafikę i wdraża poprawki"],
] as const;

export function NewImageAdsForm({ brands, initial }: { brands: Brand[]; initial?: { brandId?: string; productId?: string } }) {
  const [state, action, pending] = useActionState(createImageAdSet, {} as { error?: string });
  const [brandId, setBrandId] = useState(brands.find((b) => b.id === initial?.brandId)?.id ?? brands[0]?.id ?? "");
  const products = brands.find((b) => b.id === brandId)?.products ?? [];
  const [productId, setProductId] = useState(products.find((p) => p.id === initial?.productId)?.id ?? products[0]?.id ?? "");
  const [count, setCount] = useState(10);
  // ~1.3 AI photos per creative (before/after needs two) at ~0.12 $ + Claude
  const cost = (count * 1.3 * 0.12 + count * 0.06).toFixed(2);

  return (
    <Card className="max-w-2xl">
      <form action={action} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="brandId">Marka</Label>
            <Select id="brandId" name="brandId" value={brandId} onChange={(e) => { setBrandId(e.target.value); setProductId(brands.find((b) => b.id === e.target.value)?.products[0]?.id ?? ""); }}>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="productId">Produkt</Label>
            <Select id="productId" name="productId" value={productId} onChange={(e) => setProductId(e.target.value)}>
              {products.length ? products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>) : <option value="">— reklamy marki —</option>}
            </Select>
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <Label htmlFor="count">Ile kreacji</Label>
            <span className="text-2xl font-extrabold tabular-nums">{count}</span>
          </div>
          <input id="count" name="count" type="range" min={1} max={20} step={1} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
          <p className="mt-1 text-xs text-muted">
            Każda kreacja w 1:1 i 9:16 + copy (tekst główny, nagłówek, opis). Koszt w Twoich kluczach: ok. {cost} $ (fal.ai + Claude).
          </p>
        </div>

        <label className="flex items-start gap-3 rounded-2xl border border-border p-4">
          <input type="checkbox" name="beforeAfter" defaultChecked className="mt-1 h-4 w-4 accent-[var(--accent)]" />
          <span>
            <span className="block font-bold">Przed / po jako priorytet</span>
            <span className="text-sm text-muted">Ok. połowa kreacji to efekt przed i po, każda z innym problemem. Wyłącz, jeśli produkt nie daje widocznego efektu.</span>
          </span>
        </label>

        <div>
          <Label htmlFor="brief" hint="opcjonalnie">Wskazówki dla zespołu</Label>
          <Textarea id="brief" name="brief" rows={3} maxLength={1500} placeholder="Np. kluczowy problem to truskawkowe nogi; komunikat prosty: ogolone nogi w jeden wieczór; bez promocji." />
          <p className="mt-1 text-xs text-muted">Strateg, Copywriter, Fotograf, Grafik i Kontroler traktują to jako najważniejsze.</p>
        </div>

        <ul className="space-y-1.5 rounded-2xl border border-border bg-bg/40 p-4 text-sm">
          {TEAM.map(([who, what]) => (
            <li key={who}><span className="font-bold">{who}</span> <span className="text-muted">— {what}</span></li>
          ))}
        </ul>

        {state.error ? <Notice tone="danger">{state.error}</Notice> : null}
        <Button type="submit" disabled={pending || !brandId}>{pending ? <><Spinner /> Zaczynam…</> : `Generuj ${count} ${count === 1 ? "kreację" : count < 5 ? "kreacje" : "kreacji"}`}</Button>
      </form>
    </Card>
  );
}
