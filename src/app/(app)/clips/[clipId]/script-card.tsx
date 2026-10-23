"use client";

import { useState } from "react";
import { Button, Card, Notice, Spinner, Textarea, cx } from "@/components/ui";
import { generateVoiceoverAction, rewriteScriptAction } from "../actions";

export type ScriptView = { angle: string; hooks: Array<{ text: string; idea: string }>; body: string; notes: string };

const words = (t: string) => t.split(/\s+/).filter(Boolean).length;

// The Reżyser's script: edit freely, then "Generuj lektora" (only then ElevenLabs credits are used).
export function ScriptCard({ projectId, script, wordsPerSecond, onDone }: { projectId: string; script: ScriptView; wordsPerSecond: number; onDone: () => void }) {
  const [hooks, setHooks] = useState(script.hooks.map((h) => h.text));
  const [body, setBody] = useState(script.body);
  const [note, setNote] = useState("");
  const [rewrite, setRewrite] = useState(false);
  const [busy, setBusy] = useState<"voice" | "rewrite" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const filled = hooks.filter((h) => h.trim()).length;
  const seconds = Math.round((words(hooks[0] ?? "") + words(body)) / wordsPerSecond);

  async function generate() {
    setErr(null);
    setBusy("voice");
    const r = await generateVoiceoverAction(projectId, { ...script, hooks: script.hooks.map((h, i) => ({ ...h, text: hooks[i] ?? "" })), body });
    setBusy(null);
    if (!r.ok) return setErr(r.error);
    onDone();
  }

  async function again() {
    setErr(null);
    setBusy("rewrite");
    const r = await rewriteScriptAction(projectId, note);
    setBusy(null);
    if (!r.ok) return setErr(r.error);
    setRewrite(false);
    setNote("");
    onDone();
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold">Skrypt lektora</h2>
          <p className="text-xs text-faint">Popraw, co chcesz. Lektor powstanie dopiero po kliknięciu „Generuj lektora”.</p>
        </div>
        <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold tabular-nums text-muted">~{seconds} s</span>
      </div>
      <p className="mt-3 text-sm text-muted"><span className="font-bold text-text">Kąt:</span> {script.angle}</p>

      <div className="mt-4 space-y-2">
        <span className="block text-sm font-bold">5 hooków — każdy otwiera osobną wersję reklamy</span>
        {hooks.map((h, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-extrabold text-on-accent">{i + 1}</span>
            <div className="flex-1">
              <Textarea rows={1} value={h} onChange={(e) => setHooks(hooks.map((x, k) => (k === i ? e.target.value : x)))} className="min-h-0 py-2" />
              <span className="mt-0.5 block text-[11px] text-faint">{script.hooks[i]?.idea}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <span className="mb-1 block text-sm font-bold">Reszta (wspólna dla wszystkich wersji)</span>
        <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      {script.notes ? <p className="mt-2 text-xs text-faint">{script.notes}</p> : null}

      {err ? <div className="mt-3"><Notice tone="danger">{err}</Notice></div> : null}

      {rewrite ? (
        <div className="mt-4 space-y-2 rounded-2xl border border-border bg-bg/40 p-3">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Co zmienić? np. mocniej o bólu przy wosku, krótsze zdania" />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void again()} disabled={busy !== null}>{busy === "rewrite" ? <Spinner /> : null}Napisz od nowa</Button>
            <Button variant="ghost" onClick={() => setRewrite(false)} disabled={busy !== null}>Anuluj</Button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button onClick={() => void generate()} disabled={busy !== null || !filled || !body.trim()}>
          {busy === "voice" ? <Spinner /> : null}
          {busy === "voice" ? "Nagrywam lektora…" : `Generuj lektora (${filled} ${filled === 1 ? "wersja" : filled < 5 ? "wersje" : "wersji"})`}
        </Button>
        {!rewrite ? <Button variant="ghost" onClick={() => setRewrite(true)} disabled={busy !== null}>Napisz od nowa…</Button> : null}
        <span className={cx("text-xs", filled < 5 ? "text-warn" : "text-faint")}>{filled < 5 ? `Puste hooki zostaną pominięte (${5 - filled}).` : "Hook 1 + reszta to wersja podstawowa."}</span>
      </div>
    </Card>
  );
}
