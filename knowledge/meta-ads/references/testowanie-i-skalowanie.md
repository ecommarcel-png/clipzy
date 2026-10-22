# Testowanie, rotacja i skalowanie

## Filozofia testu w 2026

Nie testujesz targetowania — algorytm i tak zrobi swoje. **Testujesz komunikaty.** Jednostką testu nie jest zestaw reklam, tylko kreacja, a właściwie **osoba, do której ta kreacja mówi**.

Konsekwencja: klasyczne A/B na poziomie zestawów (dwa zestawy, różne grupy) jest w większości przypadków stratą budżetu — rozbijasz dane, oba zestawy wolniej wychodzą z fazy uczenia i dostajesz wynik, który i tak nic nie mówi.

---

## Protokół startowy

### 1. Odpal komplet

Jedna kampania CBO → jeden zestaw Advantage+ → 10-25 kreacji pokrywających wszystkie 5 typów / poziomów. Nie startuj z trzema grafikami.

### 2. Nie ruszaj przez tydzień

**To jest najtrudniejsza część.** Wchodzisz w drugim dniu, widzisz, że jedna kreacja zebrała trzy razy więcej wyświetleń od reszty, i masz odruch, żeby wyłączyć słabsze.

**Nie rób tego. W drugim dniu nie wiesz nic — patrzysz na szum.**

Przez ten tydzień nie:
- wyłączasz kreacji
- nie zmieniasz budżetu (piąty raz w tygodniu)
- nie zmieniasz celu kampanii, bo ktoś w grupie na Facebooku napisał, że jemu to pomogło
- nie edytujesz zestawu (każda istotna edycja resetuje fazę uczenia)

### 3. Po 7-14 dniach — pierwsza ocena

Siadasz i patrzysz, **które trzy kreacje dowiozły**.

Kryterium oceny zależy od tego, ile masz danych:
- Przy solidnym wolumenie: ROAS / CPA na poziomie kreacji.
- Przy małym wolumenie konwersji: sygnały wcześniejsze — CTR (outbound), hook rate (3-sekundowe odtworzenia / wyświetlenia), hold rate, koszt kliknięcia, dodania do koszyka. To sygnały, nie werdykty.

**Nie oceniaj kreacji, która nie wydała sensownego budżetu.** Kreacja z 40 zł wydatku nie „przegrała" — ona nie miała okazji zagrać.

### 4. Druga runda — rozwijasz zwycięzców

Nie wymyślasz nowych pomysłów z sufitu. **Robisz nowe wersje tych trzech, które dowiozły.** Ten sam mechanizm, ale: inny hook, inna twarz, inne ujęcie, inny nagłówek, inny format (rolka ↔ statyk).

**Asymetria tempa — najważniejsza rzecz w całym protokole:**

| Decyzja | Tempo |
|---|---|
| Wyłączenie słabej kreacji | **Wolno.** Minimum 7 dni, sensowny wydatek. W drugim dniu patrzysz na szum |
| Rozwinięcie kreacji, która dowozi | **Natychmiast.** Wariacje robisz tego samego dnia, gdy sygnały są wyraźne i jest sensowna ilość danych |

Ludzie robią to odwrotnie: szybko zabijają przegranych i powoli rozwijają zwycięzców. Pieniądz lubi tempo, ale tylko po jednej stronie tej tabeli.

**Wariacje ≠ marnowanie budżetu.** Zestaw traktuj jako jeden koncept, a poszczególne reklamy jako podejścia do niego. Bardzo często zwycięzcą okazuje się wariacja, a wersja bazowa przegrywa — kto uznał wariacje za bezsensowne, uzna cały koncept za nietrafiony i nigdy się nie dowie. Uwaga na drugą stronę: wariacja topowej reklamy w koncie rzadko przebija oryginał, wypada przyzwoicie. Wariacje służą do rozpoznania konceptu, nie do wyciskania zwycięzcy w nieskończoność. (→ `algorytm-meta.md`, sekcja o Andromedzie.)

### Zasada oddalania widoku

W razie wątpliwości **oddal widok**. Nie „dziś było dobrze, wczoraj źle". Patrz na 7 dni, na największą ilość wydatku, jaką masz. Wyniki wyglądające jak sinusoida są w 100% normalne, szczególnie poniżej ~1000 zł dziennie. Meta jest zmienną platformą i zmienność jest częścią gry.

