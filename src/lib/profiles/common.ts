import { z } from "zod";

// An optional follow-up question. Claude asks one only when the answer can't be
// inferred and would clearly change the ads (see PROFILE_RULES).
export const QuestionSchema = z.object({
  id: z.string().describe("Krótki, unikalny identyfikator, np. 'q_grupa_wiek'."),
  field: z.string().describe("Którego pola profilu dotyczy (ścieżka, np. 'target_audience.age_from')."),
  question: z.string().describe("Pytanie po polsku, konkretne, jedno na raz."),
  why: z.string().describe("Jedno zdanie: dlaczego to ważne dla reklam."),
  suggestions: z.array(z.string()).describe("2-4 propozycje odpowiedzi do kliknięcia."),
});
export type Question = z.infer<typeof QuestionSchema>;

export type AnsweredQuestion = Question & { answer: string };

// UI description of a profile field, used to render the editable form.
// `more` fields sit behind "Więcej pól" inside their section — rarely edited.
type FieldBase = { path: string; label: string; hint?: string; more?: boolean };
export type FieldDef =
  | (FieldBase & { type: "text" | "textarea" | "number" | "color" })
  | (FieldBase & { type: "list" })
  | (FieldBase & { type: "select"; options: Array<{ value: string; label: string }> })
  | (FieldBase & { type: "boolean" })
  | (FieldBase & { type: "records"; keys: string[]; labels: string[]; addLabel?: string });

// `collapsed` sections sit behind "Zaawansowane" — filled automatically, rarely edited.
export type FieldSection = { title: string; description?: string; collapsed?: boolean; fields: FieldDef[] };

export function getAt(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined), obj);
}

export function setAt<T>(obj: T, path: string, value: unknown): T {
  const keys = path.split(".");
  const root: Record<string, unknown> = structuredClone((obj ?? {}) as Record<string, unknown>);
  let cur = root;
  keys.slice(0, -1).forEach((k) => {
    if (!cur[k] || typeof cur[k] !== "object") cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  });
  cur[keys[keys.length - 1]] = value;
  return root as T;
}

// Drop blank lines from string lists (the list textarea keeps them while typing).
export function cleanLists<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "string" ? v.trim() : cleanLists(v)))
      .filter((v) => !(typeof v === "string" && v === "")) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, cleanLists(v)])) as T;
  }
  return value;
}

// Merge stored (possibly partial / older-version) profile data over defaults.
export function withDefaults<T extends Record<string, unknown>>(defaults: T, data: unknown): T {
  if (!data || typeof data !== "object") return structuredClone(defaults);
  const out: Record<string, unknown> = structuredClone(defaults);
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    const d = (defaults as Record<string, unknown>)[k];
    out[k] = d && typeof d === "object" && !Array.isArray(d) && v && typeof v === "object" && !Array.isArray(v)
      ? withDefaults(d as Record<string, unknown>, v)
      : v;
  }
  return out as T;
}
