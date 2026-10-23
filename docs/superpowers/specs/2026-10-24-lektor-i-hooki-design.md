# Lektor generowany w Clipzy + 5 wersji z różnymi hookami

Data: 2026-10-24 · Status: do akceptacji

## Po co

Dziś użytkownik musi wyjść z Clipzy, napisać skrypt, nagrać lektora w ElevenLabs i wgrać plik.
Każda sklejka daje też tylko jedną wersję, a w Meta Ads najtańszym i najskuteczniejszym testem
jest test hooka (pierwsze ~3 s). Cel: przy tworzeniu sklejki Clipzy samo pisze skrypt, pozwala go
poprawić, generuje lektora wybranym głosem i od razu składa **5 wersji różniących się hookiem**.

## Cele

- Formularz sklejki: „Z lektorem” → **Prześlij plik** (jak dziś) albo **Stwórz lektora**.
- „Stwórz lektora”: wybór głosu (na start jeden: „test”), przycisk **Próbka**, suwak przybliżonej
  długości (10–60 s, domyślnie 30 s).
- Reżyser pisze skrypt sam: **5 hooków** (pierwsze zdanie) + **wspólna reszta** (środek + CTA).
- Proces zatrzymuje się na **karcie skryptu**: edycja, „Napisz od nowa” (z opcjonalną uwagą),
  szacowana długość. Lektor powstaje dopiero po kliknięciu **Generuj lektora**.
- Po wygenerowaniu wszystko idzie dalej jak dziś (brakujące ujęcia, plan, Kontroler), a wynik to
  5 wersji: przełącznik **Hook 1–5** w podglądzie i **Renderuj wszystkie**.
- Przy wgranym pliku też 5 wersji, ale hooki różnią się tylko obrazem i tekstem na ekranie
  (lektor ten sam).

## Poza zakresem (na teraz)

- Zarządzanie listą głosów w ustawieniach (głosy są w kodzie; dojdą później).
- Osobny moduł skryptów/lektorów i ponowne użycie lektora w innej sklejce (lektor zapisuje się
  jako plik projektu; biblioteka lektorów później).
- Wybór liczby wersji (stałe 5; w kodzie stała, łatwo zmienić).
- Publikacja w Meta, automatyczne nazwy reklam.

## Anty-cele

- Nie wydajemy kredytów ElevenLabs bez kliknięcia użytkownika (poza jednorazową próbką głosu).
- Nie blokujemy analizy nagrań na czas pisania/edycji skryptu.
- 5 wersji nie może oznaczać 5× kosztu Claude ani 5× generowania ujęć AI.

## Ograniczenia

- Klucz ElevenLabs użytkownika (BYOK). Głos „Lena Suzuki” to głos z jego konta (PVC), ID nie
  jest znane — szukamy go po nazwie w `GET /v1/voices` przy pierwszym użyciu i zapamiętujemy.
- `POST /v1/text-to-speech/{voice_id}/with-timestamps` (model `eleven_multilingual_v2`,
  `language_code` niewspierany przez ten model — polski wynika z tekstu) zwraca `audio_base64`
  i `alignment` (znaki + czasy startu/końca) → słowa z czasami bez Scribe.
- Limit Vercel 300 s na akcję; 6 krótkich zapytań TTS mieści się z zapasem.
- Akcje serwera z jednej karty idą po kolei — równoległość tylko wewnątrz jednej akcji.

## Podejścia (rozważone)

| | Opis | Za | Przeciw |
|---|---|---|---|
| **A (wybrane)** | Skrypt i lektor jako kroki tej samej sklejki; pipeline staje na karcie skryptu | jeden ekran, analiza nagrań idzie w tle | skrypt związany z jedną sklejką |
| B | Osobny moduł „Skrypty i lektor” na stronie produktu, sklejka wybiera gotowego lektora | ponowne użycie | więcej klikania, dwa miejsca |
| C | Lektor od razu, bez zatrzymania | najszybciej | użytkownik chce najpierw widzieć skrypt — odrzucone |

Użytkownik wybrał **A**.

## Jak to działa

### Głosy (`src/lib/voices.ts`)

```ts
{ id: "test", label: "test", elevenName: "Lena Suzuki", model: "eleven_multilingual_v2",
  settings: { speed: 1.1, stability: 0.5, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true },
  wordsPerSecond: 2.6 }
```

