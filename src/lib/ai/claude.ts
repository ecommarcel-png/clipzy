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
const TOO_LONG =
  "Poprzednia odpowiedź przekroczyła limit długości i została ucięta. Oddaj wynik zwięźlej: krótsze zdania, bez powtórzeń, listy bez zbędnych pozycji — ale kompletny i zgodny ze schematem.";

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

// Pull a JSON object out of a plain-text answer (```json fences or the outermost {...}).
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  if (!candidate || !candidate.trim().startsWith("{")) return undefined;
  try {
    return JSON.parse(candidate);
  } catch {
    return undefined;
  }
}

// One structured call: system prompt (cached), user content, Zod-validated output.
// The model is asked to answer through the result tool (forcing a tool isn't
// supported by every model). A plain-JSON answer is accepted too. If the result
// doesn't match the schema, Claude gets one chance to fix it.
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

  let truncatedOnce = false;
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const message = await client.messages.create({
        model: MODELS.main,
        max_tokens: opts.maxTokens ?? 16_000,
        system: [
          { type: "text", text: opts.system, cache_control: { type: "ephemeral" } },
          { type: "text", text: `Odpowiedź oddajesz WYŁĄCZNIE wywołując narzędzie ${RESULT_TOOL} — dokładnie raz, z kompletnym wynikiem. Bez tekstu poza narzędziem.` },
        ],
        messages,
        tools,
        tool_choice: { type: "auto" },
      });

      if (message.stop_reason === "max_tokens") {
        if (attempt > 0 || truncatedOnce) {
          throw new ClaudeError("Odpowiedź modelu była za długa i została ucięta. Spróbuj ponownie.");
        }
        // A cut-off tool call can't be repaired; ask again from scratch for a tighter result.
        truncatedOnce = true;
        messages.splice(0, messages.length, {
          role: "user",
          content: [...opts.content, { type: "text", text: TOO_LONG }],
        });
        attempt--;
        continue;
      }
      if (message.stop_reason === "refusal") {
        throw new ClaudeError("Model odmówił przetworzenia tych danych.");
      }

      const call = message.content.find((b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use" && b.name === RESULT_TOOL);
      const text = message.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      const candidate = call ? call.input : extractJson(text);

      const parsed = candidate === undefined ? null : opts.schema.safeParse(candidate);
      if (parsed?.success) return parsed.data;

      // Show Claude exactly what was wrong and let it resend the result.
      messages.push({ role: "assistant", content: message.content as unknown as ContentBlock[] });
      const problem = parsed
        ? `Wynik nie pasuje do schematu:\n${formatIssues(parsed.error)}`
        : `Nie wywołałeś narzędzia ${RESULT_TOOL}.`;
      const instruction = `${problem}\nWywołaj ${RESULT_TOOL} ponownie z poprawionym, kompletnym wynikiem.`;
      messages.push({
        role: "user",
        content: call
          ? [{ type: "tool_result", tool_use_id: call.id, is_error: true, content: instruction }]
          : [{ type: "text", text: instruction }],
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
