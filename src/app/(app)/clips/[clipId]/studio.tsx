"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { Badge, Button, Card, Disclosure, Notice, Spinner, Textarea, cx } from "@/components/ui";
import { FORMAT_SIZE, FPS, type EditPlan, type Format } from "@/lib/clips/plan";
import { editCaptions, normalizeMix, setPackshot, type Mix } from "@/lib/clips/edit";
import type { PlayerRef } from "@remotion/player";
import type { CaptionChunk, VoSegment } from "@/lib/clips/timeline";
import type { ControlReport } from "@/lib/ai/control";
import { plural } from "@/lib/plural";
import {
  analyzeAssetAction, feedbackAction, missingAction, planAction, pollAction, registerUploads, restoreDirectorAction, reviewRenderAction, saveEditsAction,
  saveRenderAction, voiceoverAction,
} from "../actions";
import { QuickEdit, type Draft } from "./quick-edit";
import { prepareVideo, renderInBrowser, sklejkaProps } from "./media";

const Preview = dynamic(() => import("./preview"), { ssr: false, loading: () => <div className="aspect-[4/5] w-full animate-pulse rounded-[18px] bg-surface-2" /> });

type RenderReview = { score: number; verdict: string; issues: Array<{ t: string; severity: string; problem: string; fix: string }>; strengths: string[] } | null;

export type StudioData = {
  userId: string;
  project: {
    id: string;
    name: string;
    status: string;
    settings: { voiceover: boolean; music: string; formats: string[]; notes: string; generated?: string };
    voiceover: { segments: VoSegment[]; captions: CaptionChunk[]; original: number; duration: number; feedback: { verdict: string; notes: string[] } | null; assetId: string } | null;
    plan: { plan: EditPlan; notes: string[]; report: ControlReport | null; mix?: Mix; director?: EditPlan; edited_at?: string } | null;
    error: string | null;
    feedback: Array<{ at: string; text: string; changes: string }>;
    missingNotes: string | null;
  };
  assets: Array<{
    id: string; kind: "clip" | "voiceover" | "generated" | "render"; name: string; status: string; error: string | null; url: string | null;
    mirrored: boolean; format: string | null; duration: number | null; cuts: number[]; review: RenderReview; created_at: string;
  }>;
  brand: { name: string; logoUrl: string | null; accent: string };
  product: { name: string | null };
  packshotUrl: string | null;
};

type Step = { kind: "analyze"; ids: string[] } | { kind: "voiceover" } | { kind: "missing" } | { kind: "poll" } | { kind: "plan" } | { kind: "done" } | { kind: "wait" };

const RUNNING = new Set(["analyzing", "generating", "planning"]);

function nextStep(d: StudioData, inFlight: Set<string>): Step {
  const media = d.assets.filter((a) => a.kind === "clip" || a.kind === "generated");
  const toAnalyze = media.filter((a) => (a.status === "uploaded" || a.status === "analyzing") && !inFlight.has(a.id)).map((a) => a.id);
  if (toAnalyze.length) return { kind: "analyze", ids: toAnalyze.slice(0, Math.max(0, 2 - inFlight.size)) };
  if (inFlight.size) return { kind: "wait" };
  const vo = d.assets.find((a) => a.kind === "voiceover");
  if (vo && !d.project.voiceover && vo.status !== "error") return { kind: "voiceover" };
  if (d.project.settings.generated !== "done") return { kind: "missing" };
  if (media.some((a) => a.kind === "generated" && a.status === "generating")) return { kind: "poll" };
  if (!d.project.plan) return { kind: "plan" };
  return { kind: "done" };
}

