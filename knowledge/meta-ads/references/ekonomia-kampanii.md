# Ekonomia kampanii — liczby, atrybucja, ograniczenia

Kampania nie żyje w próżni. Reklamy mogą być świetne, a biznes nierentowny — i odwrotnie: przeciętne reklamy potrafią zarabiać, jeśli ekonomia jest ustawiona.

Ekonomia dzieli się na trzy warstwy: **reklamy → lejek → back end.**

---

## Warstwa 1 — ekonomia reklam

To wszystkie miękkie metryki: wydatek, CPM (koszt dotarcia do 1000 osób), CPC, CTR, hook rate, hold rate.

**Cel w jednym zdaniu: najtańszy możliwy ruch przy zachowaniu jakości.**

Uwaga na pułapkę: nie chodzi o najtańszy ruch na świecie. Można zejść z CPM do groszy, kierując reklamy tam, gdzie nikt nie kupuje. Liczy się **iloczyn taniości i dopasowania ruchu do oferty.** To prawda niezależnie od tego, czy robisz e-commerce, usługi, high ticket czy affiliate.

Te metryki są jednocześnie tym, co karmi pierwszy człon równania algorytmu (→ `algorytm-meta.md`).

## Warstwa 2 — ekonomia lejka

**Cel: maksymalna liczba konwersji przy maksymalnej wartości koszyka (AOV).**

Trwa spór, czy lepiej mieć wysoki AOV z przodu, czy niski próg wejścia i zarabiać na powtarzalności. Realnie da się mieć jedno i drugie: wysoki AOV na wejściu **i** dobrą powtarzalność zakupów.

### Zasada Dana Kennedy'ego

> **Wygrywa ten, kto może wydać najwięcej na pozyskanie klienta.**

Rozpisane na liczbach:

| | Ty | Konkurent |
|---|---|---|
| CAC (koszt pozyskania) | 50 zł | 50 zł |
| Wartość klienta | 100 zł | 80 zł |
| Ile możesz dopłacić | +20 zł | 0 |
| **Realny pułap CAC** | **70 zł** | **50 zł** |

Różnica 20 zł w marży wygląda niepozornie. W praktyce oznacza, że **możesz przelicytować konkurenta na aukcji** i nadal być rentowny. Pozyskanie klienta to najtrudniejsza część — gdy już go masz, masz jego mail, telefon i dane, i możesz sprzedawać dalej.

Dlatego podnoszenie AOV jest jedną z najwyżej dźwigniowych rzeczy w całym systemie — i nie kosztuje ani złotówki budżetu reklamowego. Bezpośrednio wiąże się z konstrukcją oferty (→ `oferta.md`, litery F, T i sekwencja ceny).

## Warstwa 3 — ekonomia back endu

Wszystko po pierwszym zakupie. **Cel: maksymalizacja LTV** (lifetime value — łączna kwota, jaką średnio zostawia u ciebie klient).

Klient kupuje raz za 100 zł → AOV 100, LTV 100. Wraca po dwóch miesiącach i kupuje znowu → AOV nadal 100, LTV 200.

**LTV to jest miejsce, gdzie są prawdziwe pieniądze.** Każdy biznes, który wyskalował się bardzo dużo, opanował retencję i powtarzalność zakupu.

- **Low ticket (e-commerce, tanie info, SaaS):** subskrypcja. Dlatego duże marki suplementowe na własnych stronach agresywnie pchają w model abonamentowy — wiedzą, że koszty pozyskania będą tylko rosnąć.
- **High ticket:** ascensions — po programie za X klient wchodzi w program za 2X.

### LTV : CAC

Podstawowy wskaźnik zdrowia biznesu.

| Model | Minimalny sensowny stosunek |
|---|---|
| Ogólne minimum | **3 : 1** |
| High ticket | **7 : 1 – 10 : 1** |

Przy LTV 300 zł nie powinieneś płacić więcej niż 100 zł za klienta.

**Ważne przy ocenie ROAS-u:** zanim orzekniesz, czy wynik jest dobry, musisz znać **marżę** i **próg opłacalności**. ROAS 3 przy marży 70% to świetnie. ROAS 3 przy marży 25% to strata. Nigdy nie oceniaj ROAS-u bez tych dwóch liczb.

---

## Atrybucja — dlaczego panel kłamie

Większość reklamodawców lata na ślepo, bo zakłada, że dane w Menedżerze Reklam są w 100% poprawne. Po iOS 14 to po prostu nieprawda.

Rozbieżności (niedoraportowanie, nadraportowanie, błędna atrybucja) sięgają **od 5-10% w łagodnym przypadku do 30-50% w skrajnym**. Kolejne aktualizacje systemów potrafią rozjechać poszczególne metryki (np. wyświetlenia strony docelowej) z dnia na dzień.

**Konsekwencja, którą trzeba zrozumieć:** jeśli optymalizujesz na podstawie zafałszowanych danych, mówisz Mecie „dosypuj na te reklamy" — a to mogą być reklamy, które realnie tracą pieniądze.

