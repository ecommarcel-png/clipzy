import "server-only";
import { FalError } from "./fal";
import { falCall, type ImageJob } from "./fal-image";

// fal.ai for the text remover: file upload to fal storage and the VOID video inpainting model.

export const FAL_VOID = "fal-ai/void-video-inpainting";
/** fal price per request with the refinement pass (Nov 2026) — for the cost note only */
export const FAL_VOID_PRICE = 0.1;

/** Upload a file to fal storage; returns a URL the models can read. */
export async function falUpload(apiKey: string, data: Buffer, fileName: string, contentType: string): Promise<string> {
  const init = (await falCall(apiKey, "https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3", {
    method: "POST",
    body: JSON.stringify({ content_type: contentType, file_name: fileName }),
  })) as { upload_url?: string; file_url?: string };
  if (!init.upload_url || !init.file_url) throw new FalError("fal.ai nie przyjął pliku.");
  const res = await fetch(init.upload_url, { method: "PUT", body: new Uint8Array(data), headers: { "Content-Type": contentType }, signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new FalError(`Wysyłanie do fal.ai nie powiodło się (${res.status}).`);
  return init.file_url;
}

/** Repaint the black areas of the mask (VOID: white = keep, black = remove). */
export async function submitVoid(apiKey: string, r: { videoUrl: string; maskUrl: string; prompt: string; frames: number; seed?: number }): Promise<ImageJob> {
  const json = await falCall(apiKey, `https://queue.fal.run/${FAL_VOID}`, {
    method: "POST",
    body: JSON.stringify({
      video_url: r.videoUrl,
      quad_mask_video_url: r.maskUrl,
      prompt: r.prompt,
      negative_prompt: "text, letters, captions, subtitles, words, writing, watermark, logo, dark blob, smudge",
      num_frames: r.frames,
      enable_pass2_refinement: true,
      ...(r.seed !== undefined ? { seed: r.seed } : {}),
    }),
  });
  const { request_id, status_url, response_url } = json as { request_id?: unknown; status_url?: unknown; response_url?: unknown };
  if (typeof request_id !== "string" || typeof status_url !== "string" || typeof response_url !== "string") throw new FalError("fal.ai nie przyjął zlecenia.");
  return { requestId: request_id, statusUrl: status_url, responseUrl: response_url };
}

export function resultVideo(json: Record<string, unknown>): string | null {
  const v = json.video as { url?: unknown } | undefined;
  return v && typeof v.url === "string" ? v.url : null;
}

export async function voidStatus(apiKey: string, job: ImageJob): Promise<{ state: "running" | "done" | "failed"; url?: string; error?: string }> {
  const s = await falCall(apiKey, job.statusUrl);
  const status = String(s.status ?? "");
  if (status === "IN_QUEUE" || status === "IN_PROGRESS") return { state: "running" };
  if (status !== "COMPLETED") return { state: "failed", error: status || "nieznany status" };
  try {
    const url = resultVideo(await falCall(apiKey, job.responseUrl));
    return url ? { state: "done", url } : { state: "failed", error: "brak wideo w odpowiedzi" };
  } catch (e) {
    return { state: "failed", error: e instanceof Error ? e.message : String(e) };
  }
}