- Rozwiązanie ID: po nazwie z `GET /v1/voices` konta użytkownika przy każdej próbce/generowaniu
  (jedno tanie zapytanie; bez nowej tabeli). Znalezione ID zapisujemy w `settings.voice_id`
  projektu. Błąd czytelny: „Nie znalazłem głosu „Lena Suzuki” w Twoim koncie ElevenLabs”.
- **Próbka**: jedno zdanie („Cześć! Tak brzmi lektor Twoich reklam w Clipzy.”), generowane raz na
  użytkownika i głos, zapis `${userId}/voices/${voiceId}-probka.mp3`; kolejne odsłuchy z pliku.

### Formularz nowej sklejki

- „Z lektorem” → dwa kafelki: **Prześlij plik** / **Stwórz lektora**.
- „Stwórz lektora”: lista głosów (nazwa + ▶ Próbka), suwak „Długość ok. X s” (10–60, krok 5).
- Zapis w `settings`: `voiceover_mode: "upload" | "generate"`, `voice: "test"`, `target_seconds`.
- Studio dla „generate” nie pokazuje przycisku „+ Lektor”.

### Pipeline (`steps.ts`)

Kolejność: analiza nagrań → **skrypt** → (pauza) → **lektor** → brakujące ujęcia → plan → koniec.

- Nowe stany `PipelineState.voiceover`: `"script_needed" | "script_ready"` (obok `none|pending|done|error`).
- `script_needed` → krok `script` (akcja `scriptAction`): Claude pisze skrypt.
- `script_ready` → pętla kończy się stanem **„czeka na Ciebie”** (bez błędu); UI pokazuje kartę.
- „Generuj lektora” → akcja `generateVoiceoverAction` → potem pętla rusza dalej sama.

### Skrypt (Claude, `src/lib/ai/script.ts`)

- Wejście: profil marki i produktu (kąty, problemy, obiekcje), research, analiza nagrań (co jest
  nagrane — żeby zdania miały pokrycie w obrazie), baza wiedzy (`skrypty-i-hooki`, sklejki,
  poziomy świadomości), uwagi użytkownika, docelowa liczba słów = `target_seconds × wordsPerSecond`.
- Wyjście (Zod): `{ angle, hooks: [{ text, idea }] ×5, body, notes }`.
  - hook: jedno zdanie ≤ 10 słów, 5 **różnych typów** (np. pytanie, efekt/WOW, ból, obalenie mitu,
    liczba/konkret) — bez zmyślonych liczb; `idea` = krótka wskazówka obrazu dla Reżysera.
  - body: wspólna reszta zaczynająca się tak, by pasowała po każdym hooku; kończy się CTA.
- Nazwa marki dokładnie jak w profilu; zapis w `clip_projects.voiceover = { mode: "generate",
  script: {...}, status: "script_ready" }` (nowa gałąź tego JSON-a, bez migracji).
- Karta skryptu: 5 pól hooków + pole reszty, licznik „~N s”, **Napisz od nowa** (z polem uwagi),
  **Generuj lektora**. Edycja zapisuje się przy kliknięciu Generuj.

### Generowanie lektora (`src/lib/ai/tts.ts` + pipeline)

- 6 zapytań TTS (5 hooków + reszta) w jednej akcji, równolegle po 3; `previous_text`/`next_text`
  dla płynności (hook ↔ początek reszty).
- Dla każdej wersji k: ffmpeg skleja `hook_k + 0,15 s ciszy + reszta` → `vo-hook-k.wav`
  (normalizacja głośności jak dziś) → zapis jako asset `voiceover` z `meta.variant = k`.
- Słowa: z `alignment` (znaki → słowa po spacjach), przesunięte o długość hooka + przerwę;
  dalej istniejące `tighten` (skraca za długie pauzy) i `captionChunks`.
- `project.voiceover` dostaje `variants: [{ asset_id, words, timeline, captions, hookEnd }]`;
  dotychczasowe pola (`asset_id, text, words, timeline, captions`) = wersja 1, żeby reszta kodu
  działała bez zmian.

### Plan z 5 hookami

- Jedno wywołanie Reżysera (bez 5× kosztu). Schemat planu rozszerzony:
  `hooks: [{ shots, overlays }] ×5` (czas względny od 0 do końca hooka danej wersji) +
  istniejące `shots/overlays` = **część wspólna** (czas względny od końca hooka).
