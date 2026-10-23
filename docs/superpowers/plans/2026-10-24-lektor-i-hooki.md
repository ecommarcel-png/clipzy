# Lektor generowany + 5 hooków — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Przy tworzeniu sklejki Clipzy pisze skrypt (5 hooków + wspólna reszta), po akceptacji generuje lektora w ElevenLabs i składa 5 wersji reklamy z różnymi hookami.

**Architecture:** Nowe kroki w istniejącym pipeline (`steps.ts` → `pipelineStateAction` → pętla w `studio.tsx`): `script` (Claude) → pauza na karcie skryptu → `generateVoiceoverAction` (6× TTS z czasami, sklejenie ffmpeg w 5 lektorów). Plan Reżysera = pełna oś wersji 1 (`plan.shots`) + `plan.hooks` (4 alternatywne otwarcia); czysta funkcja `composeVariant` składa wersję k.

**Tech Stack:** Next.js 16 server actions, Supabase, ElevenLabs REST (`/v1/voices`, `/v1/text-to-speech/{id}/with-timestamps`), ffmpeg-static, Zod 4, Remotion web renderer, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-24-lektor-i-hooki-design.md`

## Global Constraints

- Głos „test”: `elevenName: "Lena Suzuki"`, `model: "eleven_multilingual_v2"`, `speed 1.1, stability 0.5, similarity_boost 0.75, style 0.15, use_speaker_boost true`, `wordsPerSecond 2.6`.
- Suwak długości: 10–60 s, krok 5, domyślnie 30.
- Liczba wersji: stała `HOOK_VARIANTS = 5`.
- Przerwa hook → reszta: 0,15 s ciszy.
- Tryb „upload”: koniec hooka między 1,2 a 3,5 s.
- Kredyty ElevenLabs tylko po kliknięciu (wyjątek: jednorazowa próbka głosu na użytkownika).
- Komunikaty dla użytkownika po polsku; nazwa marki zawsze przez `fixBrandName`.
- Zgodność wstecz: projekty bez `voiceover.variants` / `plan.hooks` = jedna wersja jak dziś.

## Review Focus

- Skrypt edytowany do pustego hooka → „Generuj lektora” pomija puste hooki (wersji mniej niż 5), nie wysyła pustego tekstu do TTS.
- Głos nie istnieje w koncie ElevenLabs → czytelny błąd „Nie znalazłem głosu „Lena Suzuki” w Twoim koncie ElevenLabs”, pipeline nie wpada w pętlę.
- Wyjście poza limit (401 / brak kredytów ElevenLabs) → komunikat z kodem, skrypt zostaje zapisany.
- Przeładowanie strony na karcie skryptu → karta wraca, pętla nie rusza sama dalej.
- Wersja k z hookiem dłuższym niż hook 1 → część wspólna przesunięta, bez nakładania ujęć i bez dziur (test `composeVariant`).

---

### Task 1: Głosy i klient ElevenLabs TTS

**Files:**
- Create: `src/lib/voices.ts`, `src/lib/ai/tts.ts`
- Test: `tests/tts.test.ts`

**Interfaces:**
- Produces: `VOICES: Voice[]`, `getVoice(id: string): Voice`; `type Voice = { id; label; elevenName; model; settings: { speed; stability; similarity_boost; style; use_speaker_boost }; wordsPerSecond }`
- Produces: `alignmentToWords(a: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] }, offset?: number): Word[]`
- Produces: `resolveVoiceId(apiKey, elevenName): Promise<string>` (GET `/v1/voices`, dopasowanie nazwy bez wielkości liter), `synthesize(apiKey, voice: Voice, voiceId, text, ctx?: { previous?: string; next?: string }): Promise<{ audio: Buffer; words: Word[]; duration: number }>` (`output_format=mp3_44100_128`), `class TtsError`.

- [ ] Test `alignmentToWords`: „Cześć, Depli!” z czasami znaków → `[{text:"Cześć,",start,end},{text:"Depli!",...}]`, offset dodany do czasów, spacje i wielokrotne spacje nie tworzą pustych słów.
- [ ] Uruchom: `npx vitest run tests/tts.test.ts` → FAIL (brak modułu).
- [ ] Zaimplementuj `voices.ts`, `alignmentToWords`, `resolveVoiceId`, `synthesize`; błędy HTTP → `TtsError` z polskim komunikatem (401 klucz, 402/429 limit/kredyty, inne: kod + treść ≤200 znaków). `userMessage` w `src/lib/errors.ts` przepuszcza `TtsError`.
- [ ] Test przechodzi; commit.

### Task 2: Formularz — „Prześlij plik / Stwórz lektora”, próbka głosu

**Files:**
- Modify: `src/app/(app)/clips/new/new-clip-form.tsx`, `src/app/(app)/clips/actions.ts` (`createClipProject`, nowa `voiceSampleAction`), `src/lib/clips/pipeline.ts` (`ClipSettings`)
- Create: `src/app/(app)/clips/new/voice-picker.tsx`

**Interfaces:**
- Consumes: `VOICES`, `resolveVoiceId`, `synthesize` (Task 1)
- Produces: `ClipSettings` += `voiceover_mode?: "upload" | "generate"`, `voice?: string`, `voice_id?: string`, `target_seconds?: number`
- Produces: `voiceSampleAction(voiceId: string): Promise<{ ok: true; url: string } | { ok: false; error: string }>` — plik `${userId}/voices/${voice.id}-probka.mp3`; jeśli istnieje, tylko podpisany URL; tekst próbki: „Cześć! Tak brzmi lektor Twoich reklam w Clipzy.”

- [ ] UI: przy „Z lektorem” dwa kafelki trybu (hidden input `voiceover_mode`), przy „Stwórz lektora” lista głosów (radio `voice`) z przyciskiem „▶ Próbka” (odtwarza `<audio>`, spinner w trakcie) i suwak `target_seconds` (10–60, krok 5, etykieta „ok. 30 s”).
- [ ] `createClipProject`: zapis nowych pól; w trybie „generate” wymagany klucz ElevenLabs (jak dziś przy lektorze).
- [ ] Studio: w trybie „generate” brak przycisku „+ Lektor”; przycisk „Zrób sklejkę” nie wymaga pliku lektora.
- [ ] `npx tsc --noEmit` i `npm run lint` czyste; commit.

### Task 3: Skrypt Reżysera i nowe stany pipeline

**Files:**
- Create: `src/lib/ai/script.ts`
- Modify: `src/lib/clips/steps.ts`, `src/app/(app)/clips/actions.ts` (`pipelineStateAction`, nowa `scriptAction`), `src/lib/clips/pipeline.ts` (`VoiceoverData`)
- Test: `tests/steps.test.ts`

**Interfaces:**
- Produces: `Script = { angle: string; hooks: Array<{ text: string; idea: string }>; body: string; notes: string }` (Zod `ScriptSchema`, hooks dokładnie 5), `writeScript(apiKey, ctx: ClipsContext, opts: { words: number; note?: string; previous?: Script }): Promise<Script>`
- Produces: `VoiceoverData` += `mode?: "upload" | "generate"`, `script?: Script`, `status?: "script_ready" | "done"`, `variants?: VoVariant[]`; `VoVariant = { asset_id: string; words: Word[]; timeline: TightTimeline; captions: CaptionChunk[]; hookEnd: number; hookText: string }`
- Produces: `PipelineState.voiceover` += `"script_needed" | "script_ready"`; `Step` += `{ kind: "script" }`; `nextStep` zwraca `{ kind: "wait_user" }` przy `script_ready`.

- [ ] Testy `nextStep`: analiza przed skryptem; `script_needed` → `script`; `script_ready` → `wait_user`; `done` → dalej `missing`.
- [ ] FAIL → implementacja: kolejność analiza → script → wait_user → voiceover/missing/poll/plan.
- [ ] `writeScript`: prompt z profilem, analizą nagrań (`contextBlock`), wiedzą `skrypty-i-hooki`; budżet słów = `target_seconds × wordsPerSecond` (hook ≤ 10 słów, 5 różnych typów: pytanie, efekt/WOW, ból, obalenie mitu, konkret, bez zmyślonych liczb); nazwa marki przez `fixBrandName`.
- [ ] `pipelineStateAction`: tryb generate i brak `voiceover.script` → `script_needed`; `status === "script_ready"` → `script_ready`; `variants` → `done`.
- [ ] Pętla w studio: `wait_user` kończy pętlę bez błędu.
- [ ] Testy przechodzą; commit.

### Task 4: Karta skryptu

**Files:**
- Create: `src/app/(app)/clips/[clipId]/script-card.tsx`
- Modify: `src/app/(app)/clips/[clipId]/studio.tsx`, `page.tsx` (przekazanie skryptu), `actions.ts` (`rewriteScriptAction(projectId, note)`)

**Interfaces:**
- Consumes: `Script` (Task 3), `generateVoiceoverAction` (Task 5)
- Produces: `ScriptCard({ projectId, script, wordsPerSecond, onDone })`

- [ ] Karta: 5 pól hooków (numerowane, `idea` jako podpowiedź), pole reszty, licznik „~N s” (słowa ÷ wordsPerSecond, dla hooka 1 + reszty), „Napisz od nowa” z polem uwagi, „Generuj lektora” (spinner, wysyła edytowany skrypt).
- [ ] Po sukcesie → `onDone()` = odświeżenie + ponowne uruchomienie pętli.
- [ ] Ręczny test w podglądzie (harness) + tsc/lint; commit.

### Task 5: Generowanie 5 lektorów

**Files:**
- Modify: `src/lib/media/ffmpeg.ts` (`concatVoice`), `src/lib/clips/pipeline.ts` (`generateVoiceovers`), `src/lib/clips/timeline.ts` (`variantWords`), `actions.ts` (`generateVoiceoverAction(projectId, script)`)
- Test: `tests/timeline.test.ts`

**Interfaces:**
- Consumes: `synthesize`, `resolveVoiceId`, `getVoice` (Task 1), `Script`, `VoVariant` (Task 3)
- Produces: `variantWords(hook: { words: Word[]; duration: number }, body: { words: Word[] }, gap = 0.15): Word[]`; `concatVoice(parts: string[], gap: number, out: string): Promise<void>` (WAV, potem `normalizeVoice`)
- Produces: `generateVoiceovers(supabase, project, script): Promise<VoiceoverData>` — puste hooki pominięte; 6 zapytań TTS (po 3 równolegle, `previous_text`/`next_text`); dla każdej wersji asset `voiceover` z `meta.variant`; `tighten` + `captionChunks` + `fixBrandName`; `hookEnd` = czas końca hooka po `tighten`; top-level pola = wersja 1.

- [ ] Test `variantWords`: słowa reszty przesunięte o `hook.duration + 0.15`, kolejność zachowana.
- [ ] FAIL → implementacja → PASS.
- [ ] Tryb „upload”: `processVoiceover` dopisuje `variants` = 5× ta sama ścieżka z `hookEnd` = koniec fraz między 1,2 a 3,5 s (`uploadHookEnd(phrases): number`, test).
- [ ] Commit.

### Task 6: Plan z hookami — `composeVariant`

**Files:**
- Modify: `src/lib/clips/plan.ts` (`EditPlan.hooks`), `src/lib/ai/clips.ts` (prompt), `src/lib/clips/pipeline.ts` (`makePlan`)
- Create: `src/lib/clips/variants.ts`
- Test: `tests/variants.test.ts`

**Interfaces:**
- Produces: `EditPlan.hooks: Array<{ shots: Shot[]; overlays: Overlay[]; sfx: Sfx[] }>` (domyślnie `[]`, max 4 — wersje 2–5, czasy od 0)
- Produces: `composeVariant(plan: EditPlan, k: number, hookEnds: number[]): EditPlan` (k od 1; k=1 → plan bez zmian), `decomposeVariant(edited: EditPlan, base: EditPlan, k: number, hookEnds: number[]): EditPlan`

- [ ] Testy: k=2 z dłuższym hookiem → ujęcia ciągłe od 0, część wspólna przesunięta o `hookEnds[1]-hookEnds[0]`, koniec = koniec reszty; nakładki/SFX hooka 1 nie przechodzą do wersji 2; `decomposeVariant(composeVariant(p,k))` = p.
- [ ] FAIL → implementacja → PASS.
- [ ] Prompt Reżysera: teksty i czasy końca hooków wersji 2–5, każdy z innym otwarciem obrazu; ujęcia wersji 1 kończą hook równo w `hookEnds[0]`. `makePlan`: mapowanie aliasów i `sanitizePlan` także dla hooków.
- [ ] Commit.

### Task 7: Studio — przełącznik wersji, render wszystkich

**Files:**
- Modify: `src/app/(app)/clips/[clipId]/studio.tsx`, `media.ts`, `page.tsx`

**Interfaces:**
- Consumes: `composeVariant`, `decomposeVariant` (Task 6), `VoVariant` (Task 3/5)

- [ ] Przełącznik „Hook 1 · … · 5” (tylko gdy >1 wersja), podgląd i props z lektorem wersji k.
- [ ] Szybkie poprawki na wersji k → zapis przez `decomposeVariant`.
- [ ] „Renderuj wszystkie”: po kolei każda wersja w wybranym formacie, nazwa `${marka}-${format}-hook${k}.mp4`, pasek „Wersja k/N”, `meta.variant` w renderze; Kontroler automatycznie tylko dla pierwszego renderu z paczki.
- [ ] Lista gotowych plików z etykietą „Hook k”.
- [ ] Commit.

### Task 8: Weryfikacja i wdrożenie

- [ ] Harness: render dwóch wersji (hook 1 i 2) z syntetycznym lektorem → poprawne długości, brak czarnych klatek.
- [ ] `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npm run build` czyste.
- [ ] README: sekcja „Lektor z Clipzy i hooki”.
- [ ] Commit, push, status Vercel = success.
