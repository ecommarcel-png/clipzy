---
name: sklejki-meta-ads
description: Wiedza montażowa do tworzenia "sklejek" — reklam wideo Meta (Facebook/Instagram) sklejonych z wielu krótkich ujęć produktowych, z lektorem albo bez (muzyka + teksty). Używaj przy wyborze hooka, doborze i kolejności ujęć, tempie cięć, stylu napisów, muzyce, SFX, logo, ofercie/CTA, formatach oraz przy ocenie skryptu lektora oraz przy decyzji o wygenerowaniu brakujących ujęć AI. Wersja 0.2 — zbudowana z zasad właściciela, 5 przeanalizowanych reklam i researchu z października 2026.
---

# Sklejki do Meta Ads — baza wiedzy (v0.2)

## Jak czytać ten dokument

Kolejność ważności przy konflikcie zasad:
1. **[M] Zasady właściciela (Marcel)** — nadrzędne, nie łam ich bez wyraźnego powodu.
2. **[R] Wzorce z działających reklam** — karty w `karty/*.json` (pole `weryfikacja_wizualna` ma pierwszeństwo przed `analiza_gemini`).
3. **[W] Wiedza ogólna i research** — dane Meta, praktyki agencji; traktuj liczby jako kierunkowe, nie prawa natury.

Zawsze dostajesz też **profil marki** i **profil produktu** (grupa docelowa, ton, kolory, logo, problem, mechanizm, oferta). Każda decyzja montażowa ma z nich wynikać.

---

## 1. Zasady nadrzędne [M]

1. **Hook jest najważniejszy.** Uwaga to dziś najcenniejsza waluta. Hook musi być jednocześnie **wizualny i dźwiękowy**: kadr, dźwięk, słowa (lektor lub tekst) i ewentualna animacja mają grać razem, perfekcyjnie. Hook, który działa tylko na jednym kanale, to hook niedokończony.
2. **Napisy w stylu marki.** Styl animowanych napisów wynika z komunikacji marki i grupy docelowej (patrz rozdz. 6). Tandeta = porażka, nawet jeśli napis jest czytelny.
3. **Problem i przed/po to paliwo CTR.** Widz musi **zobaczyć swój problem** i **zobaczyć jego rozwiązanie**. Jeśli w materiałach jest przed/po — wykorzystaj je. To wpływa na CTR, nie tylko na CPC.
4. **Efekt WOW jak najszybciej.** Jeśli produkt wywołuje efekt WOW (wielkość, transformacja, nietypowe działanie), pokaż go w hooku, nie w środku reklamy.

---

## 2. Hook (0–3 s)

**Zadanie hooka:** zatrzymać scroll i zakwalifikować widza (żeby został właściwy człowiek). Hook nie sprzedaje — sprzedaje body. [W]

**Twarde reguły**
- Pierwsza klatka jest **ostra, czytelna i już coś pokazuje** — nigdy rozmazany ruch, czarna klatka czy logo na start. [R: ad01 startuje rozmazaną klatką — błąd]
- **Tekst na ekranie od pierwszej klatki.** [W]
- **Produkt widoczny najpóźniej do ~1 s**, chyba że hook to celowa emocjonalna scena (wtedy max ~3 s). W 4 z 5 przeanalizowanych reklam produkt jest w kadrze w pierwszych 3 s; wyjątek to ad03, gdzie hook opiera się na formacie wywiadu, a produkt pojawia się dopiero ok. 8 s. [R]
- **Obraz + dźwięk razem w pierwszych 1–2 s** — Meta raportuje wyższą intencję zakupu dla hooków łączących oba kanały. [W] Na Reels ponad 80% odtworzeń jest z dźwiękiem, więc dźwięk w hooku ma znaczenie; jednocześnie tekst musi nieść sens dla tych, którzy mają wyciszone. [W]
- **Marka i główny przekaz w pierwszych 5 s.** [W]