- Czysta funkcja `composeVariant(plan, voVariant, k) → EditPlan` (pełna oś czasu jak dziś),
  potem `sanitizePlan`. Kontroler sprawdza wersję 1 + listę hooków (jedno wywołanie).
- Zasada dla Reżysera: każdy hook ma **inne otwarcie obrazu** (inne ujęcie/efekt), nie tylko inny
  tekst; ujęcia AI z biblioteki wolno użyć w kilku hookach.
- Tryb „upload”: hook = pierwsza fraza lektora (do ~3 s), ta sama długość we wszystkich
  wersjach; różni się obraz + duży tekst-hook na ekranie (`text_plates` w obrębie hooka).

### Podgląd, poprawki, render

- Przełącznik **Hook 1 · 2 · 3 · 4 · 5** nad podglądem (tekst hooka jako podpowiedź).
- Szybkie poprawki działają na wybranej wersji: zmiany w ujęciach hooka dotyczą tylko jej,
  zmiany części wspólnej, napisów, muzyki, głośności i koloru — wszystkich wersji.
- **Renderuj wszystkie**: po kolei 5 wersji × wybrany format, pobieranie po każdej
  (`Depli-4x5-hook1.mp4` …), pasek „Wersja 2/5”. Pojedynczy render nadal dostępny.
- Lista gotowych plików grupuje rendery po wersji hooka.

### Koszty (szacunek na sklejkę)

- Claude: skrypt ~$0,05–0,1; plan z 5 hookami ~+$0,2 względem dziś.
- ElevenLabs: ~1–1,3 tys. znaków (5 hooków + reszta) zamiast ~0,5–0,9 tys. — kredyty z planu
  użytkownika; Scribe niepotrzebny w trybie „generate”.
- Render: 5× czas w przeglądarce (~40 s na wersję i format).

## Decyzje użytkownika

- Podejście A.
- Skrypt powstaje sam, jest edytowalny, lektor dopiero po „Generuj lektora”.
- Przy głosach przycisk „Próbka”.
- Głos „test” = ustawienia z ElevenLabs (Lena Suzuki, Multilingual v2, speed 1,10,
  stability 50%, similarity 75%, style 15%, speaker boost).
- Suwak długości ±, max 60 s.
- 5 wersji z różnymi hookami.

## Decyzje Claude (do sprawdzenia przy czytaniu)

- Próbka generowana raz i zapisywana (oszczędza kredyty).
- 5 hooków = 5 różnych typów hooka, nie 5 przeróbek jednego.
- Hooki i reszta nagrywane osobno i sklejane (zamiast 5 pełnych nagrań) — taniej i reszta brzmi
  identycznie we wszystkich wersjach.
- Analiza nagrań przed skryptem, żeby skrypt pasował do tego, co nagrano.
- Szybkie poprawki: hook per wersja, reszta wspólna.
- Tryb „upload” też daje 5 wersji (różnica tylko w obrazie i tekście).

## Doprecyzowania (decyzje Claude po przeglądzie)

- Zgodność wstecz: sklejki bez `variants`/`hooks` działają jak dziś (jedna wersja, bez przełącznika).
- Tryb „upload”: koniec hooka = koniec pierwszych fraz lektora, między 1,2 a 3,5 s.
- Granica hook/reszta jest stała: szybkie poprawki nie przesuwają cięcia przez tę granicę,
  „Usuń” w hooku oddaje czas sąsiedniemu ujęciu hooka.
- Feedback „Co zmienić?” poprawia wszystkie wersje naraz (jeden plan z hookami).
- Kontroler Gemini po renderze: automatycznie ocenia tylko pierwszy render z paczki, pozostałe
  na żądanie („Sprawdź”) — żeby nie mnożyć kosztów.
- Lektory wygenerowane nie trafiają (jeszcze) do biblioteki materiałów.

## Dla wykonawcy

- Dokładne prompty skryptu i hooków (oprzeć o `knowledge/meta-ads/references/skrypty-i-hooki.md`).
- Szczegóły UI kart (spójnie z obecnym designem: `Card`, `Disclosure`, przyciski rounded-full).
- Testy: `composeVariant`, słowa z `alignment`, `nextStep` z nowymi stanami, licznik długości.
- Obsługa braku głosu, błędów ElevenLabs (401, limit znaków) — komunikaty po polsku.
