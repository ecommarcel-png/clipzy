# Twoje pliki Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strona `/files` — archiwum wszystkich gotowych reklam (podgląd, pobieranie, zmiana nazwy, usuwanie), które przeżywa usunięcie sklejki i marki.

**Architecture:** Nowa tabela `ad_files` (migracja 0005), wiersz z tym samym `id` co render w `clip_assets`. Sklejka zapisuje do niej przy renderze; Kontroler dopisuje ocenę; usuwanie sklejki zostawia pliki z `ad_files`. Czyste funkcje (nazwy, filtr) w `src/lib/files.ts`, zapis w `src/lib/files-store.ts`, UI w `src/app/(app)/files/`.

**Tech Stack:** Next.js 16 (server actions, RSC), Supabase (Postgres + RLS + storage `media`), Tailwind, vitest.

**Spec:** `docs/superpowers/specs/2026-11-03-twoje-pliki-design.md`

## Global Constraints

- Usunięcie sklejki lub marki NIE kasuje plików z `ad_files` (ani ich wierszy, ani plików w magazynie).
- Nazwa: jedna (z `ad_files.name`), ta sama w `/files` i w „Gotowych plikach” sklejki; max 80 znaków, białe znaki zwinięte.
- Domyślna nazwa: `Produkt (lub Marka) · 4:5 · hook 2` (hook tylko gdy wersji > 1).
- Pobrany plik nazywa się jak plik w Clipzy (ASCII, bez znaków specjalnych).
- Brak migracji 0005 nie może psuć renderu ani strony sklejki; `/files` pokazuje wtedy komunikat o migracji.
- UI po polsku, styl jak reszta aplikacji (`Card`, `Badge`, `buttonClass`, `ConfirmButton`).
- Nie wklejać kluczy, nie commitować sekretów; repo jest publiczne.

## Review Focus

- Migracja 0005 nieuruchomiona → `saveRenderAction` dalej zwraca ok, sklejka pokazuje rendery z nazwą domyślną, `/files` pokazuje komunikat (Task 2, 4).
- Pusta / same spacje nazwa przy zmianie → odrzucona, zostaje stara (Task 1 `cleanName`, Task 3).
- Usunięcie sklejki → plik z `ad_files` zostaje w magazynie (Task 2 `pathsInUse`).
- Polskie znaki, `/`, `:` i emoji w nazwie → poprawna nazwa pobieranego pliku (Task 1 `downloadName`).
- Plik po usuniętej sklejce/marce → brak „Otwórz sklejkę”, marka/produkt z zapamiętanych nazw (Task 4).

---

### Task 1: Czyste funkcje plików

**Files:**
- Create: `src/lib/files.ts`
- Test: `tests/files.test.ts`

**Interfaces:**
- Produces:
  - `type AdFile = { id: string; name: string; path: string; format: string | null; variant: number | null; brandId: string | null; brandName: string | null; productName: string | null; projectId: string | null; createdAt: string; review: { score: number } | null; url: string | null; downloadUrl: string | null }`
  - `cleanName(raw: string): string` — zwija białe znaki, trim, max 80; `""` gdy pusto.
  - `defaultFileName(p: { brand: string; product?: string | null; format: string; variant?: number | null }): string`
  - `formatRatio(format: string): string` — `"4x5"` → `"4:5"`.
  - `downloadName(name: string, ext?: string): string` — domyślnie `"mp4"`.
  - `filterFiles(files: AdFile[], f: { brandId?: string; format?: string; q?: string }): AdFile[]` — `q` bez wielkości liter i polskich znaków.

- [ ] **Step 1: Testy**

```ts
expect(defaultFileName({ brand: "Depli", product: "Krem", format: "4x5", variant: 2 })).toBe("Krem · 4:5 · hook 2");
expect(defaultFileName({ brand: "Depli", product: null, format: "9x16" })).toBe("Depli · 9:16");
expect(cleanName("  a   b  ")).toBe("a b");
expect(cleanName("   ")).toBe("");
expect(cleanName("x".repeat(100))).toHaveLength(80);
expect(downloadName("Krem · 4:5 · hook 2")).toBe("Krem-4-5-hook-2.mp4");
expect(downloadName("Żółta łódź / promo 🔥")).toBe("Zolta-lodz-promo.mp4");
expect(downloadName("")).toBe("reklama.mp4");
// filterFiles: q "zolta" trafia "Żółta łódź"; brandId i format zawężają; puste filtry = wszystko
```

- [ ] **Step 2:** `npx vitest run tests/files.test.ts` → FAIL (brak modułu).
- [ ] **Step 3:** Implementacja w `src/lib/files.ts` (bez `server-only`; polskie znaki: NFD + usunięcie `\p{M}` + `ł/Ł` → `l/L`, ASCII escapes jak w `names.ts`).
- [ ] **Step 4:** `npx vitest run tests/files.test.ts` → PASS.
- [ ] **Step 5:** Commit.

### Task 2: Migracja + zapis plików

**Files:**
- Create: `supabase/migrations/0005_files.sql`, `src/lib/files-store.ts`
- Modify: `src/app/(app)/clips/actions.ts` (`saveRenderAction`), `src/lib/clips/pipeline.ts` (`reviewRendered`), `src/lib/clips/library-store.ts` (`pathsInUse`), `README.md` (migracja 0005)