**Mechanizmy hooka (wybierz jeden wiodący)**
| Mechanizm | Kiedy | Przykład z bazy |
|---|---|---|
| Efekt WOW na start | produkt robi wrażenie wizualnie | ad01: ogromny miś z klocków przy twarzy kobiety |
| Anty-wzorzec / odrzucenie alternatywy | znany ból kategorii | ad01: „Zapomnij o prezentach, które lądują na dnie szuflady” |
| Wywołanie grupy docelowej (POV) | produkt dla konkretnej roli | ad02: „Dzisiaj odebrałam prezent dla mojego dziecka” |
| Format „reporterski” / dowód społeczny | produkt wymaga zaufania | ad03: „Zapytaliśmy kobiety na ulicy…” |
| Emocja / lęk przed stratą | produkt emocjonalny | ad05: psy idące do nieba + „Zrobię to później…” |
| Problem pokazany wprost | produkt rozwiązuje widoczny problem | (do zebrania więcej przykładów) |
| Przed/po w hooku | transformacja jest widoczna | ad03 ma przed/po dopiero w 34 s — **do testu wariant z przed/po w hooku** |
| Ciekawość / otwarta pętla | każdy | „ta kawa nie powinna smakować dobrze…” — nie zdradzaj odpowiedzi od razu [W] |

**Dobór klipu na hook** — oceń każdy klip z materiałów pod kątem: ostrość pierwszej klatki, ruch w pierwszej sekundzie, czy widać produkt, czy widać problem/efekt, czy jest twarz z emocją, czy kadr ma wolne miejsce na tekst w strefie bezpiecznej. Na hook wybieraj klip o najwyższej ocenie, który **zgadza się z pierwszym zdaniem skryptu**.

**Warianty hooków (różnorodność kreacji)** — gdy tworzysz 3–5 wariantów, każdy wariant zmienia **jednocześnie**: klip otwierający, tekst hooka i pierwszy dźwięk. Sama zmiana napisu na tym samym klipie to nie jest nowy wariant — algorytm Meta (Andromeda) grupuje bardzo podobne kreacje i traktuje je jak jedną. [W]

---

## 3. Struktura reklamy

### 3a. Sklejka z lektorem (domyślnie 25–45 s)
| Etap | Czas orientacyjny | Cel | Jakie ujęcia |
|---|---|---|---|
| Hook | 0–3 s | zatrzymać, zakwalifikować | najmocniejszy klip (WOW / problem / emocja) |
| Problem / historia | 3–8 s | widz rozpoznaje siebie | problem w życiu, frustracja, „przed” |
| Mechanizm | 8–15 s | dlaczego TEN produkt działa, a inne nie | zbliżenia na cechę (np. krzyżowy pas, technologia), demonstracja |
| Demonstracja / korzyści | 15–25 s | pokazać rezultat | produkt w użyciu, „po”, reakcje ludzi |
| Dowód społeczny | 20–30 s | zaufanie | wiele osób z produktem, opinie, liczby („10 000+ klientek”) |
| Oferta + odwrócenie ryzyka + pilność | ostatnie 5–8 s | przepchnąć do zakupu | produkt/zestaw, gest wskazania, plansza z ofertą |
| CTA | ostatnie 3–5 s | konkretne działanie | tekst CTA na ekranie ≥ 3 s + lektor |

Zasady [W][R]:
- Body sprzedaje na sprawdzonym przekazie (USP, unikalny mechanizm), nie na ogólnikach.
- Koniec to nie „sprawdź na stronie” — to **obiekcje, odwrócenie ryzyka, dowód społeczny, oferta, pilność**.
- **Pokaż produkt wiele razy** w trakcie (Meta: wyraźnie wyższa intencja zakupu) i **podawaj kontekst/cechy**, nie tylko ładne ujęcia. [W]
- **Ujęcie musi ilustrować dokładnie to, co lektor mówi w tej chwili.** To najważniejsza reguła doboru b-rollu. [R: ad01, ad03 — „otworzyli pudełko” → worek klocków, „patrzysz w lustro” → lustro]