Decyzje podejmowane na jednodniowych danych to decyzje emocjonalne, nie analityczne.

### 5. Czego nie wyłączasz

**Kreacji, które przestały dowozić, nie wyłączasz.** Zostawiasz je w zestawie. Nie grzebiesz w ustawieniach, nie przestawiasz budżetu, nie zmieniasz celu.

Zamiast tego: sprawdzasz, **których stanowisk ci brakuje**, dorabiasz brakujące kreacje i dodajesz je do istniejącego zestawu.

W dziewięciu przypadkach na dziesięć okaże się, że masz obsadzone tylko stanowisko czwarte — samą ofertę w pięciu wersjach.

*(Wyjątek od zasady „nie wyłączaj": kreacja, która realnie szkodzi — zbiera negatywne komentarze, ma problem prawny, jest niezgodna z polityką Meta albo promuje nieaktualną ofertę. To nie jest optymalizacja, to porządki.)*

---

## Metafora pięciu stanowisk

**Komplet nie kończy się na pięciu kreacjach. To jest pięć stanowisk pracy w twojej firmie.**

Kiedy kreacja z pierwszego stanowiska się wypali — a wypali się, bo wypala się każda — nie zmieniasz systemu. **Zatrudniasz nową osobę na to samo stanowisko.** Obsada się zmienia, stanowiska zostają te same.

Dlatego ten sam system działa u kogoś z budżetem 1000 zł miesięcznie i u kogoś, kto wydaje 100 tysięcy. Różnica jest tylko w tym, **jak często wymieniasz obsadę** i ile stanowisk jest obsadzonych równolegle.

---

## Zmęczenie kreatywne

Kreacja się zużywa. Nawet najlepsza reklama, która dziś dowozi jak szalona, za dwa-trzy miesiące zaczyna siadać, bo ci sami ludzie widzieli ją już kilka razy.

**Orientacyjne tempo wypalania:**

| Typ kreacji | Żywotność |
|---|---|
| Oferta / promocja | ~2 tygodnie |
| Zatrzymanie scrolla oparte na trendzie | 2-4 tygodnie |
| Mechanizm / edukacja | 1-3 miesiące |
| Obiekcja / dowód społeczny | 1-3 miesiące |
| Świat marki / historia założyciela | kwartał, czasem pół roku |

**Ważne zastrzeżenie do tej tabeli: wypalenie jest funkcją wydatku i częstotliwości, nie kalendarza.** Pojedynczą kreacją nie musisz się przejmować, dopóki nie przepali kilkudziesięciu tysięcy. Przy budżecie 1000 zł miesięcznie „dwa tygodnie" znaczy coś zupełnie innego niż przy 100 tys. Tabela wyżej opisuje typowe konto o średnim wydatku — kalibruj ją swoją częstotliwością.

**Proporcja produkcji — 80/20.** W każdej nowej partii kreacji: **80% to iteracje tego, co już dowozi** (twoje zwycięzcy albo, jeśli ich nie masz, sprawdzone formaty z rynku), **20% to całkowicie nowe koncepty**. To utrzymuje konto przy życiu i jednocześnie daje szansę na przełom. Szczegóły procesu przy statykach → `statyki-ai.md`.

To co dziś sprzedaje, za dwa tygodnie ludzie widzieli sto razy, bo wszyscy to skopiowali.

**Sygnały wypalenia (w tej kolejności):**
1. Rośnie częstotliwość (frequency) przy stałym budżecie
2. Spada CTR i hook rate
3. Rośnie CPM (rośnie też z innych powodów — sezon, konkurencja)
4. Dopiero na końcu spada ROAS

Czekanie na spadek ROAS-u to czekanie za długo. Reaguj na sygnały 1-2.

**Wniosek operacyjny:** potrzebujesz **zapasu**, nie jednej idealnej reklamy. Dlatego mówimy o 15-30 kreacjach na zestaw — nie po to, żeby było ładnie, tylko żeby mieć czym karmić system, zanim to, co leci, się wynudzi.

---

## Rytm pracy z kontem

**Tydzień 0:** komplet 10-25 kreacji, odpalasz, siadasz na rękach.

**Tydzień 1-2:** pierwsza ocena. Identyfikujesz 2-3 zwycięzców. Produkujesz ich warianty. Sprawdzasz brakujące stanowiska.

**Co tydzień od tego momentu:** dorzucasz świeże kreacje. Nie „gdy spadnie ROAS" — **regularnie**, żeby nigdy nie dojść do momentu, w którym konto stoi.

**Raz w miesiącu:** przegląd całości — czy wszystkie 5 stanowisk jest obsadzonych, czy komunikat nadal pasuje do poziomu wypalenia rynku, czy konkurencja nie podebrała mechanizmu.

**Raz na kwartał:** rewizja oferty (→ `oferta.md`). To najtańszy wzrost, jaki istnieje.

---

## Skalowanie budżetu

**Podnoś budżet stopniowo.** Skokowe podniesienie (np. 3x z dnia na dzień) potrafi wrzucić kampanię z powrotem w fazę uczenia i rozjechać wyniki. Bezpieczne tempo to podnoszenie o ~20-30% co 2-3 dni, obserwując, czy CPA trzyma się poziomu.

**Zanim podniesiesz budżet, sprawdź, czy masz czym go obsłużyć.** Więcej budżetu przy tej samej liczbie kreacji = szybsze wypalenie i rosnąca częstotliwość. Skalowanie budżetu i skalowanie produkcji kreacji idą razem.

**Skalowanie w bok:** nowa linia produktowa → nowa kampania z własnym kompletem. Nie doklejaj cudzych produktów do działającej kampanii.

**Ważny niuans przy niskim budżecie:** Meta faktycznie wybierze sobie 1-2 kreacje i będzie wydawać głównie na nie. To nie znaczy, że reszta jest niepotrzebna — przy wzroście budżetu system zaczyna dystrybuować szerzej i wtedy potrzebuje z czego wybierać.

---

## Kiedy problem NIE jest w kreacji

Zanim zaczniesz produkować kolejne 20 kreacji, sprawdź:

| Objaw | Prawdopodobna przyczyna | Gdzie szukać |
|---|---|---|
| Dobry CTR, dobry ruch, zero sprzedaży | Oferta albo strona docelowa | `oferta.md` |
| Słaby CTR na wszystkich kreacjach naraz | Wypalona obietnica / komunikat z za niskiego poziomu | `wypalenie-obietnicy.md` |
| Wszystko było OK i nagle siadło w jeden dzień | Techniczne — piksel, płatność, odrzucona reklama, zmiana na stronie | `struktura-konta.md` |
| Rosnący CPM, stabilna reszta | Sezon / aukcja / konkurencja. Niekoniecznie twój problem. | — |
| Dużo lidów, żaden nie kupuje | Brak kwalifikacji na wejściu | `oferta.md`, litera R |
| Wysoki ROAS, ale niski wolumen | Mówisz tylko do poziomu 5. Brakuje góry lejka. | `komplet-5-kreacji.md` |

Zapamiętaj: **jednocyfrowy ROAS zwykle nie jest problemem budżetu, tylko tego, że gadasz do jednego człowieka, podczas gdy mógłbyś gadać do pięciu.**

---

## Czego nie testować

- **Kolorów przycisków, emotek, drobnych zmian nagłówka.** To nie jest test, to szum.
- **Targetowania.** Zainteresowania są dla algorytmu sugestią, a duża ich część została wyłączona.
- **Struktury konta bez hipotezy.** Jeśli nie umiesz powiedzieć jednym zdaniem, co sprawdzasz i jaki wynik uznasz za rozstrzygający — nie testuj.
- **Wszystkiego naraz.** Zmieniasz kreacje i budżet i cel w tym samym tygodniu → nie wiesz, co zadziałało.

## Uczciwość wobec danych

Nie obiecuj wyników i nie ekstrapoluj cudzych. ROAS 9x czy 20x to konkretne konta, konkretne branże, konkretne marże i konkretny moment. Sensowny benchmark to **twoje własne konto z poprzedniego miesiąca**, nie liczba z czyjegoś case study.

Przy ocenie zawsze pytaj o **marżę i próg opłacalności**, zanim orzekniesz, że ROAS jest dobry albo zły. ROAS 3 przy marży 70% to świetny wynik. ROAS 3 przy marży 25% to strata.

I pamiętaj, że sam panel nie jest prawdą o przychodzie — po iOS 14 rozbieżności atrybucji sięgają 30-50%. Zanim uznasz kreację za przegraną, sprawdź, czy zgadza się to z realnym przychodem w sklepie albo CRM. → `ekonomia-kampanii.md`.
