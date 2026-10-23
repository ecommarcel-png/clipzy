# Clipzy

Narzędzie do tworzenia reklam pod Meta Ads dla e-commerce: sklejki (montaż z materiałów produktowych), AI nagrania, image ads i usuwanie napisów z nagrań. Claude jest „mózgiem” — zna markę, produkt i bazę wiedzy o reklamach (`knowledge/sklejki/SKILL.md`), a inne modele wykonują zadania na jego polecenie.

Każdy użytkownik wkleja własne klucze API (Anthropic, Gemini, fal.ai, ElevenLabs) i płaci bezpośrednio dostawcom. Klucze są szyfrowane na serwerze (AES-256-GCM) i nigdy nie wracają do przeglądarki.

## Jak pracuje Claude: Reżyser i Kontroler

Każdy profil marki i produktu przechodzi pętlę jakości (`knowledge/rezyser/SKILL.md`):

1. **Reżyser** (Claude) buduje szkic z dowodów: strona, zdjęcia, Twoje notatki i odpowiedzi.
2. **Kontroler** (osobne wywołanie Claude, bez wglądu w rozumowanie Reżysera) sprawdza szkic według listy kontrolnej: niepotwierdzone fakty, sprzeczności, ogólniki, ryzyka zasad Meta, profil napisów, polszczyzna.
3. Reżyser poprawia usterki krytyczne i ważne, a Kontroler sprawdza ponownie.
4. W edytorze widać kartę **Kontrola jakości**: co sprawdzono, co poprawiono, co zostało do Twojej decyzji.

## Co już działa (etap 1)

- Logowanie i rejestracja (Supabase Auth).
- **Ustawienia:** klucze API z testem połączenia.
- **Marki:** link do sklepu → Clipzy czyta stronę główną, „o nas”, FAQ, kolory, logo i listę produktów (Shopify) → Claude sam buduje profil: grupa docelowa, 3–6 person, problemy i pragnienia klientów. Najwyżej 3 pytania, wszystkie opcjonalne.
- **Produkty:** link do produktu → pobranie opisu, ceny i zdjęć (Shopify, JSON-LD, meta) → Claude ogląda zdjęcia i buduje profil: wszystkie problemy, które produkt rozwiązuje, mechanizm, korzyści, obiekcje i 10–15 kątów reklamowych (persona × problem × poziom świadomości) z gotowymi hookami. Własne zdjęcia można dowgrać.
- **Research rynku** przy każdym produkcie: Claude przeszukuje polski internet (do 6 wyszukiwań) — język klientów z opinii, frustracje, obietnice konkurencji i poziom wypalenia rynku, obiekcje, niewykorzystane kąty. Raport ze źródłami widać na stronie produktu; trafia do analizy jako dowód. Koszt: ok. $0,06 za wyszukiwania + tokeny. Wymaga włączonego Web search w Anthropic Console (domyślnie włączony).
- **Gotowość do reklam** liczona z tego, co sprzedaje (grupa docelowa, persony, problemy, kąty) — nie spada po odpowiedziach. „Rozbuduj profil” każe Claude uzupełnić braki samemu.
- Profil nie pyta o styl, lektora ani muzykę — to wybór w module sklejek, a styl dopracowuje feedback do gotowych reklam (zapisywany w profilu marki jako preferencje).

## Sklejki (etap 2)

**Sklejki → Nowa sklejka:** wybierasz markę i produkt, wgrywasz nagrania (dowolne — także inne modele produktu) i lektora (opcjonalnie), wybierasz muzykę i formaty. Dalej Clipzy działa samo:

