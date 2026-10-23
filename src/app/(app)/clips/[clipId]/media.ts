"use client";

// Browser-side media work: shrink big phone videos before upload and render
// the finished sklejka with Remotion's web renderer (no server, no extra keys).
import type { EditPlan, Format } from "@/lib/clips/plan";
import { FORMAT_SIZE, FPS } from "@/lib/clips/plan";
import type { SklejkaProps } from "@/remotion/Sklejka";
import type { VoSegment } from "@/lib/clips/timeline";
import { fixBrandName } from "@/lib/clips/names";

export const MAX_UPLOAD = 45 * 1024 * 1024;

// Big files and iPhone .mov (HEVC) are re-encoded to H.264 MP4, longest side 1920 px.
export async function prepareVideo(file: File, onProgress: (p: number) => void): Promise<File> {
  const needs = file.size > MAX_UPLOAD || /\.mov$/i.test(file.name) || file.type === "video/quicktime";
  if (!needs) return file;
  const { convertMedia } = await import("@remotion/webcodecs");
  const res = await convertMedia({
    src: file,
    container: "mp4",
    videoCodec: "h264",
    audioCodec: "aac",
    resize: { mode: "max-height-width", maxHeight: 1920, maxWidth: 1920 },
    onProgress: (s) => onProgress(s.overallProgress ?? 0),
  });
  const blob = await res.save();
  const out = new File([blob], file.name.replace(/\.[^.]+$/, "") + ".mp4", { type: "video/mp4" });
  if (out.size > 50 * 1024 * 1024) throw new Error(`${file.name}: nawet po zmniejszeniu plik ma ponad 50 MB — skróć nagranie.`);
  return out;
}

// A render error with a plain message for the user and details for debugging.
export class RenderFailure extends Error {
  details: string;
  constructor(message: string, details: string) {
    super(message);
    this.details = details;
  }
}

export type SourceCheck = { name: string; ok: boolean; status: number | null; ms: number; ranged: boolean; size: number | null; error: string | null };

const shortUrl = (u: string) => u.split("?")[0].replace(/^https?:\/\/[^/]+/, "");

