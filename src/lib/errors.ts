import "server-only";
import { MissingKeyError } from "@/lib/api-keys";
import { ClaudeError } from "@/lib/ai/claude";
import { FetchError } from "@/lib/scrape/safe-fetch";
import { GeminiError } from "@/lib/ai/gemini";
import { ScribeError } from "@/lib/ai/scribe";
import { FalError } from "@/lib/ai/fal";

// A message written for the user (Polish, actionable) — safe to show as is.
export class UserError extends Error {}

// Turn known failures into messages a user can act on; hide the rest.
export function userMessage(e: unknown): string {
  if (
    e instanceof MissingKeyError || e instanceof ClaudeError || e instanceof FetchError || e instanceof UserError ||
    e instanceof GeminiError || e instanceof ScribeError || e instanceof FalError
  ) {
    return e.message;
  }
  console.error(e);
  return "Coś poszło nie tak. Spróbuj ponownie za chwilę.";
}