### 3b. Sklejka bez lektora (muzyka + teksty) — domyślnie 12–20 s
- 5–7 plansz tekstowych, **jedna myśl = jedna plansza = jedno ujęcie**, 2–4 słowa, ok. 2–3 s na planszę. [R: ad05]
- Muzyka niesie emocję, tekst niesie sens.
- Kolejność: hook (emocja/problem) → rozwiązanie → 2–3 korzyści (krótkie hasła) → efekt końcowy → logo/CTA.
- Cięcia w rytm muzyki.

### 3c. Inne formaty z bazy (nie są sklejkami, ale warto znać)
- **AI talking head / UGC** (ad02) — awatar mówi do kamery; moduł „AI nagrania”.
- **Organiczne UGC** (ad04) — jedna twórczyni, długie ujęcia; montaż minimalny.
- **Mashup**: wywiad + b-roll + przed/po + plansza dowodu społecznego (ad03) — sklejka może wpleść klipy „rozmowy” jako ramę narracji.

---

## 4. Dobór i kolejność ujęć

1. Najpierw **opisz każdy klip** z materiałów: co widać, typ ujęcia (zbliżenie produktu / w użyciu / reakcja / unboxing / przed / po / detal / packshot / twarz UGC / problem), czy jest ruch, jakość, czy ma wolne miejsce na tekst, czy ma napisy lub watermark.
2. Rozpisz skrypt na **zdania/frazy z timestampami** (z transkrypcji lektora).
3. Do każdej frazy przypisz klip, który **dosłownie** ją ilustruje. Jeśli nie ma dosłownego — klip, który ilustruje jej emocję albo korzyść.
4. Ten sam klip może wrócić najwyżej raz i w innym fragmencie (inne kadrowanie/zakres).
5. **Nie używaj klipów z cudzymi napisami/watermarkiem** — najpierw remover albo pomiń.
6. Klip z twarzą i emocją (radość, zachwyt) stawiaj po demonstracji efektu — to „nagroda”. [R: ad01 — reakcja dziewczynki po złożeniu]
7. Produkt w kadrze co najmniej w hooku, w środku i w ofercie.
8. **Materiały użytkownika używasz takimi, jakie są** — także gdy pokazują inny model, kolor albo wersję produktu. To decyzja użytkownika: nie odrzucasz takich nagrań, nie podmieniasz w nich produktu (chyba że użytkownik o to poprosi) i nie zgłaszasz tego jako usterki. [M]
9. **Zdjęcia produktu tylko na końcu** (packshot przed CTA). W środku reklamy zawsze wideo — statyczne zdjęcie z zoomem w środku wygląda tanio i nudno. Brakuje ujęcia → użyj innego nagrania albo wygeneruj wideo (rozdz. 4a). [M]

---

## 4a. Brakujące ujęcia — generowanie AI [M]

Jesteś **reżyserem i kontrolerem całego procesu**. Inne modele (wideo, obraz, transkrypcja, analiza wideo) wykonują zadania na Twoje polecenie, a Ty sprawdzasz każdy ich wynik, zanim trafi do montażu.

**Kiedy generować ujęcie**
- Do zdania skryptu nie ma w materiałach klipu, który je dosłownie ilustruje, a zdanie jest ważne (hook, problem, przed/po, efekt WOW, mechanizm).
- Najlepszy dostępny klip na hook jest słaby (nieostry, statyczny, bez produktu, bez emocji).
- Brakuje sceny trudnej do nagrania, a mocnej emocjonalnie (np. „psie niebo” w ad05) albo wizualizacji problemu.

**Kiedy NIE generować**
- Gdy prawdziwy klip istnieje i jest wystarczający — prawdziwe nagrania produktu są wiarygodniejsze.
- Gdy ujęcie miałoby udawać efekt działania produktu, którego produkt realnie nie daje (fałszywe przed/po).

**Jak generować**
1. Napisz brief ujęcia: co ma być w kadrze, jaka emocja, który moment skryptu ilustruje, czas trwania (zwykle 3–5 s), format 9:16.
2. Jeśli w kadrze ma być produkt — najpierw wygeneruj **pierwszą klatkę** ze zdjęciami produktu jako referencją, a potem ją animuj (image-to-video). Dzięki temu produkt zachowuje wygląd.
3. Dopasuj styl do reszty materiału (światło, kolorystyka, „telefoniczny” vs studyjny wygląd), żeby ujęcie nie odstawało.

