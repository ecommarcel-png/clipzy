# Statyki AI — produkcja kreacji obrazkowych

Da się prowadzić duże, rentowne konta praktycznie wyłącznie na statykach. Wszyscy są zapatrzeni w wideo — a jak wszyscy robią jedno, ty raczej chcesz robić drugie.

## Dlaczego statyki

1. **Szybkość iteracji.** Pieniądz lubi tempo. Testujesz kąty błyskawicznie, bez wysyłania czegokolwiek do montażysty.
2. **Robisz je w 100% sam.** Batch 20 dobrych jakościowo kreacji w niecałą godzinę, bez grafika.
3. **Potrafią zarabiać więcej niż wideo.** To nie jest gorszy format, tylko inny.

**Jedyne zastrzeżenie:** statyki wypalają się szybciej. Ale — i to ważny niuans — **wypalenie jest funkcją wydatku, nie kalendarza.** Pojedynczą kreacją nie musisz się przejmować, dopóki nie przepali 10-50 tys. wydatku. Przy małym budżecie zmęczenie kreacji to nie jest twój problem.

---

## Dlaczego większość statyków AI to śmieci

Typowy proces: wchodzisz do biblioteki reklam albo narzędzia do podglądania kreacji, znajdujesz nieźle wyglądający statyk, wrzucasz do czata z poleceniem „zrób to samo, ale dla mojej marki" — i wychodzi wygenerowana papka, która nie ma **żadnego triggera emocjonalnego**. Potem wrzucasz to na konto, dosypujesz budżet i dziwisz się, że nie jesteś milionerem.

Sedno: **w statyku hookiem jest sama kreacja.** Nie masz pierwszych trzech sekund wideo — masz jeden obraz, który musi zrobić całą robotę.

## Dwa typy hooka wizualnego

**1. Transformacja (X → Y)**

Byłem w tym koszmarnym stanie → teraz jestem w stanie docelowym. Klasyczne, czytelne, działa dzięki kontrastowi emocjonalnemu w jednym kadrze.

**2. Sam koszmar (tylko pierwsza połowa)**

Trudniejsze, bo nie ma kontrastu — cały ciężar spoczywa na tym, jak celnie trafisz w emocję.

Przykład konstrukcji: osoba z nadwagą patrzy w dół na wagę, a na wyświetlaczu zamiast liczby jest zdanie opisujące to, co ta osoba naprawdę czuje. To nie jest raport z pomiaru, to jest jej wewnętrzny monolog wyświetlony na zewnątrz.

**Ważne:** tych transformacji nie musisz wymyślać z głowy. Wyciągasz je z researchu (niżej), z prawdziwego języka klientów.

---

## Krok 1 — Research (tu wygrywasz albo przegrywasz)

Możesz spieprzyć wszystko inne. Jeśli ten krok zrobisz porządnie, jesteś przed większością rynku, bo większość po prostu przerysowuje cudze reklamy, nie rozumiejąc, jaki mechanizm emocjonalny za nimi stoi.

**Nie zgaduj.** Masz narzędzia, żeby zwalidować trigger, zanim wydasz złotówkę na reklamę. Bariera wejścia jest absurdalnie niska.

Szukasz konkretnie: **transformacji, dosłownych cytatów klientów, voice of customer.**

### Foundational docs — cztery dokumenty bazowe

To fundament, który potem podpinasz do każdego promptu na kreację. Efekt jest nieporównywalnie lepszy niż wpisanie własnego promptu z palca.

| Dokument | Co zawiera |
|---|---|
| **Research / deep research** | Głęboki psychograficzny research rynku, bóle, język, obiekcje, konkurencja |
| **Avatar sheet** | Karta persony — kto to jest, co czuje, w jakiej sytuacji, czego się boi |
| **Offer brief** | Twoja oferta rozpisana: obietnica, mechanizm, dowody, cena, gwarancja |
| **Necessary beliefs** | W co ten człowiek MUSI uwierzyć, żeby kupić — lista przekonań do zbudowania |

**Kolejność pracy:**

1. Zbierz materiał wejściowy — zrzut całej strony sprzedażowej (własnej lub referencyjnej) jako PDF, dane o produkcie, istniejące opinie, transkrypcje rozmów z klientami.
2. Użyj AI do **napisania promptu do deep research** — nie pisz go sam. Ludzie są słabi w pisaniu promptów, a model potrafi to zrobić lepiej, jeśli da mu się kontekst.
3. Odpal deep research z tym promptem.
4. Z wyniku zbuduj po kolei cztery dokumenty, każdy zapisz osobno.
5. Trzymaj je pod ręką — od teraz podpinasz je do każdego zadania kreatywnego.

**Zasada nadrzędna:** używaj AI do pisania promptów dla AI. To jest najbardziej niedoceniany krok w całym procesie.

---

## Krok 2 — Znajdź sprawdzone formaty na rynku

**Zasada 80/20 przy testowaniu statyków:**

- **80%** — iteracje istniejących zwycięzców. Twoich, jeśli już je masz. Jeśli nie masz żadnych — sprawdzonych kreacji z rynku.
- **20%** — całkowicie nowe koncepty od zera.

### Kryteria filtrowania biblioteki reklam

Szukając kreacji referencyjnych, filtruj tak, żeby zostały tylko realnie działające:

- **Wynik/ocena:** najwyższe przedziały
- **Format:** obraz
- **Status:** nadal aktywne
- **Czas działania:** minimum 7 dni
- **Język:** twój rynek
- **Kanały:** Facebook + Instagram
- **Wykorzystanie kreacji:** więcej niż 3
- **Aktywne reklamy marki:** minimum ~100 w bibliotece

Sens tych filtrów: reklama, która żyje ponad tydzień, jest używana wielokrotnie i pochodzi od marki z setką aktywnych reklam, prawie na pewno zarabia. Reklama sprzed dwóch dni nie mówi nic.

**Typy układów, które warto zebrać:** przed/po, porównania, FAQ/wyjaśniacz, wielka liczba, screen rozmowy, „ulotka" ofertowa, format udający interfejs (powiadomienie, notatka, kalendarz).

---

## Krok 3 — Prompt na kreację

Proces:

1. Nowe okno czatu. Wklej swój prompt-do-pisania-promptów na kreacje obrazkowe.
2. **Podepnij cztery foundational docs.**
3. Wrzuć obraz referencyjny z jednym zdaniem: „napisz prompt, który odtworzy tę kreację dla mojej marki".
4. Skopiuj **sam prompt** (nie cały wywód modelu) i wklej do generatora obrazu.

Dzięki temu, że ciężka praca została wykonana wcześniej, na tym etapie możesz być leniwy. Model ma kontekst marki, oferty i klienta, więc nie produkuje generyku.

**Dłuższy prompt ≠ lepszy wynik.** Często jest odwrotnie. Przepromptowanie to realny błąd.

### Wybór modelu obrazowego

Modele mają różne mocne strony — warto puścić ten sam brief przez kilka i porównać wyniki.

| Potrzeba | Uwaga |
|---|---|
| **Tekst na obrazie** | Najsłabszy punkt większości modeli. Warto testować kilka i wybrać ten, który u ciebie najlepiej „drukuje" litery. Przy dużej ilości tekstu wynik często się rozjeżdża — im lepszy research i prompt, tym rzadziej |
| **Hiperrealistyczne UGC** | Modele nastawione na realizm, efekt „zdjęcie z telefonu" |
| **Ilustracja / animowany styl** | Osobna kategoria modeli, dobra do przed/po i do obchodzenia problemów compliance |

**Rutyna:** puść jeden brief równolegle przez 2-3 modele i wybierz najlepszy output. Zajmuje minuty, a różnica jakości bywa duża.

### Iterowanie

Nie generuj od nowa przy każdej poprawce. Poprawiaj punktowo: „zmień napis", „popraw dłoń", „podmień twarz — załączam więcej zdjęć referencyjnych", „usuń ten element". Modele dobrze radzą sobie z edycją opisową.

Jeśli chcesz swojej twarzy na kreacji — dorzuć kilka własnych zdjęć jako kontekst i proś o podmianę, aż podobieństwo będzie działało **na małym ekranie**. Nie musi być perfekcyjne z bliska; ma być rozpoznawalne przy scrollowaniu.

Jeśli w kreacji ma być twój produkt — **załącz PNG produktu.** Bez tego model wymyśli opakowanie, które nie ma nic wspólnego z twoim.

---

## Compliance — czego nie robić

**Dosłowne przed/po przy odchudzaniu i zdrowiu to prosta droga do odrzucenia reklamy, a przy powtarzalności — do blokady konta.** To jeden z najbardziej wrażliwych obszarów w polityce Meta.

Obejście, które działa: **wersja ilustrowana lub animowana zamiast fotorealistycznej.** Ten sam przekaz, znacznie wyższa szansa akceptacji.

Pamiętaj też, że akceptacja jest niedeterministyczna — ta sama kreacja może przejść u jednej osoby i zostać odrzucona u drugiej (→ `algorytm-meta.md`, sekcja o falach banów).

---

## Jak to spina się z resztą systemu

- Kreacje z tego procesu wrzucasz do **jednej kampanii, jednego zestawu** (→ `struktura-konta.md`).
- Rozpisujesz je na **5 poziomów świadomości** i **5 typów kreacji** (→ `poziomy-swiadomosci.md`, `komplet-5-kreacji.md`).
- **Wyjątek absolutny:** kreacji typu „świat marki" nie generujesz AI. Nigdy. Cały jej sens polega na tym, że jest prawdziwa.
- Każda kreacja przechodzi **test pijanej babci** przed wrzuceniem (→ SKILL.md).

## Checklist przed wrzuceniem statyka AI

- [ ] Kreacja opiera się na **konkretnym triggerze emocjonalnym** z researchu, nie na ładnym layoucie
- [ ] Tekst ma maksymalnie kilkanaście słów i jest czytelny w 1-2 sekundy
- [ ] Litery się nie rozjechały (sprawdź na małym ekranie)
- [ ] Produkt wygląda jak twój produkt
- [ ] Nie wygląda jak AI-slop, który każdy rozpoznaje z kilometra
- [ ] Format 1:1 lub 4:5 (statyk), nigdy poziomo
- [ ] Nie łamie polityki Meta (dosłowne przed/po w zdrowiu, obietnice medyczne, treści wrażliwe)
- [ ] 80% partii to iteracje sprawdzonego, 20% to nowe koncepty
