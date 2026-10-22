import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const script: Array<unknown> = [];
const calls: Array<{ messages: Array<{ role: string; content: unknown }>; tool_choice: unknown; tools: Array<{ input_schema: Record<string, unknown> }> }> = [];

vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {
    status?: number;
  }
  class Anthropic {
    static APIError = APIError;
    static AuthenticationError = class extends APIError {};
    static RateLimitError = class extends APIError {};
    static BadRequestError = class extends APIError {};
    messages = {
      create: async (params: (typeof calls)[number]) => {
        calls.push({ ...params, messages: [...params.messages] });
        return script.shift();
      },
    };
  }
  return { default: Anthropic };
});

const { structuredCall, toolSchema } = await import("@/lib/ai/claude");
const { BrandAnalysisSchema } = await import("@/lib/ai/brand");
const { ProductAnalysisSchema } = await import("@/lib/ai/product");
const { ReviewSchema } = await import("@/lib/ai/review");

const Schema = z.object({ name: z.string(), age: z.number() });
const toolReply = (input: unknown) => ({
  stop_reason: "tool_use",
  content: [{ type: "tool_use", id: "tu_1", name: "zapisz_wynik", input }],
});

beforeEach(() => {
  script.length = 0;
  calls.length = 0;
});

describe("structuredCall", () => {
  it("returns validated tool input and forces the result tool", async () => {
    script.push(toolReply({ name: "MAMIQO", age: 3 }));
    const out = await structuredCall({ apiKey: "k", system: "s", content: [{ type: "text", text: "x" }], schema: Schema });
    expect(out).toEqual({ name: "MAMIQO", age: 3 });
    expect(calls[0].tool_choice).toEqual({ type: "tool", name: "zapisz_wynik" });
  });

  it("gives Claude one chance to fix a result that doesn't match the schema", async () => {
    script.push(toolReply({ name: "MAMIQO", age: "trzy" }), toolReply({ name: "MAMIQO", age: 3 }));
    const out = await structuredCall({ apiKey: "k", system: "s", content: [{ type: "text", text: "x" }], schema: Schema });
    expect(out.age).toBe(3);
    const repair = calls[1].messages.at(-1) as { content: Array<{ type: string; is_error: boolean; content: string }> };
    expect(repair.content[0].type).toBe("tool_result");
    expect(repair.content[0].is_error).toBe(true);
    expect(repair.content[0].content).toContain("age");
  });

  it("fails with a readable message after two bad results", async () => {
    script.push(toolReply({ name: 1 }), toolReply({ name: 2 }));
    await expect(structuredCall({ apiKey: "k", system: "s", content: [], schema: Schema })).rejects.toThrow(/złym formacie/);
  });

  it("reports a cut-off answer", async () => {
    script.push({ stop_reason: "max_tokens", content: [] });
    await expect(structuredCall({ apiKey: "k", system: "s", content: [], schema: Schema })).rejects.toThrow(/ucięta/);
  });
});

describe("tool schemas for the real profiles", () => {
  it.each([
    ["brand", BrandAnalysisSchema],
    ["product", ProductAnalysisSchema],
    ["review", ReviewSchema],
  ])("%s converts to a plain JSON Schema object", (_name, schema) => {
    const json = toolSchema(schema) as Record<string, unknown>;
    expect(json.type).toBe("object");
    expect(json.$schema).toBeUndefined();
    expect(Object.keys(json.properties as object).length).toBeGreaterThan(2);
  });
});