**Kontrola wyniku (obowiązkowa, przed użyciem)**
- Czy produkt wygląda jak na zdjęciach referencyjnych (kształt, kolor, etykieta, logo)? Jeśli nie — generuj ponownie albo nie używaj.
- Czy nie ma artefaktów AI: zdeformowane dłonie i twarze, rozjechany tekst, „pływające” obiekty?
- Czy ujęcie ilustruje właściwe zdanie i pasuje stylem do sąsiednich klipów?
- Maksymalnie 2–3 próby na jedno ujęcie; potem użyj najlepszego dostępnego prawdziwego klipu i zapisz w raporcie, czego zabrakło.
- W raporcie dla użytkownika zawsze wypisz, które ujęcia są wygenerowane, ile kosztowały i dlaczego powstały.

---

## 5. Tempo i cięcia

Zmierzone w bazie [R]:
| Reklama | Typ | Śr. długość ujęcia | Zakres |
|---|---|---|---|
| ad01 Blokomiś | dynamiczna sklejka z lektorem, rodzice | **1,3 s** | 0,2–3,2 s |
| ad05 Wieczna Łapa | bez lektora, emocjonalna | 2,8 s | 2,0–4,1 s |
| ad03 Somavela | mashup, kobiety 25–55 | 3,2 s | 0,9–7,2 s |
| ad04 Przytulny Kąt | organiczne UGC | 3,4 s | 0,9–8,5 s |
| ad02 Blokomiś B | AI talking head | 7,5 s | 7,0–7,8 s |

Reguły:
- **Tnij na granicach fraz lektora** (koniec frazy = cięcie), w sklejce bez lektora — na beat muzyki.
- Profil tempa zależny od grupy docelowej:
  - **Gen Z / młodzi / zabawki dynamiczne:** 0,7–1,5 s na ujęcie, więcej efektów (zoom-in, speed ramp, pop-up, SFX).
  - **Uniwersalny (rodzice 25–45):** 1,2–2,5 s.
  - **Kobiety 25–50 beauty/dom, produkty emocjonalne:** 1–2,5 s, płynnie i elegancko — ale z efektami montażowymi z rozdz. 5a (bez nich sklejka jest nudna). [M]
  - **50+:** 2,5–4 s, spokojnie, bez gwałtownych efektów.
- W sklejce pierwsze cięcie najpóźniej ok. 3 s (chyba że ujęcie hooka samo w sobie ma silny ruch); research zaleca cięcie co 2–3 s. [W] Formaty z jedną mówiącą osobą tną później (w bazie pierwsze cięcie w 4–7,6 s) — tam dynamikę daje mowa, nie montaż. [R]
- Długie ujęcie (> 4 s) tylko gdy to ciągła demonstracja, którą warto zobaczyć w całości.

---

## 5a. Warsztat montażu — efekty, które robią robotę [M]

Sama sekwencja ujęć z napisami to za mało. Każda sklejka ma mieć efekty, które **pokazują** to, co mówi lektor. Dobieraj je do treści, nie dla ozdoby:

| Gdy lektor mówi o… | Efekt |
|---|---|
| efekcie / transformacji | **split screen przed/po** (góra/dół w 9:16 i 4:5) z etykietami „Przed” / „Po ✓” — najlepiej już w hooku |
| problemie, bólu, starej metodzie | **szary obraz** (desaturacja) na czas problemu; przy bólu krótki **shake** i punch-in zoom |
| konkretnych objawach | **pulsujące kółka** wskazujące problem w kadrze (np. czerwone kropki) |
| przejściu do rozwiązania | **przejście w kolorze marki** (wipe), obraz wraca do koloru |
| tym, czego produkt nie wymaga („bez maszynki”, „bez ładowania”) | **pop-up ikony** w białym kółku, która po chwili się **przekreśla** |
| przewadze nad alternatywą | **porównanie split**: alternatywa (szara, ✗) vs produkt (kolor, ✓), badge pojawiają się na słowach |
| ruchu / sposobie użycia („kilka kółek”) | animowana ikona (np. obracające się strzałki) |
| efekcie końcowym (gładkość, blask) | **sheen** (przesuwające się światło) + delikatne **iskierki** |
| korzyściach na końcu | **chipsy z ✓** pojawiające się po kolei nad packshotem |