1. **Analiza nagrań** — ffmpeg znajduje cięcia wewnątrz plików (żeby nigdy nie mignęła klatka sąsiedniej sceny), Gemini ogląda każde nagranie: co widać, gdzie jest produkt, czy logo jest w lustrzanym odbiciu, gdzie są artefakty AI.
2. **Lektor** — ElevenLabs Scribe zapisuje słowa z czasami, Clipzy wycina za długie przerwy (zostawia naturalny oddech po zdaniu), wyrównuje głośność (−16 LUFS) i układa napisy po 3–6 słów. Claude ocenia skrypt.
3. **Brakujące ujęcia** — jeśli Reżyser uzna, że czegoś nie ma w materiałach (np. pokazania problemu), generuje do 3 ujęć Seedance 2.5 przez fal.ai.
4. **Montaż** — Reżyser pisze plan (split screen przed/po, szary obraz dla problemu, ikonki przekreślane, obwódki, połysk, przejście w kolorze marki, packshot ze zdjęcia produktu na końcu, muzyka i SFX z biblioteki), Kontroler go sprawdza, a sanitizer wyrównuje każde cięcie do klatki.
5. **Podgląd i render w przeglądarce** (Remotion) — MP4 1080p w 4:5 / 9:16 / 1:1, pobiera się automatycznie; Gemini ogląda gotowy plik i wystawia ocenę.
6. **Feedback** — piszesz, co zmienić; trwałe uwagi trafiają do preferencji marki i działają przy kolejnych reklamach.
7. **Lektor z Clipzy i 5 hooków** — przy „Z lektorem” wybierasz „Stwórz lektora”: głos (▶ Próbka) i przybliżoną długość (10–60 s). Reżyser pisze skrypt pod Twoje nagrania: 5 różnych hooków + wspólna reszta z CTA. Poprawiasz go na karcie skryptu i klikasz „Generuj lektora” — dopiero wtedy ElevenLabs nagrywa (6 krótkich nagrań, sklejone w 5 lektorów, napisy z dokładnymi czasami, bez transkrypcji). Reżyser układa jeden plan z 5 różnymi otwarciami; w podglądzie przełącznik „Hook 1–5” i „Renderuj wszystkie”. Przy wgranym pliku też powstaje 5 wersji, różniących się obrazem na otwarciu. Głosy są w `src/lib/voices.ts` (na start „test” = Lena Suzuki z konta ElevenLabs).
8. **Szybkie poprawki (bez AI)** — pod podglądem: głośność lektora, muzyki i SFX, zmiana utworu, lista ujęć (krócej/dłużej, inny plik, inny fragment, usuń), poprawa tekstu napisów i packshotu. Zmiany widać od razu w podglądzie; „Przywróć wersję Reżysera” cofa ręczne poprawki ujęć.

**Biblioteka materiałów:** każde wgrane nagranie i każde ujęcie AI zapisuje się po analizie w bibliotece produktu (z miniaturą i gotową analizą). Przy nowej sklejce zapisane materiały tego produktu są od razu zaznaczone — wystarczy nowy lektor. Reżyser używa wcześniejszych ujęć AI zamiast generować je ponownie, więc kolejne sklejki kosztują głównie Claude (~$0,5–1) zamiast generowania (~$0,46 za sekundę Seedance 720p). Bibliotekę produktu widać na stronie produktu; usunięcie z biblioteki ani usunięcie sklejki nie psuje innych sklejek.

**Wymagania:**

- Klucze: Anthropic i Gemini (zawsze), ElevenLabs (gdy jest lektor), fal (gdy trzeba coś wygenerować).
- Render działa w **Chrome lub Edge na komputerze** (WebCodecs). Safari nie renderuje filtrów.
- Pliki do 50 MB (limit Supabase Free). Większe nagrania i iPhone .mov są automatycznie zmniejszane w przeglądarce przed wysłaniem.
- Remotion jest darmowy dla osób prywatnych i firm do 3 osób. Większy zespół potrzebuje licencji firmowej (`NEXT_PUBLIC_REMOTION_LICENSE_KEY` w Vercelu).