// Before rendering: can the browser actually read every file, and how fast?
export async function checkSources(sources: Array<{ name: string; url: string }>, timeoutMs = 15_000): Promise<SourceCheck[]> {
  const one = async (src: { name: string; url: string }): Promise<SourceCheck> => {
    const t0 = performance.now();
    try {
      const res = await fetch(src.url, { headers: { Range: "bytes=0-65535" }, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
      await res.arrayBuffer();
      const range = res.headers.get("Content-Range");
      // across domains Content-Range is often hidden; Content-Length of a 206 is only the chunk
      const size = range ? Number(range.split("/")[1]) || null : res.status === 200 ? Number(res.headers.get("Content-Length")) || null : null;
      return { name: src.name, ok: res.ok, status: res.status, ms: Math.round(performance.now() - t0), ranged: res.status === 206, size, error: res.ok ? null : res.statusText || `HTTP ${res.status}` };
    } catch (e) {
      const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      return { name: src.name, ok: false, status: null, ms: Math.round(performance.now() - t0), ranged: false, size: null, error: msg };
    }
  };
  const out: SourceCheck[] = [];
  for (let i = 0; i < sources.length; i += 4) out.push(...(await Promise.all(sources.slice(i, i + 4).map(one))));
  return out;
}

function describeChecks(checks: SourceCheck[]) {
  return checks.map((c) => `${c.ok ? "OK " : "BŁĄD"} ${c.name} — ${c.status ?? "-"} ${c.ranged ? "206" : "bez zakresów"} ${c.ms} ms ${c.size ? `${(c.size / 1e6).toFixed(1)} MB` : ""}${c.error ? ` (${c.error})` : ""}`).join("\n");
}

// Windows/GPU hardware video decoders have a small pool of output frames. The renderer keeps
// several decoded frames per clip in its cache, and with two clips on screen (split) the
// hardware decoder stops producing frames — the render then hangs on "Extracting frame".
// Software decoding has no such pool, and 720p H.264 decodes fast enough in software.
export function preferSoftwareDecoding(): { restore: () => void; count: () => number } {
  if (typeof VideoDecoder === "undefined") return { restore: () => {}, count: () => 0 };
  const proto = VideoDecoder.prototype;
  const original = proto.configure;
  let n = 0;
  proto.configure = function (this: VideoDecoder, config: VideoDecoderConfig) {
    n++;
    return original.call(this, { ...config, hardwareAcceleration: "prefer-software" });
  };
  return { restore: () => void (proto.configure = original), count: () => n };
}

export async function renderInBrowser(
  props: SklejkaProps,
  onProgress: (p: number) => void,
  signal: AbortSignal | undefined,
  sources: Array<{ name: string; url: string }>,
): Promise<Blob> {
  // 1) every file reachable? (a file the browser can't read would only show up as a 28 s timeout)
  const checks = await checkSources(sources);
  const bad = checks.find((c) => !c.ok);
  if (bad) {
    throw new RenderFailure(
      `Przeglądarka nie może pobrać pliku „${bad.name}” (${bad.error ?? bad.status}). Odśwież stronę i spróbuj ponownie — jeśli się powtórzy, wyślij szczegóły.`,
      `Sprawdzenie plików:\n${describeChecks(checks)}\n\n${navigator.userAgent}`,
    );
  }
  // 2) render, keeping the renderer's log for the error details
  const logs: string[] = [];
  const orig = { log: console.log, info: console.info, warn: console.warn, error: console.error, debug: console.debug };
  for (const k of Object.keys(orig) as Array<keyof typeof orig>) {
    console[k] = (...args: unknown[]) => {
      logs.push(`[${k}] ${args.map((a) => (typeof a === "string" ? a : a instanceof Error ? a.message : JSON.stringify(a)?.slice(0, 300))).join(" ")}`.slice(0, 500));
      if (logs.length > 200) logs.shift();
      orig[k](...args);
    };
  }
  const decoding = preferSoftwareDecoding();
  try {
    const [{ renderMediaOnWeb }, { Sklejka, durationInFrames }] = await Promise.all([import("@remotion/web-renderer"), import("@/remotion/Sklejka")]);
    const size = FORMAT_SIZE[props.format];
    const res = await renderMediaOnWeb({
      composition: { id: `sklejka-${props.format}`, component: Sklejka, durationInFrames: durationInFrames(props.plan), fps: FPS, width: size.width, height: size.height },
      inputProps: props,
      container: "mp4",
      videoCodec: "h264",
      videoBitrate: "high",
      logLevel: "verbose",
      licenseKey: process.env.NEXT_PUBLIC_REMOTION_LICENSE_KEY || "free-license",
      onProgress: (p: { progress: number }) => onProgress(p.progress),
      signal: signal ?? null,
    } as never);
    return await res.getBlob();
  } catch (e) {
    if (signal?.aborted) throw e;
    const raw = e instanceof Error ? e.message : String(e);
    let message = raw;
    if (/WebCodecs|VideoEncoder|codec/i.test(raw) && !/delayRender/.test(raw)) message = "Ta przeglądarka nie umie renderować wideo — otwórz Clipzy w Chrome lub Edge na komputerze.";
    else if (/delayRender|Extracting frame/.test(raw)) {
      const hit = sources.find((s) => raw.includes(shortUrl(s.url)));
      message = `Przeglądarka nie zdążyła odczytać klatki z nagrania${hit ? ` „${hit.name}”` : ""}. Zostaw kartę Clipzy na wierzchu podczas renderu i spróbuj ponownie — jeśli się powtórzy, wyślij szczegóły.`;
    }
    throw new RenderFailure(message, `${raw.slice(0, 1500)}\n\nSprawdzenie plików:\n${describeChecks(checks)}\n\nDekodery programowe: ${decoding.count()}\n\nOstatnie logi renderera:\n${logs.slice(-80).join("\n")}\n\n${navigator.userAgent}`);
  } finally {
    decoding.restore();
    Object.assign(console, orig);
  }
}

export function sklejkaProps(
  format: Format,
  plan: EditPlan,
  data: {
    assets: Array<{ id: string; url: string | null; mirrored: boolean }>;
    vo: { url: string; segments: VoSegment[] } | null;
    captions: SklejkaProps["captions"];
    brand: SklejkaProps["brand"];
    packshotUrl: string | null;
    mix?: SklejkaProps["mix"];
  },
): SklejkaProps {
  const assets: SklejkaProps["assets"] = {};
  for (const a of data.assets) if (a.url) assets[a.id] = { url: a.url, mirrored: a.mirrored };
  // the brand always spelled as in its profile (speech-to-text writes "Depli" as "Depily")
  const fix = (t: string) => fixBrandName(t, data.brand.name);
  const fixed: EditPlan = {
    ...plan,
    shots: plan.shots.map((s) => (s.type === "packshot" ? { ...s, headline: fix(s.headline), cta: fix(s.cta), chips: s.chips.map(fix) } : s)),
    text_plates: plan.text_plates.map((t) => ({ ...t, text: fix(t.text) })),
  };
  const captions = data.vo ? data.captions.map((c) => ({ ...c, text: fix(c.text) })) : [];
  return { format, plan: fixed, assets, vo: data.vo, captions, brand: data.brand, packshotUrl: data.packshotUrl, mix: data.mix };
}