Zasady:
- Każdy efekt ma **SFX** (whoosh na przejściach, pop na ikonach, „kreska” na przekreśleniu, ding na ✓, shimmer na iskierkach) — cicho, pod lektorem.
- Słowa-klucze w napisach wyróżniaj tłem w kolorze marki (np. „znikają.”, „Boli.”, „gładka skóra.”) — 1 wyróżnienie na planszę.
- Lektor bez martwych pauz: przerwy między zdaniami 0,1–0,25 s; jeśli lektor jest wolny, przyspiesz o ok. 5% (bez zmiany wysokości głosu). Pauzy mierz detekcją ciszy, nie czasami słów z modelu.
- **Zero migających klatek:** przed cięciem wykryj cięcia wewnątrz każdego klipu (detekcja scen) i trzymaj zakresy min. 0,1 s od nich; ujęcia licz co do klatki; po renderze skanuj film pod kątem ujęć < 0,2 s i czarnych klatek.
- Szybkie przyspieszenie (> 1,5×) ujęć z podnoszeniem/odkładaniem produktu daje efekt mrugania — wtedy wybierz spokojniejszy fragment.

---

## 6. Napisy — styl według grupy docelowej [M][R]

### Kolor napisów [M]
**Kolor napisów pochodzi z palety marki.** Profil grupy docelowej (poniżej) decyduje o pozostałych cechach stylu: liczbie słów na planszę, animacji, wielkości, kroju, cieniu i obrysie. Kolory podane w profilach to wartości domyślne, gdy marka nie ma palety albo jej kolor jest nieczytelny na danym ujęciu. Wtedy (i tylko wtedy) użyj bieli lub koloru z profilu, a kolor marki daj na akcent kluczowego słowa.

Czytelność ma pierwszeństwo przed kolorem: jeśli kolor marki ma zbyt niski kontrast z tłem ujęcia, dodaj obrys, cień albo tło pod tekstem w kontrastowym odcieniu.

### Profile stylu
**A. Kobiety 25–50, beauty / bielizna / dom** [M]
- Kolor domyślny (gdy brak palety marki): baby pink albo czysta biel; subtelny cień lub cienki obrys — czytelnie, ale **nie tandetnie**.
- **Nie zmieniaj napisów co słowo** — minimum ok. 3 słowa na planszę.
- Wyróżnienie 1 kluczowego słowa kolorem marki/akcentu jest OK. [R: ad03 — podświetlenie na różowo]
- Krój: czysty sans albo elegancki szeryf. [R: ad04 — szeryf na półprzezroczystym, zaokrąglonym tle, słowa dokładają się do frazy]

**B. Gen Z** [M]
- Dynamika: 1–3 słowa, pop/scale-in, podświetlanie aktywnego słowa, emoji, więcej efektów.
- Emoji jako element graficzny — Meta raportuje wyraźny wzrost intencji zakupu w reklamach DR z emoji. [W]

**C. 50+ („boomerzy”)** [M]
- **Całe zdania na raz**, żeby zdążyli przeczytać.
- **Większy krój niż w pozostałych profilach i jednolite tło pod tekstem** (pasek lub zaokrąglony box), wysoki kontrast; bez szybkich animacji.
- Plansza na ekranie dłużej (zostawiaj czas na przeczytanie całości).

**D. Rodzice / uniwersalny** [R: ad01, ad02]
- Biały bold sans z miękkim cieniem, 4–7 słów (całe frazy lektora), środek-dół.