**Interfaces:**
- Consumes: `defaultFileName`, `cleanName` (Task 1).
- Produces (`files-store.ts`, `server-only`):
  - `recordFile(supabase, row: { id; userId; brandId; productId; projectId; path; format; variant?; name; meta: { brand_name; product_name; project_name } }): Promise<void>` — błąd (np. brak tabeli) połykany.
  - `renameFile(supabase, id: string, name: string): Promise<{ ok: true } | { ok: false; error: string }>` — `cleanName`; pusto → `"Podaj nazwę."`.
  - `deleteFile(supabase, id: string): Promise<void>` — usuwa wiersz `ad_files`, wiersz `clip_assets` o tym samym id i plik z magazynu.
  - `fileNames(supabase, ids: string[]): Promise<Map<string, string>>` — pusta mapa przy błędzie.

- [ ] **Step 1:** `0005_files.sql`: tabela `ad_files` wg spec (`id uuid primary key`, `user_id default auth.uid()` cascade, `brand_id`/`product_id`/`project_id` on delete set null, `tool text default 'sklejki'`, `kind text check in ('video','image') default 'video'`, `path text not null`, `name`, `format`, `variant int`, `meta jsonb`, `review jsonb`, timestamps + trigger `set_updated_at`, indeks `(user_id, created_at desc)`, RLS właściciela z `drop policy if exists`); backfill z `clip_assets` gdzie `kind='render'` i `path is not null` (`name` = domyślna z `brands.name`/`products.name`, `review` = `analysis`, `on conflict (id) do nothing`).
- [ ] **Step 2:** `files-store.ts` jak wyżej.
- [ ] **Step 3:** `saveRenderAction` po insercie do `clip_assets` woła `recordFile` (nazwa `defaultFileName`, hook tylko gdy `variant`); nazwa wiersza w `clip_assets` = ta sama nazwa.
- [ ] **Step 4:** `reviewRendered` dopisuje `review` do `ad_files` (błąd ignorowany).
- [ ] **Step 5:** `pathsInUse` — dodatkowe zapytanie `ad_files.path in chunk` (bez filtra projektu; błąd = brak wyników).
- [ ] **Step 6:** `npm run typecheck && npx vitest run` → zielono. Commit.

### Task 3: Sklejka — nazwy i zmiana nazwy w „Gotowych plikach”

**Files:**
- Create: `src/app/(app)/files/actions.ts`, `src/components/file-name.tsx`
- Modify: `src/app/(app)/clips/[clipId]/page.tsx`, `src/app/(app)/clips/[clipId]/studio.tsx` (`Renders`, pobieranie po renderze)

**Interfaces:**
- Consumes: `renameFile`, `deleteFile`, `fileNames` (Task 2), `downloadName`, `defaultFileName` (Task 1).
- Produces:
  - `renameFileAction(id: string, name: string): Promise<{ ok: true } | { ok: false; error: string }>` (revalidate `/files`).
  - `deleteFileAction(form: FormData)` — pole `fileId`, revalidate `/files`.
  - `<FileName id name onRenamed? />` — klient, ołówek + input jak `ClipRow` (Enter zapisuje, Esc anuluje, błąd pod polem).
  - `StudioData["assets"][number]` dostaje `name: string`; `url` renderu podpisany z `{ download: downloadName(name) }`.

- [ ] **Step 1:** Akcje + `FileName`.
- [ ] **Step 2:** `page.tsx`: nazwy renderów z `fileNames` (fallback `defaultFileName`), podpis z `download`.
- [ ] **Step 3:** `Renders`: `FileName` zamiast samej etykiety formatu (format zostaje jako badge); `a.download` po renderze = `downloadName(defaultFileName(...))`.
- [ ] **Step 4:** `npm run typecheck && npm run lint` → zielono. Commit.

### Task 4: Strona „Twoje pliki”

**Files:**
- Create: `src/app/(app)/files/page.tsx`, `src/app/(app)/files/files-grid.tsx`
- Modify: `src/app/(app)/nav-links.tsx` (zdjąć `soon` z `/files`)

**Interfaces:**
- Consumes: `AdFile`, `filterFiles`, `downloadName`, `formatRatio` (Task 1), `FileName`, `deleteFileAction` (Task 3).

- [ ] **Step 1:** `page.tsx` (server): `ad_files` + `brands(name)`, `products(name)`, `clip_projects(id)`; limit 200, najnowsze; podpisane linki (podgląd + `download`); nazwy marki/produktu: z relacji, inaczej z `meta`; `projectId` tylko gdy projekt istnieje. Błąd zapytania → `Card` „Uruchom w Supabase migrację `0005_files.sql`…”. Pusto → zaproszenie do Sklejek.
- [ ] **Step 2:** `files-grid.tsx` (klient): filtry (select marki z obecnych plików, chipy formatu, szukaj), siatka kart: `<video preload="metadata" controls playsInline>` w ramce o stałych proporcjach (`object-contain`, ciemne tło), `FileName`, meta (marka — produkt — `formatRatio` — hook — data Europe/Warsaw), badge Kontrolera, Pobierz, Otwórz sklejkę, Usuń (`ConfirmButton`). „Brak wyników” przy filtrach bez trafień.
- [ ] **Step 3:** Nav: `/files` bez „wkrótce”.
- [ ] **Step 4:** Harness: zrzut siatki z przykładowymi danymi (desktop + telefon) — karty czytelne, brak poziomego przewijania.
- [ ] **Step 5:** `npm run build && npx vitest run` → zielono. Commit, push, sprawdzić wdrożenie Vercel.
