"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { Button, Notice, Spinner } from "@/components/ui";

const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml", "image/avif"];
const MAX_BYTES = 50 * 1024 * 1024;

// Uploads straight from the browser to the private storage bucket (into the
// user's own folder — storage policies enforce that), then tells the server.
export function ImageUpload({
  folder,
  multiple = false,
  label,
  onUploaded,
}: {
  folder: string;
  multiple?: boolean;
  label: string;
  onUploaded: (paths: string[]) => Promise<{ ok: boolean; error?: string; message?: string }>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const paths: string[] = [];
    for (const file of Array.from(files)) {
      if (!ALLOWED.includes(file.type)) {
        setError(`${file.name}: nieobsługiwany format.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        setError(`${file.name}: plik większy niż 50 MB.`);
        continue;
      }
      const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${folder}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("media").upload(path, file, { contentType: file.type });
      if (upErr) setError(`${file.name}: ${upErr.message}`);
      else paths.push(path);
    }
    if (paths.length) {
      const res = await onUploaded(paths);
      if (!res.ok) setError(res.error ?? "Nie udało się zapisać pliku.");
    }
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  return (
    <div className="space-y-2">
      <input ref={input} type="file" accept={ALLOWED.join(",")} multiple={multiple} className="hidden" onChange={(e) => handle(e.target.files)} />
      <Button variant="secondary" type="button" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? <Spinner /> : null}
        {busy ? "Wgrywam…" : label}
      </Button>
      {error ? <Notice tone="danger">{error}</Notice> : null}
    </div>
  );
}
