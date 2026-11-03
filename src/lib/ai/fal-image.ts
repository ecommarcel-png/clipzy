import "server-only";
import { FalError } from "./fal";

// fal.ai images for image ads: nano-banana-2 (scene/packshot, product photos as reference)
// and BiRefNet (product without background).

export const FAL_IMAGE = "fal-ai/nano-banana-2";
export const FAL_IMAGE_EDIT = "fal-ai/nano-banana-2/edit";
export const FAL_CUTOUT = "fal-ai/birefnet/v2";
/** approximate price of one 2K image (fal, Nov 2026) — for the cost note only */
export const FAL_IMAGE_PRICE = 0.12;

export type ImageJob = { requestId: string; statusUrl: string; responseUrl: string };
export type ImageStatus = { state: "queued" | "running" | "done" | "failed"; url?: string; error?: string };

async function call(apiKey: string, url: string, init?: RequestInit, timeout = 60_000) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Key ${apiKey}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(timeout),
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON error page */
  }
  if (res.status === 401 || res.status === 403) throw new FalError("Klucz fal.ai został odrzucony albo nie ma uprawnień do generowania.");
  if (res.status === 402 || /exhausted balance|insufficient (funds|balance)|credit/i.test(text)) throw new FalError("Brak środków na koncie fal.ai.");
  if (!res.ok) throw new FalError(`fal.ai (${res.status}): ${detail(json) ?? text.slice(0, 200)}`);
  return json;
}

function detail(json: Record<string, unknown>): string | null {
  const d = json.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d.length) return d.map((x) => (typeof x === "object" && x && "msg" in x ? String((x as { msg: unknown }).msg) : String(x))).join("; ");
  return null;
}

/** First image URL in a fal result (nano-banana: images[], birefnet: image). */
export function resultImage(json: Record<string, unknown>): string | null {
  const images = json.images;
  if (Array.isArray(images) && images[0] && typeof images[0] === "object" && typeof (images[0] as { url?: unknown }).url === "string") return (images[0] as { url: string }).url;
  const image = json.image as { url?: unknown } | undefined;
  return image && typeof image.url === "string" ? image.url : null;
}

export async function submitImage(apiKey: string, r: { prompt: string; imageUrls?: string[] }): Promise<ImageJob> {
  const refs = (r.imageUrls ?? []).slice(0, 10);
  const endpoint = refs.length ? FAL_IMAGE_EDIT : FAL_IMAGE;
  const body: Record<string, unknown> = { prompt: r.prompt, num_images: 1, aspect_ratio: "1:1", resolution: "2K", output_format: "jpeg", safety_tolerance: "5" };
  if (refs.length) body.image_urls = refs;
  const json = await call(apiKey, `https://queue.fal.run/${endpoint}`, { method: "POST", body: JSON.stringify(body) });
  const { request_id, status_url, response_url } = json as { request_id?: unknown; status_url?: unknown; response_url?: unknown };
  if (typeof request_id !== "string" || typeof status_url !== "string" || typeof response_url !== "string") throw new FalError("fal.ai nie przyjął zlecenia na zdjęcie.");
  return { requestId: request_id, statusUrl: status_url, responseUrl: response_url };
}

export async function imageStatus(apiKey: string, job: ImageJob): Promise<ImageStatus> {
  const s = await call(apiKey, job.statusUrl);
  const status = String(s.status ?? "");
  if (status === "IN_QUEUE") return { state: "queued" };
  if (status === "IN_PROGRESS") return { state: "running" };
  if (status !== "COMPLETED") return { state: "failed", error: status || "nieznany status" };
  try {
    const url = resultImage(await call(apiKey, job.responseUrl));
    return url ? { state: "done", url } : { state: "failed", error: "brak obrazu w odpowiedzi" };
  } catch (e) {
    // e.g. a request blocked by the safety filter reports COMPLETED with an error body
    return { state: "failed", error: e instanceof Error ? e.message : String(e) };
  }
}

/** Product photo without background (PNG with alpha). */
export async function cutout(apiKey: string, imageUrl: string): Promise<string> {
  const json = await call(apiKey, `https://fal.run/${FAL_CUTOUT}`, { method: "POST", body: JSON.stringify({ image_url: imageUrl, output_format: "png" }) }, 120_000);
  const url = resultImage(json);
  if (!url) throw new FalError("fal.ai nie zwrócił wyciętego produktu.");
  return url;
}
