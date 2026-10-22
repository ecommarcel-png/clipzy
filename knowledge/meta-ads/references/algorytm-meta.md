# Jak działa algorytm Meta

Reklama na Facebooku to sztuka i nauka. Sztuką jest kreacja. Nauką — to, co opisuje ten plik. A dokładniej: **równanie**, które decyduje o tym, czy twoje reklamy są rentowne.

## Cztery kroki, w 200 milisekundach

Za każdym razem, gdy ktoś otwiera Instagram i widzi reklamę, w oknie ~200 ms **dziesiątki milionów reklam** konkurują o tę jedną odsłonę. Meta przepuszcza je przez cztery etapy:

```
dziesiątki milionów  →  RETRIEVAL       →  miliony
miliony              →  LIGHT RANKING   →  tysiące
tysiące              →  HEAVY RANKING   →  kilkaset
kilkaset             →  AUKCJA          →  jedna reklama
```

### 1. Retrieval — tu twoja kreacja staje się targetowaniem

Najbardziej zasobożerny etap. Meta odsiewa reklamy kompletnie nierelewantne dla tego użytkownika — „czy to jest w ogóle w odpowiednim rejonie?".

**I to jest etap, na którym Meta analizuje twoją kreację, żeby ustalić, komu ją pokazać.** Właśnie tu dosłownie realizuje się hasło „kreacja jest twoim targetowaniem".

Co jest analizowane (lista niepełna):
- **hook** i pierwsze sekundy
- **format** kreacji
- **demografia osób widocznych w kreacji** — jeśli w reklamie występuje 55-letnia kobieta, system to odnotowuje i przesuwa targetowanie w stronę kobiet, i to raczej starszych
- **copy** i tekst na kreacji
- **skrypt** przy wideo
- **miniatura**
- **twoja strona docelowa**

Praktyczna konsekwencja: **casting i dobór bohatera kreacji to decyzja targetingowa.** Chcesz dotrzeć do innego segmentu — zmieniasz osobę w kadrze, język i kontekst, a nie ustawienia zestawu.

### 2. Light ranking

Miliony → tysiące. Etap prawie bez opisu, czysta redukcja.

### 3. Heavy ranking — tu działa równanie

Tysiące → kilkaset. **Dopiero na tym etapie „konkurencja" ma sens** — nie masz dziesięciu milionów konkurentów, masz garstkę. Na całym Facebooku jest ok. 10 mln reklamodawców, a po zawężeniu do twojej kategorii zostaje niewielka grupa.

Tu każda reklama dostaje wartość. Wyższa wartość wygrywa odsłonę, niższa dostaje gorszą jakościowo odsłonę albo nic.

```
TOTAL VALUE = [ bid × estimated action rate ]  +  [ wartość i jakość dla użytkownika ]
                      ↑                                        ↑
              wartość dla reklamodawcy                 ochrona doświadczenia
```

Przy kampanii konwersyjnej (czyli u 99% z nas):

```
estimated action rate = estimated CTR × estimated click-to-conversion rate
```

**Co z tego wynika operacyjnie:**

**Człon pierwszy — estimated CTR.** Historycznie Meta uwielbia reklamy z wysokim CTR, bo to najczystszy sygnał relewantności dla użytkownika. W praktyce to nie jest tylko CTR — to **suma wszystkich miękkich metryk**: CTR, CPC, CPM, hook rate, hold rate, koszt 3-sekundowego odtworzenia. Wszystko, co mówi „ludzie się na tym zatrzymują i klikają". Wysoki CTR nagradzany jest z czasem niższymi CPM i lepszym jakościowo ruchem.

**Człon drugi — click-to-conversion.** Ile z kliknięć zamienia się w zakup / lead / rozmowę. To już nie jest robota kreacji, tylko **oferty, strony i lejka**. Możesz mieć genialny hook i przegrać tutaj.

**Człon trzeci — doświadczenie użytkownika.** Meta broni się przed reklamodawcami, którzy zalaliby platformę. Bez tego komponentu proporcja scamu byłaby 50/50 zamiast obecnych ~80/20. Praktycznie: agresywne clickbaity, mylące obietnice i złe doświadczenie po kliknięciu kosztują cię pozycję w rankingu, nawet przy dobrym CTR.

