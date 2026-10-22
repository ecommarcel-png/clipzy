import "server-only";
import { MissingKeyError } from "@/lib/api-keys";
import { ClaudeError } from "@/lib/ai/claude";
import { FetchError } from "@/lib/scrape/safe-fetch";

// Turn known failures into messages a user can act on; hide the rest.
export function userMessage(e: unknown): string {
  if (e instanceof MissingKeyError || e instanceof ClaudeError || e instanceof FetchError) return e.message;
  console.error(e);
  return "Coś poszło nie tak. Spróbuj ponownie za chwilę.";
}
