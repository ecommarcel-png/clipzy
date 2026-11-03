"use client";

import { useState } from "react";
import { Spinner, cx } from "@/components/ui";
import { renameFileAction } from "@/app/(app)/files/actions";
import { NAME_MAX } from "@/lib/files";

// A finished file's name with a pencil: Enter saves, Esc cancels. Same name in "Twoje pliki" and in the sklejka.
export function FileName({ id, name, className, onRenamed }: { id: string; name: string; className?: string; onRenamed?: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [shown, setShown] = useState(name);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    const next = value.replace(/\s+/g, " ").trim();
    if (!next || next === shown) {
      setValue(shown);
      setEditing(false);
      setErr(null);
      return;
    }
    setBusy(true);
    setErr(null);
    const r = await renameFileAction(id, next);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    setShown(next);
    setValue(next);
    setEditing(false);
    onRenamed?.(next);
  }

  if (editing) {
    return (
      <form
        className={cx("min-w-0 flex-1", className)}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <input
          autoFocus
          value={value}
          maxLength={NAME_MAX}
          disabled={busy}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => void save()}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setValue(shown);
              setEditing(false);
              setErr(null);
            }
          }}
          aria-label="Nazwa pliku"
          className="w-full rounded-lg border border-accent bg-bg/70 px-2 py-1 font-bold text-text outline-none"
        />
        <div className={cx("mt-1 truncate text-xs", err ? "text-danger" : "text-muted")}>{busy ? "Zapisuję…" : err ?? "Enter — zapisz, Esc — anuluj"}</div>
      </form>
    );
  }

  return (
    <div className={cx("group/name flex min-w-0 flex-1 items-center gap-1", className)}>
      <span className="truncate font-bold" title={shown}>{shown}</span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label="Zmień nazwę"
        title="Zmień nazwę"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-faint transition hover:bg-surface-2 hover:text-text sm:opacity-0 sm:group-hover/name:opacity-100 sm:focus-visible:opacity-100"
      >
        {busy ? <Spinner /> : (
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        )}
      </button>
    </div>
  );
}