Trzy dźwignie w jednym zdaniu: **bądź relewantny (miękkie metryki), monetyzuj kliknięcie (lejek), nie wkurzaj użytkowników.**

### 4. Aukcja

Zostaje kilkaset reklam. Wygrywa najwyższa wartość — w kontekście całego równania, nie samej stawki.

**Strategie licytacji:**

| Strategia | Co robi | Kiedy |
|---|---|---|
| **Lowest cost** (auto bidding) | Meta licytuje sama, szuka konwersji najtaniej | Domyślne. Konta wydające pięcio- i sześciocyfrowe kwoty dziennie działają na tym i są rentowne |
| **Cost cap** | Ustalasz maksymalny koszt pozyskania klienta | Gdy masz twardy próg opłacalności |
| **Bid cap** | Ustalasz maksymalną stawkę | Gdy chcesz twardo kontrolować aukcję |

Ludzie potrafią obsesyjnie wracać do tego, która metoda jest „ta właściwa". Są konta na sześciocyfrowym dziennym wydatku na lowest cost i są konta, które jadą wyłącznie na bid capach. **Wybierz to, co rozwiązuje ograniczenie w twoim biznesie** — a nie to, co jest akurat modne.

Przy okazji: droga z 1 tys. do 10 tys. dziennie zwykle nie prowadzi przez media buying. Media buying pomaga, ale to myślenie przedsiębiorcy — oferta, marża, LTV — otwiera pułap (→ `ekonomia-kampanii.md`).

---

## Andromeda

Aktualizacja sortowania na etapie retrieval. Powód: **gigantyczny napływ kreacji generowanych przez AI**, przez który stary model przesiewania przestał sobie radzić. To nie jedyny powód, ale prawdopodobnie największy.

**Co zmieniła praktycznie:**

- Meta patrzy **głównie na kreację** przy ustalaniu targetowania, a nie na to, co masz w zestawie reklam.
- Dlatego widać spadek zdolności grup opartych na zainteresowaniach do utrzymywania wysokich budżetów przy rentowności.
- Doświadczeni reklamodawcy praktycznie nie ustawiają targetowania. Nawet przy remarketingu jadą szeroko — maksymalnie z jednym wykluczeniem (kupujący).

**Zła interpretacja Andromedy, która krąży po rynku:** „testuj tylko net new concepts, wariacje są martwe".

To nieprawda. Wariacje nadal są bardzo skuteczne. Mechanika wygląda tak:

```
ZESTAW REKLAM  =  jeden nowy koncept
├── Reklama 1  — koncept w wersji bazowej
├── Reklama 2  — wariacja (inny hook)
├── Reklama 3  — wariacja (inny hook)
└── Reklama 4  — wariacja (inny format)
```

Wariacje dają ci **więcej podejść do tego samego konceptu**. Bardzo często zwycięzcą okazuje się wariacja, a wersja bazowa przegrywa. Kto uznał, że wariacje są bez sensu, nigdy się tego nie dowie i błędnie zakwalifikuje cały koncept jako przegrany.

Uwaga na niuans: **wariacja topowej reklamy w koncie rzadko przebija oryginał.** Wypada przyzwoicie, ale zwykle nie lepiej. Wariacje służą do rozpoznania konceptu, nie do wyciskania zwycięzcy w nieskończoność.

---

## Faza uczenia — co z nią naprawdę jest

Teoria: reklamy, zestawy i kampanie przechodzą przez fazę uczenia, zbierają konwersje, potem wychodzą do stanu „dojrzałego" z przewidywalnymi wynikami.

**Rzeczywistość: twoje reklamy uczą się cały czas. Nigdy nie przestają.** Nie ma czegoś takiego jak wyjście z fazy uczenia i wieczna stabilność. Wszystko w końcu umiera — taki jest cykl życia reklam.

Wniosek: **przestań obsesyjnie patrzeć na fazę uczenia.** Owszem, na początku jest bardziej wyboiście. Czasem z czasem robi się stabilniej, czasem nie. Czasem rozwiązaniem jest po prostu zrobić lepsze reklamy.

