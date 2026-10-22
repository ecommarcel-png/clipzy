import { beforeEach, describe, expect, it, vi } from "vitest";

// Scripted stand-in for the Anthropic SDK: each create() returns the next response.
const script: Array<unknown> = [];
const calls: Array<{ tools: Array<{ type: string }>; messages: unknown[] }> = [];

vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {}
  class BadRequestError extends APIError {}
  class AuthenticationError extends APIError {}
  class RateLimitError extends APIError {}
  class Anthropic {
    static APIError = APIError;
    static BadRequestError = BadRequestError;
    static AuthenticationError = AuthenticationError;
    static RateLimitError = RateLimitError;
    messages = {
      create: async (params: { tools: Array<{ type: string }>; messages: unknown[] }) => {
        calls.push({ tools: params.tools, messages: [...params.messages] });
        const next = script.shift();
        if (next instanceof Error) throw next;
        return next;
      },
    };
  }
  return { default: Anthropic };
});

const { researchMarket, reportFrom, researchBlock } = await import("@/lib/ai/research");
const Anthropic = (await import("@anthropic-ai/sdk")).default as unknown as { BadRequestError: new (m: string) => Error };
const { EMPTY_BRAND_PROFILE } = await import("@/lib/profiles/brand");

const input = { brand: { ...EMPTY_BRAND_PROFILE, name: "MAMIQO" }, source: null, name: "Organizer" };

const message = (content: unknown[], stop: string, searches = 1) => ({
  content,
  stop_reason: stop,
  usage: { server_tool_use: { web_search_requests: searches } },
});

beforeEach(() => {
  script.length = 0;
  calls.length = 0;
});

describe("researchMarket", () => {
  it("continues a paused turn and collects the report and sources", async () => {
    script.push(
      message([{ type: "text", text: "Sprawdzę opinie. " }], "pause_turn", 3),
      message(
        [
          {
            type: "text",
            text: "## Język klientów\n- „ręce mam zawsze zajęte”",
            citations: [{ type: "web_search_result_location", url: "https://allegro.pl/x", title: "Opinie Allegro", cited_text: "..." }],
          },
        ],
        "end_turn",
        2,
      ),
    );
    const r = await researchMarket("key", input);
    expect(calls).toHaveLength(2);
    expect(calls[1].messages).toHaveLength(2); // the paused assistant turn was sent back
    expect(r.report.startsWith("## Język klientów")).toBe(true);
    expect(r.report).not.toContain("Sprawdzę opinie");
    expect(r.sources).toEqual([{ url: "https://allegro.pl/x", title: "Opinie Allegro" }]);
    expect(r.searches).toBe(5);
    expect(r.error).toBeUndefined();
  });

  it("falls back to the basic web search tool when the first one is rejected", async () => {
    script.push(new Anthropic.BadRequestError("allowed_callers not supported"), message([{ type: "text", text: "## Obiekcje\n- cena" }], "end_turn"));
    const r = await researchMarket("key", input);
    expect(calls.map((c) => c.tools[0].type)).toEqual(["web_search_20260318", "web_search_20250305"]);
    expect(r.report).toContain("## Obiekcje");
  });

  it("never throws — a failed research returns an error the UI can show", async () => {
    script.push(new Error("network down"));
    const r = await researchMarket("key", input);
    expect(r.report).toBe("");
    expect(r.error).toMatch(/Research się nie udał/);
  });

  it("explains when web search is disabled for the account", async () => {
    script.push(new Anthropic.BadRequestError("web search is not enabled"), new Anthropic.BadRequestError("web search is not enabled"));
    const r = await researchMarket("key", input);
    expect(r.error).toMatch(/Web search/);
  });
});

describe("report helpers", () => {
  it("drops chatter before the first heading", () => {
    expect(reportFrom("Zaraz sprawdzę...\n\n## Język klientów\n- a")).toBe("## Język klientów\n- a");
  });

  it("turns a report into evidence, and nothing into nothing", () => {
    expect(researchBlock(null)).toBe("");
    const block = researchBlock({ report: "## A", sources: [{ url: "https://x.pl", title: "X" }], searches: 2, created_at: "" });
    expect(block).toContain("<research_rynku>");
    expect(block).toContain("https://x.pl");
  });
});