**Co z tym robić:**
- Używaj niezależnego narzędzia atrybucji obok panelu (dla e-commerce jest ich na rynku sporo).
- Traktuj panel jako sygnał kierunku, a nie jako prawdę o przychodzie.
- Zawsze weryfikuj z **realnym przychodem w sklepie / CRM** za ten sam okres.
- Miej pełną jasność co do wszystkich swoich liczb. To brzmi banalnie i większość i tak tego nie robi.

---

## Identyfikacja ograniczeń (constraints)

Wyobraź sobie swój biznes jako wąż ogrodowy. Na wlocie leci ruch, na wylocie sprzedaż. Po drodze są zagięcia — **ograniczenia**. Żeby woda leciała swobodnie, musisz umieć te zagięcia znaleźć i wyprostować.

### Kluczowe rozróżnienie: wskaźnik ≠ ograniczenie

Typowa sytuacja: wszystkie metryki reklamowe świetne — CPC dobry, CPM dobry, CTR fenomenalny. Ale konwersja bardzo niska.

**Niska konwersja NIE jest ograniczeniem. Jest wskaźnikiem, że gdzieś jest ograniczenie.** Mówi ci, że ludzie docierają do lejka i nie kupują. Nie mówi **dlaczego**.

Dlatego musisz mieć KPI na **każdym kroku lejka** i widzieć, gdzie dokładnie następuje odpływ. Realny przykład z życia: gigantyczny odpływ dokładnie na stronie płatności — okazało się, że ktoś nie skonfigurował poprawnie operatora płatności.

### Zasada: zanim odpalisz, spróbuj to zepsuć

Nie chodzi tylko o kontrolę jakości. **Spróbuj aktywnie złamać swój lejek przed startem — bo jeśli tego nie zrobisz, zrobią to twoi klienci.** Liczba osób odpalających lejki, których nigdy sami nie przeszli, jest zdumiewająca.

### Tabela diagnostyczna

| Gdzie siedzi ograniczenie | Objaw |
|---|---|
| Reklamy | Wysoki CPC, niski CTR, słaby hook rate |
| Lejek | Dobry ruch, niska konwersja, wysoki odpływ na konkretnym kroku |
| Oferta | Ludzie klikają, wchodzą, czytają i nie kupują (→ `oferta.md`) |
| Komunikat | Słaby CTR na **wszystkich** kreacjach naraz (→ `wypalenie-obietnicy.md`) |
| Back end | LTV = AOV, czyli powtarzalność zakupu wynosi zero |
| Technika | Płatności, piksel, formularz, prędkość strony |

Gdy masz pełną jasność co do wszystkich liczb, **dane same mówią ci, co robić.** Znajdujesz ograniczenie, skupiasz się na nim, woda zaczyna płynąć.

---

## Entropia — dlaczego przy skalowaniu wszystko się psuje

Entropia to zasada z fizyki: układ zawsze dryfuje od porządku w stronę chaosu. W biznesie działa identycznie.

Ludzie zakładają, że gdy zaczną skalować, wszystko będzie łatwiejsze. Jest odwrotnie: **koszt pozyskania rośnie, trzeba wstrzykiwać więcej kreacji, wyzwania stają się inne i trudniejsze.**

**Jedyne, co spowalnia entropię, to wstrzykiwanie energii w układ.** Są dokładnie trzy sposoby:

1. **Ty sam** — więcej godzin. Ograniczone, bo doba jest skończona.
2. **Kapitał ludzki** — zatrudniasz.
3. **Systemy i AI** — automatyzujesz.

Nic więcej. Jeśli skalujesz i nie wstrzykujesz energii żadnym z tych trzech kanałów, coś się rozsypie.

**Wszystko w końcu umiera.** Zwycięska kreacja. Zwycięskie copy. Zwycięska oferta. Jeśli za nią nic nie stoi, zostajesz z niczym. To nie jest pesymizm, tylko planowanie: **produkuj następną falę, zanim obecna padnie.**

Dodatkowy mechanizm wstrzykiwania energii: ktoś, kto potrafi wytykać dziury w tym, co robisz. Nie widzisz wszystkiego we własnym biznesie. Człowiek, który znajduje problemy, zanim wybuchną, robi ci przysługę.

---

## Checklist ekonomiczny przed skalowaniem

- [ ] Znam swoją **marżę** i **próg opłacalności ROAS**
- [ ] Znam **AOV** i **LTV**, i wiem, czym się różnią w moim biznesie
- [ ] Stosunek **LTV : CAC** jest przynajmniej 3:1
- [ ] Mam **niezależne źródło prawdy** o przychodzie, nie tylko panel Meta
- [ ] Znam **konwersję na każdym kroku lejka**, nie tylko końcową
- [ ] Przeszedłem swój lejek osobiście i próbowałem go zepsuć
- [ ] Wiem, **co jest moim aktualnym ograniczeniem**, i pracuję nad tym, a nie nad czymś innym
- [ ] Mam plan **wstrzykiwania energii** przy wzroście (ludzie / systemy / czas)
- [ ] Mam **następną falę kreacji** w produkcji, zanim obecna padnie
