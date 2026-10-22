import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Fetch a user-supplied URL from the server without letting it reach
// internal addresses (SSRF): only http(s), public IPs, limited redirects,
// size and time.

export class FetchError extends Error {}

const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 15_000;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 ClipzyBot/1.0";

export function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6 === "::" || v6 === "::1") return true;
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIp(mapped[1]);
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v6);
}

export function normalizeUrl(input: string): URL {
  const trimmed = input.trim();
  const scheme = trimmed.match(/^([a-z][a-z0-9+.-]*):\/\//i)?.[1]?.toLowerCase();
  if (scheme && scheme !== "http" && scheme !== "https") throw new FetchError("Obsługiwane są tylko adresy http(s).");
  const withScheme = scheme ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new FetchError("To nie wygląda na poprawny adres strony.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new FetchError("Obsługiwane są tylko adresy http(s).");
  if (url.username || url.password) throw new FetchError("Adres nie może zawierać loginu ani hasła.");
  return url;
}

async function assertPublicHost(url: URL) {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new FetchError("Ten adres nie jest publiczny.");
  }
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => {
    throw new FetchError(`Nie znaleziono strony ${host}. Sprawdź adres.`);
  });
  if (addresses.length === 0 || addresses.some((a) => isPrivateIp(a.address))) {
    throw new FetchError("Ten adres nie jest publiczny.");
  }
}

export type FetchedPage = { url: string; status: number; contentType: string; body: Buffer };

export async function safeFetch(input: string | URL, opts: { maxBytes?: number; accept?: string } = {}): Promise<FetchedPage> {
  const maxBytes = opts.maxBytes ?? 3_000_000;
  let url = typeof input === "string" ? normalizeUrl(input) : input;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "user-agent": USER_AGENT,
        accept: opts.accept ?? "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "accept-language": "pl-PL,pl;q=0.9,en;q=0.7",
      },
    }).catch((e: unknown) => {
      throw new FetchError(e instanceof Error && e.name === "TimeoutError" ? "Strona odpowiada zbyt wolno." : "Nie udało się połączyć ze stroną.");
    });

    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url);
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new FetchError("Nieobsługiwane przekierowanie.");
      continue;
    }

    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > maxBytes) throw new FetchError("Plik jest zbyt duży.");

    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          throw new FetchError("Plik jest zbyt duży.");
        }
        chunks.push(value);
      }
    }
    return {
      url: url.toString(),
      status: res.status,
      contentType: res.headers.get("content-type") ?? "",
      body: Buffer.concat(chunks),
    };
  }
  throw new FetchError("Zbyt wiele przekierowań.");
}
