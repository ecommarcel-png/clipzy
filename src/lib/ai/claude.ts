import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

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

const RESULT_TOOL = "zapisz_wynik";

// JSON Schema for the tool input. Profiles are too big for strict structured
// outputs (the API refuses to compile the grammar), so the schema is sent as
// a regular tool and the result is validated here with Zod instead.
export function toolSchema(schema: z.ZodType): Anthropic.Messages.Tool.InputSchema {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { $schema, ...json } = z.toJSONSchema(schema) as Record<string, unknown>;
  return json as Anthropic.Messages.Tool.InputSchema;
}

export function formatIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 15)
    .map((i) => `- ${i.path.join(".") || "(całość)"}: ${i.message}`)
    .join("\n");
}

// One structured call: system prompt (cached), user content, Zod-validated output.
// If the output doesn't match the schema, Claude gets one chance to fix it.
export async function structuredCall<S extends z.ZodType>(opts: {
  apiKey: string;
  system: string;
  content: ContentBlock[];
  schema: S;
  maxTokens?: number;
}): Promise<z.infer<S>> {
  const client = claudeClient(opts.apiKey);
  const tools: Anthropic.Messages.Tool[] = [
    {
      name: RESULT_TOOL,
      description: "Zapisz końcowy wynik. Wywołaj to narzędzie dokładnie raz, z kompletnym wynikiem zgodnym ze schematem.",
      input_schema: toolSchema(opts.schema),
    },
  ];
  const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: opts.content }];

  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const message = await client.messages.create({
        model: MODELS.main,
        max_tokens: opts.maxTokens ?? 16_000,
        system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
        messages,
        tools,
        tool_choice: { type: "tool", name: RESULT_TOOL },
      });

      if (message.stop_reason === "max_tokens") {
        throw new ClaudeError("Odpowiedź modelu była za długa i została ucięta. Spróbuj ponownie.");
      }
      if (message.stop_reason === "refusal") {
        throw new ClaudeError("Model odmówił przetworzenia tych danych.");
      }

      const call = message.content.find((b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use" && b.name === RESULT_TOOL);
      if (!call) throw new ClaudeError("Model nie zwrócił wyniku.");

      const parsed = opts.schema.safeParse(call.input);
      if (parsed.success) return parsed.data;

      // Show Claude exactly what didn't match and let it resend the result.
      messages.push({ role: "assistant", content: message.content as unknown as ContentBlock[] });
      messages.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: call.id,
            is_error: true,
            content: `Wynik nie pasuje do schematu:\n${formatIssues(parsed.error)}\nWywołaj ${RESULT_TOOL} ponownie z poprawionym, kompletnym wynikiem.`,
          },
        ],
      });
    }
    throw new ClaudeError("Model dwa razy zwrócił wynik w złym formacie. Spróbuj ponownie.");
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
