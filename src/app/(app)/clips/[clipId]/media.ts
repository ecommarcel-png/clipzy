"use client";

// Browser-side media work: shrink big phone videos before upload and render
// the finished sklejka with Remotion's web renderer (no server, no extra keys).
import type { EditPlan, Format } from "@/lib/clips/plan";
import { FORMAT_SIZE, FPS } from "@/lib/clips/plan";
import type { SklejkaProps } from "@/remotion/Sklejka";
import type { VoSegment } from "@/lib/clips/timeline";

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

export async function renderInBrowser(props: SklejkaProps, onProgress: (p: number) => void, signal?: AbortSignal): Promise<Blob> {
  const [{ renderMediaOnWeb }, { Sklejka, durationInFrames }] = await Promise.all([import("@remotion/web-renderer"), import("@/remotion/Sklejka")]);
  const size = FORMAT_SIZE[props.format];
  const res = await renderMediaOnWeb({
    composition: { id: `sklejka-${props.format}`, component: Sklejka, durationInFrames: durationInFrames(props.plan), fps: FPS, width: size.width, height: size.height },
    inputProps: props,
    container: "mp4",
    videoCodec: "h264",
    videoBitrate: "high",
    licenseKey: process.env.NEXT_PUBLIC_REMOTION_LICENSE_KEY || "free-license",
    onProgress: (p: { progress: number }) => onProgress(p.progress),
    signal: signal ?? null,
  } as never);
  return res.getBlob();
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
  },
): SklejkaProps {
  const assets: SklejkaProps["assets"] = {};
  for (const a of data.assets) if (a.url) assets[a.id] = { url: a.url, mirrored: a.mirrored };
  return { format, plan, assets, vo: data.vo, captions: data.vo ? data.captions : [], brand: data.brand, packshotUrl: data.packshotUrl };
}
