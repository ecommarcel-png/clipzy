import "server-only";
import { knowledgeText, type KnowledgeDoc } from "@/lib/knowledge";
import type { ReviewIssue } from "./review";

// Shared rules for building brand and product profiles.
export const PROFILE_RULES = `
Zasady pracy nad profilem:
- Piszesz wyłącznie po polsku.
- Nie zgadujesz faktów. Jeśli czegoś nie da się wyczytać ze źródeł ani z odpowiedzi użytkownika, zostaw pole puste (pusty tekst / pusta lista) i zadaj pytanie.
- Rozróżniasz fakty (ze strony, z odpowiedzi) od wniosków. Wnioski są dozwolone tam, gdzie wynikają jasno ze źródeł (np. ton komunikacji z tekstów na stronie), ale ważne wnioski potwierdzasz pytaniem.
- Odpowiedzi użytkownika mają pierwszeństwo przed tym, co wyczytałeś ze strony. Ręczne poprawki użytkownika w profilu są nienaruszalne — nie nadpisuj ich, chyba że odpowiedź na pytanie wprost je zmienia.
- Pytania: konkretne, jedno zagadnienie na pytanie, maksymalnie 8 w jednej rundzie, od najważniejszych. Pytaj tylko o to, co realnie wpłynie na jakość reklam (grupa docelowa, problem, ton, ograniczenia, dowody, oferta). Do pytań dodawaj 0–4 propozycje odpowiedzi, jeśli to ułatwia.
- Nie pytaj ponownie o rzeczy, na które użytkownik już odpowiedział.
- Kompletność (0–100): jak bardzo profil wystarcza, żeby tworzyć reklamy bez zgadywania. 90+ tylko gdy nie ma już ważnych luk. Gdy kompletność ≥ 90, lista pytań może być pusta.
- "summary" to 1–3 zdania dla użytkownika: co już wiesz i czego jeszcze brakuje.
- Twój wynik sprawdzi niezależny Kontroler według listy kontrolnej z bazy wiedzy „Reżyser Clipzy” — pracuj tak, żeby nie miał czego zgłosić.
`.trim();

export function knowledgeBlock(docs: KnowledgeDoc[]): string {
  if (!docs.length) return "";
  return `\n\nPoniżej baza wiedzy Clipzy. Profil ma dostarczyć wszystkiego, czego ta wiedza wymaga od marki i produktu (np. profil napisów, emocja produktu, przed/po, efekt WOW, unikalny mechanizm, poziom wypalenia rynku, oferta, dowód społeczny):\n\n${knowledgeText(docs)}`;
}

// Extra instructions for a correction round after the Controller's review.
export function controlIssuesBlock(issues: ReviewIssue[]): string {
  if (!issues.length) return "";
  return `\n\n<uwagi_kontrolera>\nNiezależny Kontroler sprawdził profil i zgłosił poniższe usterki. Popraw wszystkie krytyczne i ważne (drobne — jeśli to proste). Jeśli usterka dotyczy niepotwierdzonego faktu, usuń go z profilu i zadaj pytanie zamiast zgadywać. Nie wprowadzaj nowych niepotwierdzonych informacji.\n${JSON.stringify(issues, null, 1)}\n</uwagi_kontrolera>`;
}