**Biblioteka muzyki i SFX:** wrzucaj pliki do `public/biblioteka/muzyka/` i `public/biblioteka/sfx/` (zasady nazw w README w tych folderach). Przy każdym deployu Clipzy sam liczy długość utworów i najlepszy moment startu. Pliki są dostępne tylko po zalogowaniu, ale **repozytorium musi być prywatne**, jeśli wrzucasz licencjonowaną muzykę (np. z Epidemic Sound).

W kolejnych etapach: AI nagrania, image ads, usuwanie napisów, integracja z Meta API.

## Wdrożenie (jednorazowo)

### 1. Supabase

1. W projekcie Supabase otwórz **SQL Editor** i uruchom po kolei (wklej → **Run**) pliki z `supabase/migrations/`:
   - `0001_init.sql` — tabele, zabezpieczenia (każdy widzi tylko swoje dane) i prywatny magazyn plików `media`,
   - `0002_review.sql` — miejsce na wyniki kontroli jakości profili,
   - `0003_clips.sql` — projekty sklejek, ich pliki oraz zgoda na wideo i audio w magazynie `media`,
   - `0004_library.sql` — biblioteka materiałów (nagrania i ujęcia AI do ponownego użycia).
2. **Authentication → URL Configuration:**
   - *Site URL:* adres strony na Vercelu, np. `https://clipzy.vercel.app`
   - *Redirect URLs:* dodaj `https://clipzy.vercel.app/auth/confirm`
3. (Opcjonalnie, na użytek prywatny) **Authentication → Sign In / Providers → Email:** wyłącz *Confirm email*, żeby logować się od razu po rejestracji. Po rejestracji swojego konta możesz też wyłączyć *Allow new users to sign up*, żeby nikt obcy nie założył konta.
4. **Project Settings → API Keys:** skopiuj *Project URL* i *Publishable key* (w starszych projektach: *anon public*).

### 2. Vercel

1. **Add New → Project →** wybierz repozytorium `clipzy` → **Import**.
2. W **Environment Variables** dodaj:

   | Nazwa | Wartość |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL z Supabase |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key z Supabase |
   | `APP_ENCRYPTION_KEY` | wynik `openssl rand -base64 32` (32 losowe bajty) |

   `APP_ENCRYPTION_KEY` zapisz też w bezpiecznym miejscu. Jeśli go zmienisz, zapisane klucze API trzeba będzie wkleić ponownie.
3. **Deploy.**

### 3. Pierwsze uruchomienie

1. Zarejestruj się na stronie.
2. **Ustawienia →** wklej klucz Anthropic (wymagany do marek i produktów) i pozostałe.
3. **Marki i produkty → Dodaj markę →** wklej link do sklepu.

## Praca lokalna

```bash
cp .env.example .env.local   # uzupełnij wartości
npm install
npm run dev                  # http://localhost:3000
npm test                     # testy jednostkowe
npm run typecheck
```

## Struktura

```
knowledge/rezyser/        sposób pracy Claude: planowanie, weryfikacja, Kontroler, limity
knowledge/sklejki/        baza wiedzy o sklejkach (SKILL.md + karty przeanalizowanych reklam)
knowledge/meta-ads/       system Meta Ads 2026 (oferta, wypalenie obietnicy, poziomy świadomości, hooki…)
supabase/migrations/      schemat bazy i zabezpieczenia (RLS)
src/proxy.ts              odświeżanie sesji i przekierowanie niezalogowanych
src/lib/ai/               wywołania Claude: profile marki i produktu, Kontroler, pętla kontroli
src/lib/scrape/           bezpieczne pobieranie stron (blokada adresów wewnętrznych) i parsowanie
src/lib/profiles/         definicje profilu marki i produktu (schematy + formularze)
src/lib/crypto.ts         szyfrowanie kluczy API
src/app/(app)/            ekrany aplikacji (marki, produkty, ustawienia)
```

Baza wiedzy to zwykłe pliki Markdown — poprawki w `knowledge/` działają po kolejnym wdrożeniu, bez zmian w kodzie. Które pliki trafiają do którego zadania, ustawia `src/lib/knowledge.ts`.
