"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { type AdFile, filterFiles, formatRatio } from "@/lib/files";
import { Badge, Card, Input, Select, cx } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { FileName } from "@/components/file-name";
import { deleteFileAction } from "./actions";

const ASPECT: Record<string, string> = { "4x5": "aspect-[4/5]", "9x16": "aspect-[9/16]", "1x1": "aspect-square" };

export function FilesGrid({ files }: { files: AdFile[] }) {
  const [brandId, setBrandId] = useState("");
  const [format, setFormat] = useState("");
  const [q, setQ] = useState("");

  const brands = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of files) if (f.brandId && f.brandName) m.set(f.brandId, f.brandName);
    return [...m].sort((a, b) => a[1].localeCompare(b[1], "pl"));
  }, [files]);
  const formats = useMemo(() => [...new Set(files.map((f) => f.format).filter((x): x is string => Boolean(x)))], [files]);
  const shown = filterFiles(files, { brandId: brandId || undefined, format: format || undefined, q });

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj po nazwie…" aria-label="Szukaj po nazwie" className="w-full sm:w-64" />
        {brands.length > 1 ? (
          <Select value={brandId} onChange={(e) => setBrandId(e.target.value)} aria-label="Marka" className="w-full sm:w-auto">
            <option value="">Wszystkie marki</option>
            {brands.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </Select>
        ) : null}
        {formats.length > 1 ? (
          <div className="flex gap-1.5" role="group" aria-label="Format">
            {["", ...formats].map((f) => (
              <button
                key={f || "all"}
                type="button"
                onClick={() => setFormat(f)}
                aria-pressed={format === f}
                className={cx("rounded-full border px-3 py-1.5 text-sm font-semibold transition", format === f ? "border-accent bg-accent/15 text-text" : "border-border text-muted hover:text-text")}
              >
                {f ? formatRatio(f) : "Wszystkie"}
              </button>
            ))}
          </div>
        ) : null}
        <span className="ml-auto text-xs text-faint">{shown.length} z {files.length}</span>
      </div>

      {shown.length ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((f) => <FileCard key={f.id} file={f} />)}
        </ul>
      ) : (
        <Card className="py-10 text-center text-sm text-muted">Brak plików dla tych filtrów.</Card>
      )}
    </>
  );
}

function FileCard({ file: f }: { file: AdFile }) {
  const date = new Date(f.createdAt).toLocaleString("pl-PL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" });
  return (
    <li>
      <Card className="flex h-full flex-col gap-3 p-3">
        <div className="flex h-72 items-center justify-center overflow-hidden rounded-xl bg-[#0d0b10]">
          {f.url ? (
            <video
              src={`${f.url}#t=0.1`}
              preload="metadata"
              controls
              playsInline
              className={cx("h-full max-w-full object-contain", f.format ? ASPECT[f.format] : null)}
            />
          ) : (
            <span className="text-xs text-faint">Brak podglądu</span>
          )}
        </div>
        <FileName id={f.id} name={f.name} className="flex-none" />
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
          {[f.brandName, f.productName].filter(Boolean).join(" — ") || "Bez marki"}
          <span className="text-faint">· {date}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {f.format ? <Badge tone="neutral">{formatRatio(f.format)}</Badge> : null}
          {f.variant ? <Badge tone="neutral">Hook {f.variant}</Badge> : null}
          {f.review ? <Badge tone={f.review.score >= 8 ? "ok" : "warn"} dot>Kontroler {f.review.score}/10</Badge> : null}
        </div>
        <div className="mt-auto flex items-center gap-3 border-t border-border pt-3 text-sm">
          {f.downloadUrl ? <a href={f.downloadUrl} download className="font-bold text-accent hover:text-accent-strong">Pobierz</a> : null}
          {f.projectId ? <Link href={`/clips/${f.projectId}`} className="font-semibold text-muted hover:text-text">Otwórz sklejkę</Link> : <span className="text-xs text-faint">Sklejka usunięta</span>}
          <form action={deleteFileAction} className="ml-auto">
            <input type="hidden" name="fileId" value={f.id} />
            <ConfirmButton subtle message={`Usunąć „${f.name}” na zawsze? Zniknie też ze sklejki.`}>Usuń</ConfirmButton>
          </form>
        </div>
      </Card>
    </li>
  );
}
