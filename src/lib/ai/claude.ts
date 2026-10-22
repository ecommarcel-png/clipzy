import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

// Claude is the brain of Clipzy. Model choice lives here so it can change in one place.
export const MODELS = {
  // Profiles, scripts, edit plans: quality matters more than speed.
  main: process.env.CLAUDE_MODEL_MAIN ?? "claude-sonnet-5-5",
} as const;

export class ClaudeError extends Error {}

export function claudeClient(apiKey: string) {
  // One retry keeps the worst case inside the 300 s page limit (scraping included).
  return new Anthropic({ apiKey, maxRetries: 1, timeout: 120_000 });
}

type ContentBlock = Anthropic.Messages.ContentBlockParam;

// One structured call: system prompt (cached), user content, Zod-validated output.
export async function structuredCall<S extends z.ZodType>(opts: {
  apiKey: string;
  system: string;
  content: ContentBlock[];
  schema: S;
  maxTokens?: number;
}): Promise<z.infer<S>> {
  const client = claudeClient(opts.apiKey);
  try {
    const message = await client.messages.parse({
      model: MODELS.main,
      max_tokens: opts.maxTokens ?? 12_000,
      system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: opts.content }],
      output_config: { format: zodOutputFormat(opts.schema) },
    });
    if (message.stop_reason === "max_tokens") {
      throw new ClaudeError("Odpowiedź modelu została ucięta. Spróbuj ponownie.");
    }
    if (message.stop_reason === "refusal") {
      throw new ClaudeError("Model odmówił przetworzenia tych danych.");
    }
    if (!message.parsed_output) throw new ClaudeError("Model nie zwrócił poprawnej odpowiedzi.");
    return message.parsed_output as z.infer<S>;
  } catch (e) {
    if (e instanceof ClaudeError) throw e;
    if (e instanceof Anthropic.AuthenticationError) {
      throw new ClaudeError("Klucz Anthropic został odrzucony. Sprawdź go w Ustawieniach.");
    }
    if (e instanceof Anthropic.RateLimitError) {
      throw new ClaudeError("Limit zapytań Anthropic wyczerpany. Odczekaj chwilę albo sprawdź saldo konta.");
    }
    if (e instanceof Anthropic.APIError) {
      throw new ClaudeError(`Błąd Anthropic (${e.status ?? "?"}): ${e.message}`);
    }
    throw new ClaudeError(e instanceof Error ? e.message : "Nieznany błąd połączenia z Claude.");
  }
}
