# Struktura konta i kampanii

## Co się zmieniło i dlaczego to dobra wiadomość

- Meta wyłączyła ogromną część szczegółowych zainteresowań (zmiana z 15 stycznia). Zestawy reklam, które na nich stały, przestały chodzić.
- To, co zostało, algorytm traktuje jako **sugestię**, nie polecenie. Wpisujesz zainteresowanie, system mówi „dzięki za podpowiedź" i radzi sobie sam.
- Twardo trzymane są dwie rzeczy: **lokalizacja** (i to nieprecyzyjnie) oraz **minimalny wiek**.
- **Advantage+ jest domyślny** przy celu sprzedażowym — targetowanie, umiejscowienia, ulepszenia kreacji, budżet są wstępnie włączone, zanim czegokolwiek dotkniesz.
- Kampanie zautomatyzowane dają średnio ~20% wyższy zwrot niż ręcznie poskładane. Kto z tym walczy, zostawia pieniądze na stole.

Wniosek: robota przeniosła się z panelu do kreacji. Panel ma być nudny.

**Dlaczego tak jest technicznie:** Meta analizuje twoją kreację na etapie retrieval — hook, format, demografię osób w kadrze, copy, skrypt, miniaturę, a nawet stronę docelową — i na tej podstawie ustala, komu ją pokazać. Aktualizacja Andromeda tylko to wzmocniła. Pełna mechanika → `algorytm-meta.md`.

## Docelowa struktura

**Jedna linia produktowa albo jedna usługa = jedna kampania = jeden zestaw reklam.**

```
KAMPANIA (cel: sprzedaż / leady) — budżet na poziomie kampanii (CBO / Advantage+ campaign budget)
└── ZESTAW REKLAM (jeden) — Advantage+ / szerokie targetowanie
    ├── Kreacja 1
    ├── Kreacja 2
    ├── ...
    └── Kreacja 15-30
```

Druga linia produktowa → druga taka sama kampania. Trzecia → trzecia. Każda na tej samej, banalnie prostej zasadzie.

Ustawienie takiej kampanii zajmuje ok. 20-30 minut. To nie jest skrót — to jest docelowy stan.

## Dlaczego nie TOFU / MOFU / BOFU

Klasyczny błąd: osobna kampania na świadomość, osobna na rozważanie, osobna na konwersję. Plus zestaw na kobiety 25-34 zainteresowane stylizacją, zestaw na 35-44 zainteresowane beauty, zestaw na fanki celebrytki, zestaw remarketingowy.

Te same osoby łapią się do kilku zestawów naraz. **Twoje własne zestawy stają na aukcji przeciwko sobie i licytują się o tego samego człowieka.** Sam sobie podbijasz cenę, żeby konkurować ze sobą.

Dodatkowo: rozbite budżety = każdy zestaw dłużej zbiera dane = wolniejsze wyjście z fazy uczenia albo wieczne w niej siedzenie.

Rozwiązanie: wszystko do jednego worka, algorytm dopasowuje kreację do człowieka. Zrobi to lepiej niż ty, bo wie o tych ludziach rzeczy, których ty się nigdy nie dowiesz.

## Remarketing

Robi się sam. Nie budujesz osobnej kampanii do tych, co byli na stronie i mieli w koszyku. To się robiło dwa lata temu.

Sprawdzenie: w ustawieniach kampanii wejdź w **segmenty grup odbiorców** — widzisz czarno na białym, ile budżetu poszło na zupełnie nowych ludzi, a ile na tych, którzy cię już znają. System rozkłada to sam.

Twoja rola: **przygotować kreacje stricte remarketingowe** (poziom 4 i 5 świadomości — dowód społeczny, odpowiedzi na obiekcje, oferta) i wrzucić je do tego samego zestawu. Nie wchodzić algorytmowi w drogę.

## Ustawienia — checklist

| Element | Ustawienie | Uwaga |
|---|---|---|
| Cel kampanii | Sprzedaż (zakupy) / Kontakty (leady) | Nie ruch, nie zaangażowanie, nie zasięg |
| Zdarzenie optymalizacji | Zakup / Lead | Optymalizuj na to, co realnie chcesz — nie na „dodanie do koszyka", chyba że wolumen zakupów jest za niski |
| Budżet | Na poziomie kampanii (CBO) | Nie rozbijaj na zestawy |
| Targetowanie | Advantage+ / szerokie | Lokalizacja + minimalny wiek. Zainteresowania opcjonalnie jako sugestia, nie jako filtr |
| Umiejscowienia | Automatyczne | Advantage+ placements |
| Ulepszenia kreacji | Włączone, ale kontrolowane | Wyłącz te, które psują komunikat (np. losowe nakładki tekstowe na kreacji, gdzie tekst już jest) |
| Format kreacji | 9:16 pionowo (rolki), 1:1 lub 4:5 (statyki) | Nigdy poziomo |
| Piksel / CAPI | Podpięty i zweryfikowany + Conversions API | Bez tego optymalizacja jest ślepa |
| Okno atrybucji | 7 dni klik / 1 dzień wyświetlenie (domyślne) | Trzymaj się jednego, żeby dane były porównywalne |

## Ile kreacji w zestawie

- **Start / mały budżet:** 10 kreacji (5 typów × grafika + rolka) — patrz `komplet-5-kreacji.md`.
- **Standard:** 15-25 kreacji (3-5 rolek + 3-5 statyków na każdy z 5 poziomów świadomości).
- **Duże konta:** 15-30 kreacji na zestaw, na dużych kontach z długim cyklem decyzyjnym (meble, kuchnie, nieruchomości) nawet ~300 kreacji równolegle.

Ważny niuans, który prawie nikt nie rozumie: **przy bardzo niskim budżecie Meta faktycznie wybierze sobie 1-2 kreacje i będzie wydawać głównie na nie.** Reszta będzie leżeć. Ale gdy wchodzisz na poważniejsze pieniądze, budżet zaczyna być dystrybuowany szerzej — system testuje, szuka, podaje różne kreacje różnym ludziom. Jeśli masz wtedy w kampanii jedną grafikę, algorytm nie ma z czego wybierać. To jak wejść do kasyna z jednym żetonem i dziwić się, że rzadko wygrywasz.

Dlatego lejek pięciu kreacji buduje się **od początku**, nawet przy najprostszej kampanii, nawet gdy dopiero zaczynasz.

## Kiedy struktura może być bardziej złożona

Rzadko, ale bywa. Uzasadnione powody na drugi zestaw albo drugą kampanię:

- **Osobna linia produktowa / usługa** z inną obietnicą i innym klientem — wtedy osobna kampania.
- **Osobny rynek geograficzny** z innym językiem i inną walutą.
- **Radykalnie inny cel** (np. równolegle lecąca kampania leadowa i sprzedażowa).
- **Świadomy test strukturalny** z jasną hipotezą i budżetem wystarczającym, żeby oba warianty wyszły z fazy uczenia.

Wszystko poza tym to komplikowanie. Sprawdź motywację: czy ta struktura ma poprawić wynik, czy zrobić wrażenie na kliencie/szefie?
