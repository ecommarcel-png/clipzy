"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { Badge, Button, Card, Notice, Spinner, cx } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { prepareVideo } from "../clips/[clipId]/media";
import { advanceTextJobsAction, deleteTextJob, registerTextJobs, retryTextJob, textRemoverReady } from "./actions";

export type JobView = {
  id: string; name: string; stage: "detect" | "submit" | "running" | "compose" | "done" | "error"; error: string | null; createdAt: string;
  duration: number | null; pieces: number; piecesDone: number; noText: boolean; warning: string | null; checks: number;
  out: string | null; src: string | null; download: string | null;
};

const MAX_FILES = 10;

function stageLabel(j: JobView): string {
  switch (j.stage) {
    case "detect": return "Szukam napisów";
    case "submit": return "Wysyłam do fal.ai";
    case "running": return j.pieces ? `${j.checks ? "Poprawiam" : "Wymazuję napisy"} — ${j.piecesDone}/${j.pieces} ujęć` : "Wymazuję napisy";
    case "compose": return "Składam film i sprawdzam";
    case "done": return j.noText ? "Nie znalazłem napisów" : "Gotowe";
    default: return "Błąd";
  }
}

export function TextRemover({ userId, jobs }: { userId: string; jobs: JobView[] }) {
  const router = useRouter();
  const looping = useRef(false);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const active = jobs.some((j) => j.stage !== "done" && j.stage !== "error");

  const run = useCallback(async () => {
    if (looping.current) return;
    looping.current = true;
    setRunning(true);
    setErr(null);
    for (let i = 0; i < 400; i++) {
      const r = await advanceTextJobsAction();
      router.refresh();
      if (!r.ok) {
        setErr(r.error);
        if (r.stop) break;
        await new Promise((res) => setTimeout(res, 3000));
        continue;
      }
      if (!r.active) break;
      if (r.wait) await new Promise((res) => setTimeout(res, 4000));
    }
    looping.current = false;
    setRunning(false);
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => void run(), 50);
    return () => clearTimeout(t);
  }, [active, run]);

  async function upload(list: FileList | File[] | null) {
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith("video/") || /\.(mp4|mov|webm)$/i.test(f.name));
    if (!files.length) return;
    if (files.length > MAX_FILES) return setErr(`Naraz maksymalnie ${MAX_FILES} filmów.`);
    setErr(null);
    const ready = await textRemoverReady();
    if (!ready.ok) return setErr(ready.error);
    const supabase = createClient();
    const done: Array<{ id: string; path: string; name: string }> = [];
    try {
      for (const [i, raw] of files.entries()) {
        setBusy(`Przygotowuję ${i + 1}/${files.length}: ${raw.name}`);
        const file = await prepareVideo(raw, (p) => setBusy(`Zmniejszam ${raw.name}: ${Math.round(p * 100)}%`));
        setBusy(`Wysyłam ${i + 1}/${files.length}: ${raw.name}`);
        const id = crypto.randomUUID();
        const path = `${userId}/text-remover/${id}/src.mp4`;
        const { error } = await supabase.storage.from("media").upload(path, file, { contentType: "video/mp4" });
        if (error) throw new Error(`${raw.name}: ${error.message}`);
        done.push({ id, path, name: raw.name });
      }
      const r = await registerTextJobs(done);
      if (!r.ok) throw new Error(r.error);
      router.refresh();
      void run();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); void upload(e.dataTransfer.files); }}
        className={cx("flex cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed px-6 py-12 text-center transition", drag ? "border-accent bg-accent/10" : "border-border hover:border-border-strong")}
      >
        <input type="file" accept="video/mp4,video/quicktime,video/webm" multiple className="sr-only" disabled={Boolean(busy)} onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
        {busy ? <><Spinner /><span className="text-sm font-semibold">{busy}</span></> : (
          <>
            <span className="text-lg font-extrabold">Wrzuć filmy z napisami</span>
            <span className="text-sm text-muted">Kilka naraz (do {MAX_FILES}), każdy do 60 s. Przeciągnij tutaj albo kliknij.</span>
            <span className="text-xs text-faint">Koszt: ok. 0,10 $ za każde ujęcie z napisem (fal.ai) + Gemini; film 15 s ≈ 0,80–1,50 $ z poprawkami. Czas zależy od limitu równoczesnych zleceń na Twoim koncie fal (nowe konto: 2 naraz → ok. 5 min na film).</span>
          </>
        )}
      </label>

      {err ? <Notice tone="danger">{err}</Notice> : null}
      {running ? <p className="flex items-center gap-2 text-xs text-muted"><Spinner /> Pracuję — nie zamykaj tej strony. Po powrocie wznowię od miejsca, w którym skończyłem.</p> : null}

      {jobs.length ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.map((j) => <JobCard key={j.id} job={j} onRetry={async () => { await retryTextJob(j.id); router.refresh(); void run(); }} />)}
        </ul>
      ) : null}
    </div>
  );
}

function JobCard({ job: j, onRetry }: { job: JobView; onRetry: () => void }) {
  const [showSrc, setShowSrc] = useState(false);
  const done = j.stage === "done";
  const url = done && !showSrc ? j.out : j.src;
  return (
    <li>
      <Card className="flex h-full flex-col gap-3 p-3">
        <div className="relative flex h-80 items-center justify-center overflow-hidden rounded-xl bg-[#0d0b10]">
          {url ? <video key={url} src={`${url}#t=0.1`} preload="metadata" controls playsInline className="h-full max-w-full object-contain" /> : null}
          {!done && j.stage !== "error" ? (
            <div className="absolute inset-x-2 top-2 flex"><Badge tone="accent" dot>{stageLabel(j)}</Badge></div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate font-bold" title={j.name}>{j.name}</span>
          <Badge tone={done ? "ok" : j.stage === "error" ? "danger" : "neutral"} dot>{stageLabel(j)}</Badge>
        </div>
        {j.stage === "error" ? <Notice tone="danger">{j.error ?? "Coś poszło nie tak."}</Notice> : null}
        {done && j.warning ? <Notice tone="warn">{j.warning}</Notice> : null}
        {!done && j.stage !== "error" ? (
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${{ detect: 10, submit: 25, running: 30 + (j.pieces ? (j.piecesDone / j.pieces) * 55 : 0), compose: 90 }[j.stage as "detect" | "submit" | "running" | "compose"]}%` }} />
          </div>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-border pt-3 text-sm">
          {done && j.download ? <a href={j.download} download className="font-bold text-accent hover:text-accent-strong">Pobierz</a> : null}
          {done && j.src && !j.noText ? (
            <button type="button" onClick={() => setShowSrc((v) => !v)} className="font-semibold text-muted hover:text-text">{showSrc ? "Pokaż wynik" : "Pokaż oryginał"}</button>
          ) : null}
          {j.stage === "error" ? <Button variant="secondary" onClick={onRetry}>Spróbuj ponownie</Button> : null}
          <form action={deleteTextJob} className="ml-auto">
            <input type="hidden" name="jobId" value={j.id} />
            <ConfirmButton subtle message={`Usunąć „${j.name}”? Gotowy film zostanie w „Twoich plikach”.`}>Usuń</ConfirmButton>
          </form>
        </div>
      </Card>
    </li>
  );
}
