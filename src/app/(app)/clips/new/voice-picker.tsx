"use client";

import { useRef, useState } from "react";
import { Spinner, cx } from "@/components/ui";
import { voiceSampleAction } from "../actions";

type VoiceOption = { id: string; label: string; elevenName: string };

// Voice list with "▶ Próbka" and the approximate length slider.
export function VoicePicker({ voices }: { voices: VoiceOption[] }) {
  const [voice, setVoice] = useState(voices[0]?.id ?? "");
  const [seconds, setSeconds] = useState(30);
  const [loading, setLoading] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  async function sample(id: string) {
    setErr(null);
    setLoading(id);
    const r = await voiceSampleAction(id);
    setLoading(null);
    if (!r.ok) return setErr(r.error);
    audio.current?.pause();
    audio.current = new Audio(r.url);
    void audio.current.play();
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-bg/40 p-4">
      <input type="hidden" name="voice" value={voice} />
      <div>
        <span className="mb-1.5 block text-sm font-bold">Głos</span>
        <div className="space-y-2">
          {voices.map((v) => (
            <div key={v.id} className={cx("flex items-center gap-3 rounded-xl border px-3 py-2", voice === v.id ? "border-accent bg-accent-soft" : "border-border")}>
              <button type="button" onClick={() => setVoice(v.id)} className="flex flex-1 items-center gap-3 text-left" aria-pressed={voice === v.id}>
                <span className={cx("flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2", voice === v.id ? "border-accent" : "border-border-strong")}>
                  {voice === v.id ? <span className="h-2 w-2 rounded-full bg-accent" /> : null}
                </span>
                <span>
                  <span className="block text-sm font-bold">{v.label}</span>
                  <span className="block text-xs text-faint">{v.elevenName}</span>
                </span>
              </button>
              <button type="button" onClick={() => void sample(v.id)} disabled={loading !== null} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-bold text-muted hover:text-text disabled:opacity-50">
                {loading === v.id ? <Spinner /> : "▶"} Próbka
              </button>
            </div>
          ))}
        </div>
        {err ? <p className="mt-2 text-xs text-danger">{err}</p> : null}
      </div>
      <label className="block">
        <span className="flex items-center justify-between text-sm">
          <span className="font-bold">Długość reklamy</span>
          <span className="tabular-nums text-muted">ok. {seconds} s</span>
        </span>
        <input type="range" name="target_seconds" min={10} max={60} step={5} value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} className="mt-1 w-full accent-[var(--color-accent)]" />
        <span className="mt-0.5 block text-xs text-faint">W przybliżeniu — Reżyser dopasuje skrypt, a pauzy i tak przytniemy.</span>
      </label>
    </div>
  );
}
