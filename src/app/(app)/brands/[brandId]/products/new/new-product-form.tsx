"use client";

import { useActionState } from "react";
import { createProduct, type NewProductState } from "../actions";
import { Button, Card, Disclosure, Input, Label, Notice, Spinner, Textarea } from "@/components/ui";

export function NewProductForm({ brandId }: { brandId: string }) {
  const [state, formAction, pending] = useActionState(createProduct.bind(null, brandId), {} as NewProductState);

  return (
    <Card className="max-w-2xl">
      <form action={formAction} className="space-y-5">
        <div>
          <Label htmlFor="url">Link do produktu</Label>
          <Input id="url" name="url" placeholder="https://twojsklep.pl/products/…" inputMode="url" autoFocus />
        </div>

        <Disclosure plain title="Nazwa i notatki (opcjonalnie)">
          <div className="space-y-4">
            <div>
              <Label htmlFor="name" hint="Puste = nazwa ze strony.">Nazwa produktu</Label>
              <Input id="name" name="name" />
            </div>
            <div>
              <Label htmlFor="notes" hint="To, czego nie ma na stronie: jak naprawdę działa, co mówią klienci.">Co jeszcze powinien wiedzieć Claude?</Label>
              <Textarea id="notes" name="notes" rows={3} />
            </div>
          </div>
        </Disclosure>

        {state.error ? <Notice tone="danger">{state.error}</Notice> : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? <Spinner /> : null}
            {pending ? "Analizuję produkt…" : "Przeanalizuj produkt"}
          </Button>
          {pending ? <span className="text-xs text-muted">Zwykle 1–3 minuty.</span> : null}
        </div>
      </form>
    </Card>
  );
}
