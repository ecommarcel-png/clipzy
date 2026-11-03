# Image ads — design

## Po co
Drugie narzędzie Clipzy: z profilu marki i produktu robi od razu N gotowych reklam graficznych pod Meta
(N = 1–20, suwak), każdą w 1:1 (1080×1080) i 9:16 (1080×1920), z copy: tekst główny, nagłówek, opis.
Bez etapu akceptacji — wszystko leci od razu po kliknięciu; poprawki na gotowych (decyzja Marcela).

## Decyzje Marcela
- Wybór: marka (+ produkt), suwak ilości (max 20), „Generuj” — wszystko automatycznie.
- fal.ai robi zdjęcia/sceny, Claude składa grafikę (podejście A: zdjęcie z fal + szablony układów wypełniane przez Claude).
- Produkt z efektem przed/po → przed/po to najmocniejszy visual i ma być. Generujemy efekty przed/po także dla
  skóry/włosów/ciała, nawet gdy zdjęcia produktu ich nie mają — odpowiedzialność za publikację po stronie użytkownika.
- Agenci: osobne role za każdy etap + Kontroler na końcu, który ogląda grafiki i wdraża poprawki.
- Inspiracje: 57 grafik + copy + film „32 formaty” (Marcel, 2026-11-03).

## Moje ustalenia (calls)
- Opinie / testimonial tylko z prawdziwych danych (social_proof z profilu produktu). Bez nich Strateg nie wybiera tego formatu.
- Jedno zdjęcie z fal na kreację (przed/po: dwa), w proporcji 1:1 — oba formaty używają tego samego zdjęcia (9:16 układa tekst nad/pod zdjęciem).
- Model obrazu: `fal-ai/nano-banana-2/edit` ze zdjęciami produktu jako referencją (do 14), ~0,08 $ / obraz; bez zdjęć produktu — wersja text-to-image tego modelu.
- Wycięty produkt (packshot bez tła) do szablonów typu „strzałki”, „my vs oni”: `fal-ai/birefnet/v2`, raz na zestaw.
- Render PNG na serwerze: `next/og` (satori + resvg) — bez przeglądarki, polskie znaki z własnych fontów (Inter, Anton, Bricolage Grotesque, Caveat; OFL, w repo).
- Kontroler: Claude z podglądem PNG (obie wersje), zwraca ocenę 1–10 i poprawki: łatki pól szablonu i/lub nowe zdjęcie. Jedna runda poprawek, potem ocena końcowa.
- Gotowe PNG trafiają do „Twoich plików” (`ad_files`, kind `image`, tool `image-ads`), z copy w meta.
- Szybka edycja bez AI: zmiana tekstów/koloru/wariantu → ponowny render na serwerze (darmowy).
- Przegeneruj jedną kreację (cały łańcuch dla niej, ten sam format).

## Agenci (wywołania Claude)
1. **Strateg** — 1 wywołanie: N konceptów {szablon, kąt, persona, poziom świadomości, pomysł na visual}. Bez powtórek formatu dopóki pula pozwala; przed/po na pierwszych pozycjach, gdy `before_after.possible`.
2. **Copywriter** — paczki po 5: teksty na grafikę (pola szablonu) + copy Meta (tekst główny z emoji, nagłówek ≤ 40 zn., opis ≤ 30 zn.).
3. **Fotograf** — paczki po 5: prompty do fal (scena, światło, kadr, gdzie zostawić miejsce na tekst; przed/po: dwa prompty).
4. **Grafik** — w tej samej paczce co Fotograf? Nie: osobne wywołanie po copy: wariant układu, kolory (z palety marki), wyróżnione słowa, ikony.
5. **Kontroler** — paczki po 3 kreacje (6 PNG): ocena + poprawki.

## Szablony (na start 12)
hero_benefits, before_after, callouts, us_vs_them, sticky_notes, whiteboard, handwritten_note, listicle,
offer, testimonial, problem_solution, question_hook. Każdy ma schemat pól (Zod, z limitami długości) i działa w 1:1 i 9:16.

## Dane
Migracja `0006_image_ads.sql`: `image_ad_sets` (zestaw: marka, produkt, liczba, status, błąd, ustawienia) i
`image_ads` (kreacja: idx, szablon, koncept, copy, pola, zdjęcia/zlecenia fal, rendery, recenzje, status, błąd).

## Przebieg (jak sklejki)
Klient w pętli pyta serwer o stan i woła kolejny krok (czysta funkcja `nextStep`): strateg → copy → grafik/fotograf
→ zlecenia fal → odpytywanie → render → Kontroler → poprawki → render → ocena końcowa → gotowe.
Każdy krok mieści się w limicie 300 s. Wyjście ze strony wstrzymuje, powrót wznawia.

## Nie-cele (teraz)
Publikacja do Meta, inne proporcje (4:5), edycja układu przeciąganiem, własne fonty marki.
