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
- **Gotowość do reklam** liczona z tego, co sprzedaje (grupa docelowa, persony, problemy, kąty) — nie spada po odpowiedziach. „Rozbuduj profil” każe Claude uzupełnić braki samemu.
- Profil nie pyta o styl, lektora ani muzykę — to wybór w module sklejek, a styl dopracowuje feedback do gotowych reklam (zapisywany w profilu marki jako preferencje).

W kolejnych etapach: sklejki, AI nagrania, image ads, usuwanie napisów, integracja z Meta API.

## Wdrożenie (jednorazowo)

### 1. Supabase

1. W projekcie Supabase otwórz **SQL Editor** i uruchom po kolei (wklej → **Run**) pliki z `supabase/migrations/`:
   - `0001_init.sql` — tabele, zabezpieczenia (każdy widzi tylko swoje dane) i prywatny magazyn plików `media`,
   - `0002_review.sql` — miejsce na wyniki kontroli jakości profili.
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