**Zmienność jest normalna, szczególnie poniżej ~1000 zł/dzień wydatku.** Jeśli twoje wyniki wyglądają jak sinusoida — to jest w 100% normalne. Meta jest emocjonalną platformą pełną emocjonalnych ludzi, więc trudno oczekiwać stabilności laboratoryjnej.

Ktoś narzeka, że miał ROAS 3, a teraz jest nierentowny. Pytanie: ile wydałeś? Sto złotych? To nie jest wynik, to jest szum.

**Zasada: w razie wątpliwości oddal widok.** Nie „dziś było dobrze, wczoraj źle". Patrz na 7 dni, na największą ilość wydatku, jaką masz. Wtedy podejmujesz decyzje na danych, a nie emocjonalnie, płynąc z prądem Facebooka.

---

## Jakość sygnału — CAPI, EMQ, atrybucja

Skuteczność Meta zależy między innymi od jakości danych, które wysyłasz z powrotem na serwery. Lepsze dane → teoretycznie lepsze uczenie się o twoich klientach i tańsza reklama długoterminowo.

**EMQ (Event Match Quality)** — w Menedżerze zdarzeń, przy zdarzeniu zakupu, skala 1-10.

**Conversions API (CAPI)** — wysyłanie danych server-side, nie tylko z przeglądarki.

Kontekst: po iOS 14 (wdrożenie na początku 2021) użytkownicy mogą wypisać się ze śledzenia i wszystko stało się mocno niedokładne. CAPI i server-side tracking to sposób na częściowe odzyskanie sygnału.

**Ale — uczciwie:** cała koncepcja EMQ bywa przereklamowana. Zdarzają się bardzo dobre setupy server-side z EMQ 9,8-9,9 bez wyraźnej korelacji z wynikiem, i konta z zerowym „opportunity score" od Meta, które są bardzo rentowne.

Podsumowanie w dwóch zdaniach: **staraj się wysyłać Mecie dobre dane. I traktuj dane konwersyjne z panelu z rezerwą.**

Poważni reklamodawcy nie patrzą na CPA w panelu Meta jako na prawdę — używają niezależnych narzędzi atrybucji. Rozbieżność potrafi wynosić od 5-10% do nawet 30-50% (→ `ekonomia-kampanii.md`).

---

## Meta nie gra fair

Ostatnia część, dla tych, którzy chcą zrozumieć, jak to naprawdę działa.

Wszystko powyżej to „według podręcznika" — dokumentacja Meta, obecna albo wycofana. A teraz kontekst:

Meta to spółka giełdowa nastawiona na zysk. Odpowiada przed akcjonariuszami. **Zależnie od tego, jak wypadają wyniki kwartalne, Meta albo zaostrza, albo luzuje restrykcje.** Stąd fale banów: przez miesiąc wszystkim lecą blokady kont reklamowych, business managerów i profili, a miesiąc później jest zupełnie spokojnie.

Stąd też sytuacje, w których jedna osoba puszcza dany format i przechodzi, a druga puszcza praktycznie identyczną kreację i dostaje odrzucenie.

Meta chce zarobić najwięcej od największych reklamodawców. Mniejsi, którzy generują większość problemów obsługowych, nie będą traktowani szczególnie dobrze.

**Praktyczny wniosek: kwestionuj wszystko.** To, że coś jest w dokumentacji Meta albo mówi to ich CMO, nie znaczy, że to jest dla ciebie optymalne. **Sugestie w panelu — te, które obiecują obniżenie kosztu wyniku o kilkanaście procent — potrafią zrujnować działające kampanie.** Nie klikaj ich odruchowo.

To nie jest teoria spiskowa, tylko rozumienie, że jesteś klientem firmy, która chce twoich pieniędzy.

---

## Trzy rzeczy do zapamiętania

1. **Kreacja jest twoim targetowaniem.** Przestań grzebać w zestawach, custom audiences i lookalike'ach. Zostaw sobie z tego mały piaskownicowy eksperyment, a resztę puść szeroko.
2. **Rób dobre kreacje, które wyrywają ludzi ze scrolla.** Wysoki CTR i dobre miękkie metryki to dosłownie połowa równania.
3. **Nie psuj doświadczenia użytkownika.** Trzeci człon równania też się liczy.
