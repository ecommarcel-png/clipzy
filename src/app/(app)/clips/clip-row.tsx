"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Badge, Card, Spinner, cx } from "@/components/ui";
import { renameClipProject } from "./actions";

type Tone = "neutral" | "ok" | "warn" | "danger" | "accent";

// One sklejka on the list: click opens it, the pencil renames it in place.
export function ClipRow({ id, name, meta, status }: { id: string; name: string; meta: string; status: { label: string; tone: Tone } }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [shown, setShown] = useState(name);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement | null>(null);

  async function save() {
    const next = value.trim();
    if (!next || next === shown) {
      setValue(shown);
      setEditing(false);
      return;
    }
    setBusy(true);
    setErr(null);
    const r = await renameClipProject(id, next);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    setShown(next);
    setEditing(false);
  }

  return (
    <Card className="group flex items-center gap-3 py-4 transition hover:border-border-strong">
      {editing ? (
        <form
          className="min-w-0 flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <input
            ref={input}
            autoFocus
            value={value}
            maxLength={80}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => void save()}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setValue(shown);
                setEditing(false);
              }
            }}
            aria-label="Nazwa sklejki"
            className="w-full rounded-lg border border-accent bg-bg/70 px-2 py-1 font-extrabold text-text outline-none"
          />
          <div className="mt-1 truncate text-xs text-muted">{err ?? "Enter — zapisz, Esc — anuluj"}</div>
        </form>
      ) : (
        <Link href={`/clips/${id}`} className="min-w-0 flex-1 rounded-lg focus-visible:outline-2 focus-visible:outline-accent">
          <div className="truncate font-extrabold">{shown}</div>
          <div className="truncate text-xs text-muted">{meta}</div>
        </Link>
      )}
      {!editing ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Zmień nazwę"
          title="Zmień nazwę"
          className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-faint transition hover:bg-surface-2 hover:text-text", "sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100")}
        >
          {busy ? <Spinner /> : (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          )}
        </button>
      ) : null}
      <Badge tone={status.tone} dot>{status.label}</Badge>
    </Card>
  );
}