export function Studio({ data }: { data: StudioData }) {
  const router = useRouter();
  const p = data.project;
  const clips = data.assets.filter((a) => a.kind === "clip");
  const generated = data.assets.filter((a) => a.kind === "generated");
  const vo = data.assets.find((a) => a.kind === "voiceover");
  const renders = data.assets.filter((a) => a.kind === "render").sort((a, b) => b.created_at.localeCompare(a.created_at));
  const [running, setRunning] = useState(RUNNING.has(p.status) && clips.length > 0);
  const [error, setError] = useState<string | null>(p.status === "error" ? p.error : null);
  const [log, setLog] = useState<string[]>([]);
  const inFlight = useRef(new Set<string>());
  const busy = useRef(false);
  const [tick, setTick] = useState(0);

  // The pipeline is a small state machine driven by fresh server data after every step.
  useEffect(() => {
    if (!running || busy.current) return;
    const step = nextStep(data, inFlight.current);
    if (step.kind === "done") {
      setRunning(false);
      return;
    }
    if (step.kind === "wait") return;
    const run = async () => {
      busy.current = true;
      try {
        if (step.kind === "analyze") {
          step.ids.forEach((id) => inFlight.current.add(id));
          busy.current = false;
          await Promise.all(
            step.ids.map(async (id) => {
              const r = await analyzeAssetAction(p.id, id);
              inFlight.current.delete(id);
              if (!r.ok) setLog((l) => [...l, `Analiza nagrania: ${r.error}`]);
            }),
          );
        } else if (step.kind === "poll") {
          await new Promise((r) => setTimeout(r, 8000));
          const r = await pollAction(p.id);
          if (!r.ok) throw new Error(r.error);
        } else {
          const fn = step.kind === "voiceover" ? voiceoverAction : step.kind === "missing" ? missingAction : planAction;
          const r = await fn(p.id);
          if (!r.ok) throw new Error(r.error);
          if (r.message) setLog((l) => [...l, r.message!]);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setRunning(false);
      } finally {
        busy.current = false;
        router.refresh();
        setTick((t) => t + 1);
      }
    };
    void run();
  }, [running, data, p.id, router, tick]);

  const start = () => {
    setError(null);
    setRunning(true);
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        <Uploader data={data} disabled={running} onDone={() => router.refresh()} />
        {p.plan ? <Result key={draftKey(data)} data={data} renders={renders} onChanged={() => router.refresh()} /> : null}
      </div>

      <aside className="order-first space-y-4 lg:sticky lg:top-6 lg:order-none lg:self-start">
        <Card>
          <div className="font-extrabold">Reżyser</div>
          <Progress data={data} running={running} />
          {error ? <div className="mt-3"><Notice tone="danger">{error}</Notice></div> : null}
          {log.length ? <ul className="mt-3 space-y-1 text-xs text-muted">{log.slice(-4).map((l, i) => <li key={i}>{l}</li>)}</ul> : null}
          {!p.plan || error ? (
            <Button className="mt-4 w-full" onClick={start} disabled={running || clips.length === 0 || (p.settings.voiceover && !vo)}>
              {running ? <Spinner /> : null}
              {running ? "Reżyser pracuje…" : p.plan ? "Spróbuj ponownie" : "Zrób sklejkę"}
            </Button>
          ) : null}
          {clips.length === 0 ? <p className="mt-2 text-xs text-faint">Najpierw wgraj nagrania.</p> : p.settings.voiceover && !vo ? <p className="mt-2 text-xs text-faint">Wgraj plik lektora.</p> : null}
          {running ? <p className="mt-2 text-xs text-faint">Możesz zostawić tę stronę otwartą — całość trwa zwykle 5–15 minut (najdłużej generowanie ujęć).</p> : null}
        </Card>
        {generated.length ? (
          <Card className="py-4">
            <div className="text-sm font-bold">Ujęcia wygenerowane przez AI</div>
            <ul className="mt-2 space-y-1.5 text-xs text-muted">
              {generated.map((g) => (
                <li key={g.id} className="flex items-start gap-2">
                  <StatusDot status={g.status} />
                  <span>{g.name}{g.error ? ` — ${g.error}` : ""}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
        {p.voiceover?.feedback ? <ScriptCard vo={p.voiceover} /> : null}
      </aside>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const tone = status === "ready" ? "bg-ok" : status === "error" ? "bg-danger" : "bg-warn animate-pulse";
  return <span className={cx("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", tone)} aria-hidden />;
}

function Progress({ data, running }: { data: StudioData; running: boolean }) {
  const media = data.assets.filter((a) => a.kind === "clip");
  const ready = media.filter((a) => a.status === "ready").length;
  const vo = data.assets.find((a) => a.kind === "voiceover");
  const gen = data.assets.filter((a) => a.kind === "generated");
  const p = data.project;
  const steps: Array<{ label: string; state: "done" | "active" | "todo" | "error" }> = [
    { label: `Analiza nagrań (${ready}/${media.length})`, state: media.length && ready === media.length ? "done" : media.some((a) => a.status === "error") ? "error" : running ? "active" : "todo" },
    ...(p.settings.voiceover ? [{ label: p.voiceover ? `Lektor: ${p.voiceover.original.toFixed(1)} s → ${p.voiceover.duration.toFixed(1)} s bez pauz` : "Lektor: transkrypcja i cięcie pauz", state: (p.voiceover ? "done" : vo?.status === "error" ? "error" : running && ready === media.length ? "active" : "todo") as "done" | "active" | "todo" | "error" }] : []),
    { label: gen.length ? `Brakujące ujęcia: ${gen.filter((g) => g.status === "ready").length}/${gen.length} gotowe` : "Brakujące ujęcia", state: p.settings.generated === "done" && gen.every((g) => g.status === "ready" || g.status === "error") ? "done" : running && p.status === "generating" ? "active" : "todo" },
    { label: "Plan montażu + Kontroler", state: p.plan ? "done" : p.status === "planning" ? "active" : "todo" },
  ];
  return (
    <ol className="mt-3 space-y-2">
      {steps.map((s) => (
        <li key={s.label} className="flex items-center gap-2.5 text-sm">
          <span className={cx("flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold", s.state === "done" ? "bg-ok text-on-accent" : s.state === "active" ? "bg-accent text-on-accent" : s.state === "error" ? "bg-danger text-on-accent" : "bg-surface-3 text-faint")}>
            {s.state === "done" ? "✓" : s.state === "active" ? <Spinner /> : s.state === "error" ? "!" : ""}
          </span>
          <span className={s.state === "todo" ? "text-faint" : undefined}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

function ScriptCard({ vo }: { vo: NonNullable<StudioData["project"]["voiceover"]> }) {
  const fb = vo.feedback!;
  const tone = fb.verdict === "mocny" ? "ok" : fb.verdict === "ok" ? "neutral" : "warn";
  return (
    <Disclosure title="Uwagi do skryptu lektora" meta={<Badge tone={tone} dot>{fb.verdict}</Badge>}>
      <ul className="space-y-1.5 text-sm text-muted">{fb.notes.map((n, i) => <li key={i}>• {n}</li>)}</ul>
      <p className="mt-2 text-xs text-faint">Sklejka powstanie i tak — to podpowiedzi do kolejnego nagrania.</p>
    </Disclosure>
  );
}

// ---------- uploads ----------

function Uploader({ data, disabled, onDone }: { data: StudioData; disabled: boolean; onDone: () => void }) {
  const clips = data.assets.filter((a) => a.kind === "clip");
  const vo = data.assets.find((a) => a.kind === "voiceover");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const locked = disabled || Boolean(data.project.plan);

  async function upload(files: FileList | null, kind: "clip" | "voiceover") {
    if (!files?.length) return;
    setErr(null);
    const supabase = createClient();
    const done: Array<{ id: string; path: string; name: string; kind: "clip" | "voiceover" }> = [];
    try {
      for (const [i, raw] of Array.from(files).entries()) {
        let file = raw;
        if (kind === "clip") {
          setBusy(`Przygotowuję ${i + 1}/${files.length}: ${raw.name}`);
          file = await prepareVideo(raw, (pr) => setBusy(`Zmniejszam ${raw.name}: ${Math.round(pr * 100)}%`));
        } else if (raw.size > 45 * 1024 * 1024) {
          throw new Error("Plik lektora jest za duży (max 45 MB) — zapisz go jako MP3.");
        }
        setBusy(`Wysyłam ${i + 1}/${files.length}: ${file.name}`);
        const id = crypto.randomUUID();
        const ext = (file.name.split(".").pop() || (kind === "clip" ? "mp4" : "mp3")).toLowerCase().replace(/[^a-z0-9]/g, "");
        const path = `${data.userId}/clips/${data.project.id}/${id}.${ext}`;
        const { error } = await supabase.storage.from("media").upload(path, file, { contentType: file.type || undefined });
        if (error) throw new Error(`${file.name}: ${error.message}`);
        done.push({ id, path, name: raw.name, kind });
      }
      const r = await registerUploads(data.project.id, done);
      if (!r.ok) throw new Error(r.error);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold">Materiały</h2>
          <p className="text-xs text-faint">Nagrania produktu z telefonu — im więcej ujęć (użycie, efekt, problem, detal), tym lepsza sklejka.</p>
        </div>
        {!locked ? (
          <div className="flex flex-wrap gap-2">
            <label className={cx("cursor-pointer", busy && "pointer-events-none opacity-50")}>
              <input type="file" accept="video/*" multiple className="sr-only" onChange={(e) => upload(e.target.files, "clip")} />
              <span className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-bold text-on-accent">+ Nagrania</span>
            </label>
            {data.project.settings.voiceover ? (
              <label className={cx("cursor-pointer", busy && "pointer-events-none opacity-50")}>
                <input type="file" accept="audio/*,.wav,.mp3,.m4a" className="sr-only" onChange={(e) => upload(e.target.files, "voiceover")} />
                <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-4 py-2 text-sm font-semibold">{vo ? "Zmień lektora" : "+ Lektor (WAV/MP3)"}</span>
              </label>
            ) : null}
          </div>
        ) : null}
      </div>
      {busy ? <p className="mt-3 flex items-center gap-2 text-sm text-muted"><Spinner /> {busy}</p> : null}
      {err ? <div className="mt-3"><Notice tone="danger">{err}</Notice></div> : null}
      {clips.length || vo ? (
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {clips.map((c) => (
            <div key={c.id} className="relative aspect-[9/16] overflow-hidden rounded-xl border border-border bg-surface-2">
              {c.url ? <video src={c.url} muted playsInline preload="metadata" className="h-full w-full object-cover" /> : null}
              <div className="absolute inset-x-1 bottom-1 flex items-center gap-1 rounded-full bg-[#100c16]/80 px-2 py-0.5 text-[10px]">
                <StatusDot status={c.status} />
                <span className="truncate">{c.status === "error" ? c.error : c.name}</span>
              </div>
            </div>
          ))}
          {vo ? (
            <div className="flex aspect-[9/16] flex-col items-center justify-center gap-1 rounded-xl border border-border bg-surface-2 p-2 text-center text-xs">
              <span className="text-2xl">🎙</span>
              <span className="font-bold">Lektor</span>
              <span className="text-faint">{vo.status === "error" ? vo.error : vo.name}</span>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 rounded-2xl border-2 border-dashed border-border p-6 text-center text-sm text-muted">Dodaj nagrania (MP4/MOV). Duże pliki zmniejszę w przeglądarce przed wysłaniem.</p>
      )}
    </Card>
  );
}

// ---------- result: preview, render, Kontroler, feedback ----------

// Remount the editor (and drop the draft) whenever the saved version changes.
function draftKey(d: StudioData) {
  const str = JSON.stringify([d.project.plan?.plan, d.project.plan?.mix, d.project.voiceover?.captions.map((c) => c.text)]);
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return String(h);
}

function savedDraft(d: StudioData): Draft {
  const stored = d.project.plan!;
  return { plan: stored.plan, captions: (d.project.voiceover?.captions ?? []).map((c) => c.text), mix: normalizeMix(stored.mix) };
}

function Result({ data, renders, onChanged }: { data: StudioData; renders: StudioData["assets"]; onChanged: () => void }) {
  const p = data.project;
  const formats = (p.settings.formats.length ? p.settings.formats : ["4x5"]) as Format[];
  const [format, setFormat] = useState<Format>(formats[0]);
  const [draft, setDraft] = useState<Draft>(() => savedDraft(data));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);
  const player = useRef<PlayerRef | null>(null);
  const previewBox = useRef<HTMLDivElement | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(savedDraft(data));
  const plan = draft.plan;
  const voAsset = data.assets.find((a) => a.kind === "voiceover");
  const mediaAssets = data.assets.filter((a) => (a.kind === "clip" || a.kind === "generated") && a.status === "ready");
  const captions = p.voiceover ? editCaptions(p.voiceover.captions, draft.captions) : [];
  const props = sklejkaProps(format, plan, {
    assets: data.assets.filter((a) => a.kind === "clip" || a.kind === "generated").map((a) => ({ id: a.id, url: a.url, mirrored: a.mirrored })),
    vo: p.voiceover && voAsset?.url ? { url: voAsset.url, segments: p.voiceover.segments } : null,
    captions,
    brand: data.brand,
    packshotUrl: data.packshotUrl,
    mix: draft.mix,
  });
  const duration = plan.shots.reduce((m, s) => Math.max(m, s.end), 0);

  async function save(): Promise<boolean> {
    setSaving(true);
    setMessage(null);
    // empty benefit slots were kept only while typing
    const i = draft.plan.shots.findIndex((s) => s.type === "packshot");
    const shot = draft.plan.shots[i];
    const clean = shot?.type === "packshot" ? setPackshot(draft.plan, i, { chips: shot.chips }) : draft.plan;
    const r = await saveEditsAction(p.id, { plan: clean, captions: p.voiceover ? draft.captions : undefined, mix: draft.mix });
    setSaving(false);
    if (!r.ok) {
      setMessage({ tone: "danger", text: r.error });
      return false;
    }
    onChanged();
    return true;
  }

  function seek(t: number) {
    player.current?.seekTo(Math.max(0, Math.round(t * FPS)));
    previewBox.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold">Podgląd</h2>
          <div className="flex gap-1 rounded-full bg-surface-2 p-1">
            {formats.map((f) => (
              <button key={f} type="button" onClick={() => setFormat(f)} className={cx("rounded-full px-3 py-1 text-xs font-bold", f === format ? "bg-surface-3 text-text" : "text-muted hover:text-text")}>
                {FORMAT_SIZE[f].label}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-1 text-sm text-muted">{plan.summary}</p>
        <div ref={previewBox} className={cx("mx-auto mt-4 scroll-mt-6", format === "9x16" ? "max-w-[340px]" : "max-w-[420px]")}>
          <Preview props={props} playerRef={player} />
        </div>
        <p className="mt-2 text-center text-xs text-faint">{duration.toFixed(1)} s · podgląd może przycinać na słabszym komputerze — gotowy plik będzie płynny</p>
        <RenderButtons data={data} props={props} format={format} onChanged={onChanged} beforeRender={dirty ? save : undefined} />
      </Card>

      <QuickEdit
        draft={draft}
        setDraft={setDraft}
        dirty={dirty}
        captions={p.voiceover?.captions ?? []}
        media={mediaAssets.map((a) => ({ id: a.id, name: a.name, kind: a.kind, url: a.url, info: { id: a.id, duration: a.duration ?? 0, cuts: a.cuts, mirrored: a.mirrored } }))}
        hasDirector={Boolean(p.plan!.director)}
        saving={saving}
        message={message}
        onSave={() => void save()}
        onUndo={() => {
          setDraft(savedDraft(data));
          setMessage(null);
        }}
        onRestore={async () => {
          setSaving(true);
          const r = await restoreDirectorAction(p.id);
          setSaving(false);
          if (r.ok) onChanged();
          else setMessage({ tone: "danger", text: r.error });
        }}
        onSeek={seek}
      />

      {renders.length ? <Renders renders={renders} projectId={p.id} onChanged={onChanged} /> : null}
      <PlanReport report={p.plan!.report} notes={p.plan!.notes} missing={p.missingNotes} />
      <FeedbackCard projectId={p.id} history={p.feedback} onChanged={onChanged} blocked={dirty} />
    </>
  );
}

function RenderButtons({
  data, props, format, onChanged, beforeRender,
}: { data: StudioData; props: ReturnType<typeof sklejkaProps>; format: Format; onChanged: () => void; beforeRender?: () => Promise<boolean> }) {
  const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  async function render() {
    setErr(null);
    // render exactly what is saved, so the file and the project never disagree
    if (beforeRender && !(await beforeRender())) return;
    setProgress(0);
    abort.current = new AbortController();
    try {
      const blob = await renderInBrowser(props, setProgress, abort.current.signal);
      setProgress(1);
      const supabase = createClient();
      const id = crypto.randomUUID();
      const path = `${data.userId}/clips/${data.project.id}/${id}.mp4`;
      const { error } = await supabase.storage.from("media").upload(path, blob, { contentType: "video/mp4" });
      if (error) throw new Error(error.message);
      const r = await saveRenderAction(data.project.id, { id, path, format });
      if (!r.ok) throw new Error(r.error);
      // download right away; the Kontroler watches it in the background
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${data.brand.name}-${format}.mp4`.replace(/\s+/g, "-");
      a.click();
      onChanged();
      reviewRenderAction(data.project.id, id).then(() => onChanged());
    } catch (e) {
      if (!abort.current?.signal.aborted) setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="mt-4">
      {progress !== null ? (
        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-surface-3"><div className="h-full bg-accent transition-all" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Renderuję w przeglądarce… {Math.round(progress * 100)}% — nie zamykaj karty</span>
            <button type="button" className="font-bold hover:text-text" onClick={() => abort.current?.abort()}>Przerwij</button>
          </div>
        </div>
      ) : (
        <Button className="w-full" onClick={render}>{beforeRender ? "Zapisz zmiany, renderuj" : "Renderuj"} {FORMAT_SIZE[format].label} i pobierz MP4</Button>
      )}
      {err ? <div className="mt-2"><Notice tone="danger">{err.includes("WebCodecs") || err.includes("codec") ? "Ta przeglądarka nie umie renderować wideo — otwórz Clipzy w Chrome." : err}</Notice></div> : null}
    </div>
  );
}

function Renders({ renders, projectId, onChanged }: { renders: StudioData["assets"]; projectId: string; onChanged: () => void }) {
  const [checking, setChecking] = useState<string | null>(null);
  return (
    <Card>
      <h2 className="text-lg font-extrabold">Gotowe pliki</h2>
      <ul className="mt-3 space-y-3">
        {renders.map((r) => (
          <li key={r.id} className="rounded-2xl border border-border bg-bg/40 p-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-bold">{r.format ? FORMAT_SIZE[r.format as Format]?.label ?? r.format : "MP4"}</span>
              <span className="text-xs text-faint">{new Date(r.created_at).toLocaleString("pl-PL")}</span>
              {r.review ? <Badge tone={r.review.score >= 8 ? "ok" : "warn"} dot>Kontroler {r.review.score}/10</Badge> : <Badge tone="neutral">Kontroler sprawdza…</Badge>}
              {r.url ? <a href={r.url} download className="ml-auto text-sm font-bold text-accent hover:text-accent-strong">Pobierz</a> : null}
            </div>
            {r.review?.issues.length ? (
              <Disclosure plain title={`Uwagi (${r.review.issues.length})`}>
                <ul className="space-y-1.5 text-sm">
                  {r.review.issues.map((i, k) => (
                    <li key={k}><Badge tone={i.severity === "krytyczna" ? "danger" : i.severity === "ważna" ? "warn" : "neutral"}>{i.severity}</Badge> <span className="text-faint">{i.t}</span> {i.problem} <span className="text-muted">→ {i.fix}</span></li>
                  ))}
                </ul>
              </Disclosure>
            ) : null}
            {!r.review ? (
              <button type="button" className="mt-1 text-xs font-bold text-muted hover:text-text" disabled={checking === r.id} onClick={async () => { setChecking(r.id); await reviewRenderAction(projectId, r.id); setChecking(null); onChanged(); }}>
                {checking === r.id ? "Sprawdzam…" : "Sprawdź ponownie"}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function PlanReport({ report, notes, missing }: { report: ControlReport | null; notes: string[]; missing: string | null }) {
  if (!report && !notes.length && !missing) return null;
  const serious = report?.remaining.filter((i) => i.severity !== "drobna") ?? [];
  const fixed = report && report.rounds >= 2 ? report.first_issues.length : 0;
  return (
    <Disclosure title="Kontrola planu" meta={report ? <Badge tone={serious.length ? "warn" : "ok"} dot>{serious.length ? `${serious.length} ${plural(serious.length, "uwaga", "uwagi", "uwag")}` : "Bez zastrzeżeń"}</Badge> : null}>
      {missing ? <p className="text-sm text-muted">{missing}</p> : null}
      {report ? <p className="mt-2 text-sm text-muted">Kontroler sprawdził plan montażu.{fixed ? ` Reżyser poprawił ${fixed} ${plural(fixed, "usterkę", "usterki", "usterek")}.` : ""}</p> : null}
      {report?.error ? <p className="mt-1 text-xs text-warn">{report.error}</p> : null}
      {report?.remaining.length ? (
        <ul className="mt-2 space-y-1.5 text-sm">{report.remaining.map((i, k) => <li key={k}><Badge tone={i.severity === "krytyczna" ? "danger" : i.severity === "ważna" ? "warn" : "neutral"}>{i.severity}</Badge> {i.problem}</li>)}</ul>
      ) : null}
      {notes.length ? <p className="mt-2 text-xs text-faint">Automatyczne poprawki: {notes.join("; ")}</p> : null}
    </Disclosure>
  );
}

function FeedbackCard({ projectId, history, onChanged, blocked }: { projectId: string; history: StudioData["project"]["feedback"]; onChanged: () => void; blocked: boolean }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);
  return (
    <Card>
      <h2 className="text-lg font-extrabold">Co zmienić?</h2>
      <p className="text-xs text-faint">Napisz po ludzku. Zmiany ogólne (np. „muzyka ciszej”) Clipzy zapamięta dla marki i zastosuje w każdej kolejnej sklejce.</p>
      <Textarea className="mt-3" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="np. więcej efektów w hooku, muzyka ciszej, mniej zbliżeń skóry" />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          disabled={busy || blocked || !text.trim()}
          onClick={async () => {
            setBusy(true);
            setMsg(null);
            const r = await feedbackAction(projectId, text);
            setBusy(false);
            if (r.ok) {
              setText("");
              setMsg({ tone: "ok", text: `${r.message ?? "Gotowe."} Obejrzyj podgląd i wyrenderuj ponownie.` });
              onChanged();
            } else setMsg({ tone: "danger", text: r.error });
          }}
        >
          {busy ? <Spinner /> : null}
          {busy ? "Reżyser poprawia plan…" : "Popraw sklejkę"}
        </Button>
        {blocked ? <span className="text-xs text-warn">Najpierw zapisz szybkie poprawki — Reżyser pracuje na zapisanej wersji.</span> : null}
      </div>
      {msg ? <div className="mt-3"><Notice tone={msg.tone}>{msg.text}</Notice></div> : null}
      {history.length ? (
        <ul className="mt-4 space-y-1 text-xs text-faint">{history.slice(-3).map((h, i) => <li key={i}>• {h.text}</li>)}</ul>
      ) : null}
    </Card>
  );
}