### Zawsze
- **Korekta pisowni przed renderem** — w ad01 jest błąd transkrypcji w napisach („cześć” zamiast „więc”). Napisy porównuj z transkrypcją i poprawiaj polskie znaki.
- Kolorystyka akcentów z palety marki; baza tekstu biel lub kolor z profilu.
- **Pozycja w strefie bezpiecznej** (rozdz. 9) — nie zasłaniaj produktu ani twarzy.

---

## 7. Muzyka i SFX

- **Nastrój muzyki = emocja produktu.** Przykłady z bazy [R]:
  - prezenty/zabawki → radosny ukulele/akustyczny pop, średnia energia (ad01, ad02),
  - pamiątka po zwierzęciu / strata → nostalgiczna, smutna ballada, niska energia (ad05),
  - bielizna modelująca / pewność siebie → lekki, inspirujący pop (ad03),
  - dom/sprzątanie → pozytywny pop/elektronika, średnia energia (ad04).
- Z lektorem: muzyka cicho w tle (ok. 15–20% głośności lektora), bez wokalu. Bez lektora: muzyka jest głównym nośnikiem — może mieć wokal, jeśli licencja na to pozwala.
- **Mowa + muzyka razem** — Meta raportuje wyższą skuteczność niż samo jedno z nich. [W]
- **Źródło muzyki:** wybieraj wyłącznie z biblioteki wgranej do strony. Jej zawartość jest zweryfikowana przez właściciela pod kątem użycia w reklamach — nie sięgaj po utwory spoza niej.
- **SFX** (oszczędnie, by wzmocnić, a nie zagłuszyć): whoosh na przejściach, ding/shimmer na reveal/przed-po, pop przy pojawianiu się napisów (Gen Z), dźwięk „kasy” przy ofercie. Dla 50+ i produktów emocjonalnych — minimum SFX.

---

## 8. Marka, logo, oferta, CTA

- **Logo:** małe w rogu (poza strefami UI) albo na planszy końcowej. Obecność marki ≤ ~25% czasu reklamy, ale **pokazana więcej niż raz** (wcześnie + na końcu). [W]
- **Plansza końcowa:** logo + dowód społeczny (gwiazdki, „10 000+ zadowolonych klientek”) + produkty. [R: ad03]
- **Oferta:** konkretna liczba lepsza niż ogólnik — „kupujesz 2, trzeci gratis”, „-60 zł”, „nawet do 50%”. [R]
- **Pilność:** „zanim oferta wygaśnie”, „na święta znowu podrożeje”. [R]
- **CTA:** czasownik + konkret („Kliknij link poniżej”), na ekranie ≥ 3 s, wzmocniony lektorem; dobrze działa gest wskazania w dół. [R: ad01][W]
- **Brak CTA = słabość** (ad04, ad05 kończą bez CTA) — dodawaj zawsze, chyba że profil marki mówi inaczej.

---

## 9. Formaty i strefy bezpieczne

- **Montuj master w 9:16 (1080×1920).** Z niego powstają wersje:
  - **4:5 (1080×1350) — rekomendowany** dla feedu,
  - 1:1 — opcjonalnie (Meta odchodzi od kwadratu),
  - 16:9 — opcjonalnie, tylko na życzenie.
- **Strefa bezpieczna 9:16** (Reels/Stories, zunifikowana w 2026): trzymaj tekst, logo i CTA z dala od górnych ok. 14% i dolnych ok. 20–35% kadru oraz ok. 6% boków. [W — dane z przewodników zewnętrznych; zweryfikować z oficjalną specyfikacją Meta przed budową szablonów]
- Kluczowe elementy (produkt, tekst hooka) w środkowym kwadracie 1080×1080 — wtedy przetrwają przycięcie do 4:5 i 1:1.
- Przy zmianie formatu kadruj tak, żeby **produkt pozostał w kadrze** (śledzenie obiektu), a napisy przelicz od nowa pod nową strefę.

---

## 10. Ocena skryptu lektora (feedback)

