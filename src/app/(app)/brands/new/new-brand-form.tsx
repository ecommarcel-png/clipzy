"use client";

import { useActionState } from "react";
import { createBrand, type NewBrandState } from "../actions";
import { Button, Card, Input, Label, Notice, Spinner, Textarea } from "@/components/ui";

export function NewBrandForm() {
  const [state, formAction, pending] = useActionState(createBrand, {} as NewBrandState);

  return (
    <Card className="max-w-2xl">
      <form action={formAction} className="space-y-5">
        <div>
          <Label htmlFor="url" hint="Strona główna sklepu, np. twojsklep.pl">Adres sklepu</Label>
          <Input id="url" name="url" placeholder="https://" inputMode="url" />
        </div>
        <div>
          <Label htmlFor="name" hint="Opcjonalnie — jeśli puste, Clipzy weźmie nazwę ze strony.">Nazwa marki</Label>
          <Input id="name" name="name" />
        </div>
        <div>
          <Label htmlFor="notes" hint="Opcjonalnie: wszystko, czego nie ma na stronie — dla kogo jest marka, jaki ma ton, czego unikać.">
            Co jeszcze powinien wiedzieć Claude?
          </Label>
          <Textarea id="notes" name="notes" rows={4} />
        </div>

        {state.error ? <Notice tone="danger">{state.error}</Notice> : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? <Spinner /> : null}
            {pending ? "Czytam stronę i buduję profil…" : "Przeanalizuj markę"}
          </Button>
          {pending ? <span className="text-xs text-muted">Analiza i kontrola jakości trwają zwykle 1–3 minuty.</span> : null}
        </div>
      </form>
    </Card>
  );
}
