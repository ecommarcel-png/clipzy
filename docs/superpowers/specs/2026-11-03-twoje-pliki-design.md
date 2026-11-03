# Twoje pliki — design (krótki)

## Po co
Jedno archiwum wszystkich gotowych reklam z Clipzy, niezależne od narzędzia, które je zrobiło.
Pliki można przeglądać, pobierać, zmieniać im nazwy i usuwać. Dziś gotowe filmy widać tylko
w środku danej sklejki i giną razem z nią.

## Cele
- Strona `/files` („Twoje pliki”, grupa „Twoja przestrzeń”) z listą wszystkich gotowych reklam, najnowsze na górze.
- Zmiana nazwy pliku w miejscu (jak na liście sklejek). Nazwa jest wspólna: ta sama w „Twoich plikach” i w „Gotowych plikach” sklejki.
- Pobieranie: pobrany plik nazywa się tak jak plik w Clipzy.
- Usuwanie pliku z archiwum (z potwierdzeniem) kasuje go też z magazynu i ze sklejki.
- **Usunięcie sklejki nie usuwa jej gotowych reklam** (decyzja Marcela). Plik zostaje, traci tylko link do projektu.
- Usunięcie marki też nie kasuje gotowych reklam; nazwa marki/produktu zostaje zapamiętana na pliku.

## Nie-cele (na teraz)
- Foldery, tagi, udostępnianie linkiem, publikacja do Meta.
- Pliki z innych narzędzi (AI nagrania, Image ads) — tabela jest na nie gotowa (`tool`, `kind`), ale dziś zapisują tylko sklejki.
- Materiały źródłowe (nagrania, lektor) — to jest biblioteka marki/produktu, osobna rzecz.

## Podejścia
- **A. Osobna tabela gotowych plików (wybrane).** `ad_files`, wiersz na każdy gotowy plik; sklejka zapisuje tam render. Plik przeżywa usunięcie sklejki, a przyszłe narzędzia piszą do tej samej tabeli. Koszt: migracja 0005.
- B. Odpięcie renderów w `clip_assets` od projektu. Zmienia regułę usuwania tabeli, na której stoją analiza i plan; nie pasuje do innych narzędzi. Odrzucone.

## Jak (ustalone)
- **Migracja `0005_files.sql`**: tabela `ad_files`:
  - `id` = to samo id co wiersz renderu w `clip_assets` (render id jest generowane w przeglądarce), dzięki czemu sklejka i archiwum mówią o tym samym pliku bez dodatkowego pola;
  - `user_id`, `brand_id`/`product_id`/`project_id` (on delete set null);
  - `tool` (`sklejki`), `kind` (`video`|`image`), `path`, `name`, `format`, `variant`;
  - `meta` (np. `brand_name`, `product_name`, `project_name` — zapamiętane przy zapisie), `review` (ocena Kontrolera), `created_at`/`updated_at`;
  - RLS: tylko właściciel; backfill istniejących renderów z `clip_assets`.
- **Zapis renderu** (`saveRenderAction`): obok wiersza w `clip_assets` — wiersz w `ad_files` z czytelną domyślną nazwą: `Produkt (lub Marka) · 4:5 · hook 2`.
- **Kontroler** (`reviewRendered`): ocenę zapisuje też w `ad_files.review`.
- **Usuwanie sklejki**: ścieżki z `ad_files` trafiają do „w użyciu” (`pathsInUse`), więc pliku nie kasujemy.
- **Sklejka → „Gotowe pliki”**: pokazuje nazwę z `ad_files` (i ołówek do zmiany nazwy); pobieranie z nazwą pliku.
- **Strona `/files`**: siatka kart z podglądem wideo (pierwsza klatka, odtwarzanie po kliknięciu), nazwa z ołówkiem, linia meta (marka — produkt — format — hook — data), ocena Kontrolera, Pobierz, „Otwórz sklejkę” (gdy istnieje), Usuń. Filtry: marka, format, szukaj po nazwie. Pusta strona zaprasza do Sklejek. Bez migracji — komunikat jak przy sklejkach.
- Menu: „Twoje pliki” przestaje być „wkrótce”.

## Zostawione budującemu
- Dokładny wygląd kart i filtrów (w stylu reszty aplikacji), limit liczby plików na stronę (na start ok. 200, bez paginacji).
- Formatowanie domyślnej nazwy i slug nazwy pobieranego pliku.
