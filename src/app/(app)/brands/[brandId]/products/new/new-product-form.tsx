"use client";

import { useActionState } from "react";
import { createProduct, type NewProductState } from "../actions";
import { Button, Card, Input, Label, Notice, Spinner, Textarea } from "@/components/ui";

export function NewProductForm({ brandId }: { brandId: string }) {
  const [state, formAction, pending] = useActionState(createProduct.bind(null, brandId), {} as NewProductState);

  return (
    <Card className="max-w-2xl">
      <form action={formAction} className="space-y-5">
        <div>
          <Label htmlFor="url" hint="Najlepiej link do karty produktu w sklepie (Shopify działa najlepiej).">Link do produktu</Label>
          <Input id="url" name="url" placeholder="https://" inputMode="url" />
        </div>
        <div>
          <Label htmlFor="name" hint="Opcjonalnie — jeśli puste, Clipzy weźmie nazwę ze strony.">Nazwa produktu</Label>
          <Input id="name" name="name" />
        </div>
        <div>
          <Label htmlFor="notes" hint="Opcjonalnie: czego nie ma na stronie — jak naprawdę działa, co mówią klienci, czego unikać.">
            Co jeszcze powinien wiedzieć Claude?
          </Label>
          <Textarea id="notes" name="notes" rows={4} />
        </div>
        <p className="text-xs text-muted">Kolejne zdjęcia (także własne) dodasz na następnym ekranie.</p>

        {state.error ? <Notice tone="danger">{state.error}</Notice> : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? <Spinner /> : null}
            {pending ? "Analizuję produkt…" : "Przeanalizuj produkt"}
          </Button>
          {pending ? <span className="text-xs text-muted">To zwykle trwa 30–90 sekund.</span> : null}
        </div>
      </form>
    </Card>
  );
}