Sprawdzaj i komentuj:
1. Czy pierwsze zdanie działa jako hook (ciekawość, wywołanie grupy, problem, WOW) i czy da się do niego dobrać mocny klip?
2. Czy jest **problem**, który widz rozpozna, i czy da się go **pokazać** w materiałach?
3. Czy jest **mechanizm** (dlaczego to działa, a inne nie)?
4. Czy korzyści są konkretne (liczby, czas, efekt), a nie ogólne?
5. Czy jest dowód społeczny, oferta, odwrócenie ryzyka, pilność i konkretne CTA?
6. Czy długość pasuje (lektor 25–45 s; im dłużej, tym mocniejsze musi być body)?
7. Czy głos pasuje do grupy docelowej (np. produkt tylko dla kobiet czytany męskim głosem bywa dystansujący — sygnał, nie zakaz). [R: ad03]
8. Czy w materiałach jest co pokazać przy każdym zdaniu? Jeśli nie — zaproponuj zmianę zdania albo wygenerowanie brakującego ujęcia (rozdz. 4a).

---

## 11. Kontrola jakości przed renderem

- [ ] Pierwsza klatka ostra, z tekstem, z produktem lub silną emocją.
- [ ] Hook = obraz + dźwięk + słowa zgrane.
- [ ] Efekt WOW / przed-po jak najwcześniej.
- [ ] Każde ujęcie ilustruje to, co mówi lektor w tej chwili.
- [ ] Produkt widoczny kilka razy.
- [ ] Napisy: styl z profilu grupy docelowej, kolor z marki, zero błędów, w strefie bezpiecznej, nie zasłaniają produktu.
- [ ] Muzyka pasuje do emocji produktu i ma licencję; SFX nie zagłuszają lektora.
- [ ] Logo obecne, ale nie dominuje.
- [ ] Oferta, pilność i CTA na końcu (CTA ≥ 3 s).
- [ ] Żadnych cudzych watermarków ani napisów w klipach.
- [ ] Każde ujęcie wygenerowane AI przeszło kontrolę z rozdz. 4a i jest wypisane w raporcie.
- [ ] Wersje formatów przeliczone pod własne strefy bezpieczne.
- [ ] Efekty montażowe z rozdz. 5a obecne tam, gdzie lektor o czymś mówi (przed/po, problem, przewaga, „bez X”).
- [ ] Zdjęcia produktu tylko w packshocie na końcu.
- [ ] Skan po renderze: brak ujęć < 0,2 s (migawek) i czarnych klatek.
- [ ] Ujęcia AI: żadnych lustrzanych napisów ani logo na produkcie.
- [ ] Kontroler dostał preferencje marki z feedbacku i nie zgłasza decyzji użytkownika jako usterek.

---

## 12. Metryki (na później, przy integracji z Meta API) [W]

- **Hook rate** = odtworzenia 3 s ÷ wyświetlenia. Poniżej ok. 20–25% → poprawiać hook; 30%+ dobrze.
- **Hold rate** = ThruPlay (lub 15 s) ÷ odtworzenia 3 s. Poniżej ok. 25–40% → poprawiać body.
- Mocny hook i słaby hold → problem jest w środku reklamy, nie w hooku.
- Benchmarki pochodzą z blogów branżowych — z czasem zastąpić je danymi z kont użytkowników.

---

## Źródła wiedzy

- Zasady właściciela (Marcel) — rozdz. 1, profile napisów A–C.
- 5 reklam z polskiego rynku (karty w `karty/`): Blokomiś ×2, Somavela, Przytulny Kąt, Wieczna Łapa.
- Transkrypcje: „How to Make Meta Video Ads (in 2026)” (struktura hook–body–CTA, obiekcje i odwrócenie ryzyka), analiza hooków (kontekst, otwarte pętle, kadr pierwszej klatki), „I made 10,000 Ads” (formaty: UGC, founder, mashup z archiwum + AI voiceover, montaż, statyki bez AI slopu).
- Research (październik 2026): badanie Meta × Toluna o Reels, przewodniki o strefach bezpiecznych 2026, Andromeda i różnorodność kreacji, benchmarki hook/hold rate, anatomia skutecznej reklamy wideo.
