import "server-only";

// fal.ai queue API — Seedance 2.5 for missing shots (problem, product in use).
export class FalError extends Error {}

export const FAL_T2V = "bytedance/seedance-2.5/text-to-video";
export const FAL_REF = "bytedance/seedance-2.5/reference-to-video";
const QUEUE = "https://queue.fal.run";
const QUEUE_APP = "bytedance/seedance-2.5"; // status/result live under the app id

// Approximate price per second at 720p (fal pricing, Oct 2026) — for the report only.
export const FAL_PRICE_PER_S = { t2v: 0.47, reference: 0.47 } as const;

async function call(apiKey: string, url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Key ${apiKey}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON error page */
  }
  if (res.status === 401 || res.status === 403) throw new FalError("Klucz fal.ai został odrzucony albo nie ma uprawnień do generowania.");
  if (res.status === 402 || /balance|credit/i.test(text)) throw new FalError("Brak środków na koncie fal.ai.");
  if (!res.ok) throw new FalError(`fal.ai (${res.status}): ${text.slice(0, 200)}`);
  return json as Record<string, unknown>;
}

export type GenRequest = { prompt: string; duration: number; mode: "t2v" | "reference"; imageUrls?: string[] };

export async function submitShot(apiKey: string, r: GenRequest): Promise<string> {
  const body: Record<string, unknown> = {
    prompt: r.prompt,
    duration: String(Math.min(10, Math.max(4, Math.round(r.duration)))),
    resolution: "720p",
    aspect_ratio: "9:16",
    generate_audio: false,
  };
  let endpoint = FAL_T2V;
  if (r.mode === "reference" && r.imageUrls?.length) {
    endpoint = FAL_REF;
    body.task = "reference";
    body.image_urls = r.imageUrls.slice(0, 6);
  }
  const json = await call(apiKey, `${QUEUE}/${endpoint}`, { method: "POST", body: JSON.stringify(body) });
  const id = json.request_id;
  if (typeof id !== "string") throw new FalError("fal.ai nie przyjął zlecenia.");
  return id;
}

export type GenStatus = { state: "queued" | "running" | "done" | "failed"; url?: string; error?: string };

export async function shotStatus(apiKey: string, requestId: string): Promise<GenStatus> {
  const s = await call(apiKey, `${QUEUE}/${QUEUE_APP}/requests/${requestId}/status`);
  const status = String(s.status ?? "");
  if (status === "IN_QUEUE") return { state: "queued" };
  if (status === "IN_PROGRESS") return { state: "running" };
  if (status !== "COMPLETED") return { state: "failed", error: status };
  try {
    const r = await call(apiKey, `${QUEUE}/${QUEUE_APP}/requests/${requestId}`);
    const url = (r.video as { url?: string } | undefined)?.url;
    return url ? { state: "done", url } : { state: "failed", error: "brak wideo w odpowiedzi" };
  } catch (e) {
    // a request that failed validation reports COMPLETED with an error body
    return { state: "failed", error: e instanceof Error ? e.message : String(e) };
  }
}
