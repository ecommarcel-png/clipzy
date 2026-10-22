import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "./claude";
import type { BrandProfile } from "@/lib/profiles/brand";
import type { ProductSource } from "@/lib/scrape/product";

// Market research before the product profile: Claude searches the web
// (Polish market) for real customer language, competitors' promises, market
// sophistication, objections and unused angles. The report becomes evidence
// for the profile and for the Controller.

export type ResearchReport = {
  report: string;
  sources: Array<{ url: string; title: string }>;
  searches: number;
  created_at: string;
  error?: string;
};

const MAX_SEARCHES = 6;
const MAX_CONTINUATIONS = 3;

const SYSTEM = `Jesteś researcherem rynku dla agencji reklam Meta Ads (rynek polski, e-commerce). Robisz szybki, konkretny research, z którego copywriter zbuduje kąty reklamowe. Szukasz po polsku, w polskim internecie.

Czego szukasz (w tej kolejności):
1. Język klientów — jak ludzie SAMI opisują problem, który rozwiązuje produkt (opinie o tym i podobnych produktach na Allegro, Ceneo, Opineo, w sklepach, na forach, w grupach, w komentarzach). Cytuj krótko, dosłownie.
2. Frustracje i zachwyty — co doprowadza ich do szału, co ich zachwyca w podobnych produktach, co rozczarowuje.
3. Konkurencja — jakie obietnice i komunikaty powtarzają podobne produkty (tytuły aukcji, strony konkurentów). Na tej podstawie oceń poziom wypalenia obietnicy (1–5).
4. Obiekcje — wątpliwości przed zakupem, które przewijają się w pytaniach i opiniach.
5. Niewykorzystane kąty — sytuacje, problemy, grupy kupujących i okazje (np. prezenty, sezon), o których klienci mówią, a konkurencja nie.

Zasady:
- Maksymalnie ${MAX_SEARCHES} wyszukiwań. Celuj w źródła z opiniami i rozmowami klientów, nie w artykuły sponsorowane.
- Każdy fakt i cytat musi wynikać z tego, co znalazłeś. Nie zmyślaj cytatów ani liczb. Jeśli czegoś nie znalazłeś, napisz to wprost.
- Pisz po polsku, zwięźle, w punktach. Bez wstępów.

Format raportu (dokładnie te nagłówki):
## Język klientów
## Frustracje i zachwyty
## Konkurencja i wypalenie obietnicy
## Obiekcje
## Niewykorzystane kąty`;

function userPrompt(brand: BrandProfile, source: ProductSource | null, name: string): string {
  return `Produkt: ${name}
Marka: ${brand.name || "(brak nazwy)"} — ${brand.tagline || brand.niche}
Grupa docelowa marki: ${brand.target_audience.description || "(brak opisu)"}
${source ? `Strona produktu: ${source.url}\nOpis ze strony: ${(source.description ?? "").slice(0, 1500)}` : "Brak strony produktu."}

Zrób research według instrukcji i oddaj raport.`;
}

type Tool = Anthropic.Messages.ToolUnion;

const PL_LOCATION = { type: "approximate", country: "PL", timezone: "Europe/Warsaw" } as const;

const TOOL_VARIANTS: Tool[] = [
  // Dynamic filtering keeps only relevant parts of results in context.
  { type: "web_search_20260318", name: "web_search", max_uses: MAX_SEARCHES, user_location: PL_LOCATION, response_inclusion: "excluded" },
  // Fallback for accounts or models without dynamic filtering.
  { type: "web_search_20250305", name: "web_search", max_uses: MAX_SEARCHES, user_location: PL_LOCATION },
];

export async function researchMarket(
  apiKey: string,
  input: { brand: BrandProfile; source: ProductSource | null; name: string },
): Promise<ResearchReport> {
  // Searching takes longer than a plain call; no automatic retries (cost).
  const client = new Anthropic({ apiKey, maxRetries: 0, timeout: 150_000 });
  let lastError: unknown = null;

  for (const tool of TOOL_VARIANTS) {
    try {
      return await runResearch(client, tool, input);
    } catch (e) {
      lastError = e;
      // Only a rejected tool configuration is worth retrying with the basic tool.
      if (!(e instanceof Anthropic.BadRequestError)) break;
    }
  }

  return {
    report: "",
    sources: [],
    searches: 0,
    created_at: new Date().toISOString(),
    error: researchErrorText(lastError),
  };
}

async function runResearch(
  client: Anthropic,
  tool: Tool,
  input: { brand: BrandProfile; source: ProductSource | null; name: string },
): Promise<ResearchReport> {
  const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: userPrompt(input.brand, input.source, input.name) }];
  let searches = 0;
  const texts: string[] = [];
  const sources = new Map<string, string>();

  for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
    const msg = await client.messages.create({
      model: MODELS.main,
      max_tokens: 10_000,
      system: SYSTEM,
      tools: [tool],
      messages,
    });
    searches += msg.usage.server_tool_use?.web_search_requests ?? 0;
    collect(msg.content, texts, sources);

    // A long search turn can pause; send it back unchanged to continue.
    if (msg.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: msg.content as unknown as Anthropic.Messages.ContentBlockParam[] });
  }

  const report = reportFrom(texts.join(""));
  if (!report) throw new Error("Research nie zwrócił raportu.");
  return {
    report,
    sources: [...sources.entries()].map(([url, title]) => ({ url, title })).slice(0, 20),
    searches,
    created_at: new Date().toISOString(),
  };
}

function collect(content: Anthropic.Messages.ContentBlock[], texts: string[], sources: Map<string, string>) {
  for (const block of content) {
    if (block.type === "text") {
      texts.push(block.text);
      for (const c of block.citations ?? []) {
        if (c.type === "web_search_result_location" && c.url) sources.set(c.url, c.title ?? c.url);
      }
    } else if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
      for (const r of block.content) {
        if (r.type === "web_search_result" && !sources.has(r.url)) sources.set(r.url, r.title);
      }
    }
  }
}

// Keep the report from its first heading on (drops "Zaraz sprawdzę…" chatter).
export function reportFrom(text: string): string {
  const start = text.indexOf("## ");
  return (start >= 0 ? text.slice(start) : text).trim();
}

function researchErrorText(e: unknown): string {
  if (e instanceof Anthropic.BadRequestError && /web search|web_search/i.test(e.message)) {
    return "Wyszukiwanie w internecie jest wyłączone dla Twojego klucza Anthropic (Console → Settings → Capabilities → Web search). Profil powstał bez researchu.";
  }
  if (e instanceof Anthropic.AuthenticationError) return "Klucz Anthropic został odrzucony — research pominięty.";
  if (e instanceof Anthropic.RateLimitError) return "Limit zapytań Anthropic wyczerpany — research pominięty.";
  return `Research się nie udał (${e instanceof Error ? e.message : "nieznany błąd"}). Profil powstał bez researchu.`;
}

export function researchBlock(r: ResearchReport | null | undefined): string {
  if (!r?.report) return "";
  return `<research_rynku>\nNiezależny research polskiego rynku (wyszukiwanie w internecie, ${r.searches} wyszukiwań). Cytaty klientów i obietnice konkurencji stąd są prawdziwe i możesz z nich korzystać.\n\n${r.report}\n\nŹródła:\n${r.sources.map((s) => `- ${s.title}: ${s.url}`).join("\n")}\n</research_rynku>`;
}
