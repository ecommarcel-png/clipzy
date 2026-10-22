"use client";

import { useActionState, useState } from "react";
import type { ProviderInfo } from "@/lib/providers";
import { Badge, Button, Card, Input, Notice, Spinner } from "@/components/ui";
import { deleteApiKey, retestApiKey, saveApiKey, type KeyFormState } from "./actions";

export type KeyRow = {
  provider: string;
  last4: string;
  status: "untested" | "ok" | "invalid" | "error";
  status_note: string | null;
  tested_at: string | null;
};

const STATUS = {
  ok: { tone: "ok", label: "Działa" },
  invalid: { tone: "danger", label: "Nieprawidłowy" },
  error: { tone: "warn", label: "Nie sprawdzono" },
  untested: { tone: "neutral", label: "Nie sprawdzono" },
} as const;

export function KeyCard({ info, row }: { info: ProviderInfo; row: KeyRow | null }) {
  const [state, formAction, pending] = useActionState(saveApiKey, {} as KeyFormState);
  const [editing, setEditing] = useState(!row);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{info.name}</h2>
          <p className="mt-1 text-sm text-muted">{info.role}</p>
          <p className="mt-1 text-xs text-muted">{info.requiredFor}</p>
        </div>
        {row ? <Badge tone={STATUS[row.status].tone}>{STATUS[row.status].label}</Badge> : <Badge>Brak klucza</Badge>}
      </div>

      {row && !editing ? (
        <div className="space-y-3">
          <div className="rounded-lg bg-surface-2 px-3 py-2 font-mono text-sm">•••• •••• {row.last4}</div>
          {row.status_note ? <p className="text-xs text-muted">{row.status_note}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" type="button" onClick={() => setEditing(true)}>Zmień klucz</Button>
            <form action={retestApiKey}>
              <input type="hidden" name="provider" value={info.id} />
              <Button variant="ghost">Sprawdź ponownie</Button>
            </form>
            <form action={deleteApiKey}>
              <input type="hidden" name="provider" value={info.id} />
              <Button variant="danger">Usuń</Button>
            </form>
          </div>
        </div>
      ) : (
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="provider" value={info.id} />
          <Input name="key" type="password" autoComplete="off" placeholder={info.placeholder} required />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner /> : null}
              Zapisz i sprawdź
            </Button>
            {row ? (
              <Button variant="ghost" type="button" onClick={() => setEditing(false)}>Anuluj</Button>
            ) : null}
            <a href={info.keyUrl} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline">
              Gdzie wziąć klucz? ↗
            </a>
          </div>
        </form>
      )}

      {state.ok ? <Notice tone="ok">{state.ok}</Notice> : null}
      {state.error ? <Notice tone="danger">{state.error}</Notice> : null}
    </Card>
  );
}
