import "server-only";

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
`.trim();

export function knowledgeBlock(skill: string): string {
  if (!skill) return "";
  return `\n\nPoniżej baza wiedzy, według której Clipzy montuje reklamy. Profil ma dostarczyć wszystkiego, czego ta wiedza wymaga (np. profil napisów, emocja produktu, przed/po, efekt WOW, oferta, dowód społeczny):\n\n<baza_wiedzy>\n${skill}\n</baza_wiedzy>`;
}
