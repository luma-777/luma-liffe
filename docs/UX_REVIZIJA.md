# UX revizija – LuMa × LIFFe 2026

Pregled: 25. 10. 2026, lokalna različica strani (enaka kot liffe.lukamurn.com, commit 1043c7a).
Pregledano v brskalniku na 1280 × 860 in 375 × 812 (telefon), skupaj s kodo (`site/app.js`, `site/styles.css`).
Merila: Nielsenovih 10 hevristik, WCAG 2.2 AA in načela iz naloge (jasnost, prepoznavanje namesto spominjanja,
postopno razkrivanje, nizka kognitivna obremenitev, doslednost).

Resnost: 0 = ni težava, 1 = kozmetično, 2 = manjše, 3 = večje, 4 = katastrofa.
Zahtevnost: S = do ure, M = nekaj ur, L = dan ali več.

## Preverjene težave

### 1. Uvodni naslov ne pove, kaj je stran
- **Kje:** prva stran, hero (»LIFFe. Tvoj prvi. Ali pa tudi ne.«).
- **Zakaj je problem:** naslov je duhovit, pomen strani pa je le v drobnem eyebrowu. Nov obiskovalec v prvih sekundah ne izve, da gre za vodič, ki mu pomaga izbrati film.
- **Načelo:** Clarity over cleverness; Nielsen 2 (ujemanje z resničnim svetom).
- **Resnost:** 3
- **Rešitev:** naslov »Manj brskanja, več kina.«, eyebrow »LuMa × LIFFe 2026 · Neuradni filmski vodič«, topel opis in jasna CTA »Odkrij filme« / »Poglej ziherce«.
- **Učinek:** namen in prvi korak sta jasna takoj.
- **Zahtevnost:** S · **Status:** izvedeno

### 2. Hero na telefonu zasede cel prvi zaslon
- **Kje:** prva stran, 375 × 812: hero je visok 670 px, prvi gumb se konča pri 706 px, tik nad spodnjo navigacijo.
- **Zakaj je problem:** pod uvodom ni vidno nič (ne koraki ne filmi), zato stran deluje kot ovira pred uporabo.
- **Načelo:** Mobile-first; nizka kognitivna obremenitev.
- **Resnost:** 2
- **Rešitev:** krajši naslov, en odstavek opisa, datum kot ena vrstica namesto velike vstopnice, manjši razmiki.
- **Učinek:** na telefonu sta CTA in začetek korakov vidna brez pomikanja.
- **Zahtevnost:** S · **Status:** izvedeno

### 3. Prva stran ima preveč enakovrednih blokov
- **Kje:** prva stran: hero, trije vstopi, statistika, Ziherce, Z LuMa v kino, »Prvič na LIFFu«.
- **Zakaj je problem:** trije barvni vstopi delno podvajajo navigacijo in CTA; ni jasnega zaporedja »kaj najprej«.
- **Načelo:** Progressive disclosure; doslednost.
- **Resnost:** 2
- **Rešitev:** vstope in statistiko nadomestijo trije koraki Odkrij → Shrani → Načrtuj; vsak ima eno dejanje (vsi filmi, Moj LIFFe, »Imam prost večer«).
- **Učinek:** manj odločanja, razumljiv potek uporabe.
- **Zahtevnost:** S · **Status:** izvedeno

### 4. Termini na kartici so videti kot gumbi, a klik nanje ne naredi nič
- **Kje:** vse filmske kartice (Odkrij filme, Ziherce, prva stran).
- **Zakaj je problem:** čipi s termini so nad povezavo kartice, zato klik nanje ne odpre ničesar (preverjeno v brskalniku). Uporabnik, ki želi »ta termin«, ostane brez odziva.
- **Načelo:** Nielsen 1 (vidnost stanja), 4 (doslednost); affordance.
- **Resnost:** 3
- **Rešitev:** klik na termin odpre predogled filma in označi ter pokaže prav ta termin z gumbi »V moj koledar«, »Vstopnice« in koledar.
- **Učinek:** od kartice do izbranega termina je en klik, brez iskanja.
- **Zahtevnost:** S · **Status:** izvedeno

### 5. Na telefonu filtri zasedejo cel zaslon, rezultat ni viden
- **Kje:** Odkrij filme, 375 px: filtri so visoki 383 px, število rezultatov je pri 693 px, prvi film pri 833 px.
- **Zakaj je problem:** po dotiku dneva ali sekcije se spremeni seznam pod robom zaslona; uporabnik ne vidi, ali je filter kaj spremenil.
- **Načelo:** Nielsen 1 (vidnost stanja sistema).
- **Resnost:** 3
- **Rešitev:** na dnu polja s filtri je sproti posodobljen gumb »Pokaži 23 filmov ↓«, ki skoči na rezultate. Aktivni filtri in »Počisti vse« ostanejo.
- **Učinek:** takojšna povratna informacija, manj pomikanja.
- **Zahtevnost:** S · **Status:** izvedeno

### 6. »Odkrij filme« v navigaciji izgubi izbrane filtre
- **Kje:** glavna navigacija.
- **Zakaj je problem:** po obisku Moj LIFFe ali Ziherc povezava vedno odpre prazne filtre in vrh seznama; raziskovanje se začne od začetka.
- **Načelo:** Recognition over recall; nadzor uporabnika.
- **Resnost:** 2
- **Rešitev:** navigacija si zapomni zadnje filtre (v tem zavihku) in položaj na seznamu.
- **Učinek:** vrnitev tja, kjer si ostal.
- **Zahtevnost:** S · **Status:** izvedeno

### 7. Moj LIFFe ne pokaže, kaj je že izvoženo v koledar
- **Kje:** Moj LIFFe.
- **Zakaj je problem:** ni ločeno, kaj je »v planu« in kaj si že izvozil; ponoven izvoz vseh terminov lahko v koledarju podvoji dogodke. Google Koledar je na voljo le v predogledu filma, ne v planu.
- **Načelo:** Recognition over recall; preprečevanje napak (Nielsen 5).
- **Resnost:** 2
- **Rešitev:** pri vsakem terminu oznaka »Izvoženo v koledar« ali »Še ni izvoženo« (stran ne trdi, da je dogodek res v koledarju, ker tega ne more preveriti), gumb »Izvozi nove«, ki izvozi le še neizvožene, in gumba Google / .ics pri vsakem terminu.
- **Učinek:** jasna tri stanja: Zanima me → V planu → Izvoženo; manj podvojenih dogodkov.
- **Zahtevnost:** M · **Status:** izvedeno

### 8. »Počisti vse« je enakovreden gumb ob »Deli«
- **Kje:** Moj LIFFe, orodna vrstica.
- **Zakaj je problem:** nepovratno dejanje je enako izrazito kot vsakdanje (potrditev sicer obstaja).
- **Načelo:** Nielsen 5 (preprečevanje napak).
- **Resnost:** 1
- **Rešitev:** »Počisti vse« kot manj izrazita povezava na dnu strani.
- **Zahtevnost:** S · **Status:** izvedeno

### 9. Slovnična napaka v praznem stanju
- **Kje:** Moj LIFFe brez izbir: »Tvoj plan je še prazen platno«.
- **Resnost:** 1 · **Rešitev:** »prazno platno«. · **Zahtevnost:** S · **Status:** izvedeno

### 10. Logika Ziherc je razložena šele pod seznamom
- **Kje:** Ziherce.
- **Zakaj je problem:** pojasnilo, da je vrstni red po ocenah publike in kritikov, a brez številk, je v drobnem tisku na dnu. Uporabnik ne ve, zakaj so filmi tu in kaj pomeni oznaka »LuMa priporoča«.
- **Načelo:** Nielsen 10 (pomoč), jasna ločitev uredniškega izbora od podatkov.
- **Resnost:** 2
- **Rešitev:** kratko pojasnilo nad seznamom za vsak način (ocene / festivali / klasike); oznaka »LuMa priporoča« je opisana kot najin osebni izbor.
- **Zahtevnost:** S · **Status:** izvedeno

### 11. Prazno stanje »Z LuMa v kino« vodi na »LuMa priporoča«
- **Kje:** Z LuMa v kino, ko ni skupnih ogledov.
- **Zakaj je problem:** zavihek s tem imenom ne obstaja več; povezava vodi na Ziherce.
- **Resnost:** 1 · **Rešitev:** gumb »Ziherce«. · **Zahtevnost:** S · **Status:** izvedeno

### 12. Premajhen kontrast na turkizni podlagi
- **Kje:** glava »Z LuMa v kino« in polje »Še ni dovolj kina?« (belo in svetlo besedilo na #3b9a97: 3,1–3,4 : 1); siva pomožna barva na temnejšem papirju (4,4 : 1).
- **Načelo:** WCAG 2.2, 1.4.3 (najmanj 4,5 : 1 za navadno besedilo).
- **Resnost:** 2
- **Rešitev:** temno besedilo na turkizni (5,1 : 1), barva podlage ostane; pomožna siva malenkost temnejša (5,1 : 1).
- **Zahtevnost:** S · **Status:** izvedeno

### 13. Metapodatki za deljenje in iskalnike
- **Kje:** `index.html`.
- **Zakaj je problem:** manjkajo `canonical`, `og:url`, `og:type`, `og:locale`; opis ne nosi novega sporočila. Strani filmov so v hash usmerjanju (`#/film/…`), zato jih iskalniki ne indeksirajo posamično.
- **Resnost:** 1
- **Rešitev:** dopolnjeni metapodatki (izvedeno). Statične strani filmov in slika za deljenje: predlog za naslednjo iteracijo.
- **Zahtevnost:** S / M

### 14. Med nalaganjem se pokaže lažno prazno stanje
- **Kje:** Ziherce, Z LuMa v kino, prva stran (najdeno med preizkusom).
- **Zakaj je problem:** dokler Google Sheet ne odgovori, stran za trenutek pokaže »Ziherce še nastajajo« ali »Skupni ogledi še niso razpisani«, čeprav podatki obstajajo.
- **Načelo:** Nielsen 1 (vidnost stanja); zaupanje.
- **Resnost:** 2
- **Rešitev:** najprej se prikaže posnetek s strežnika strani (takoj), nato sveži podatki iz Sheeta; do takrat »Nalagam najin izbor …«.
- **Zahtevnost:** S · **Status:** izvedeno

### 15. Termin na kartici se po dodajanju v plan ne obarva
- **Kje:** kartice v seznamu, ko termin dodaš v plan iz predogleda (najdeno med preizkusom).
- **Zakaj je problem:** isto stanje (»v planu«) je v predogledu vidno, na kartici pa ne – nedoslednost.
- **Resnost:** 2 · **Rešitev:** termini na karticah se osvežijo skupaj z gumbi. · **Zahtevnost:** S · **Status:** izvedeno

### 16. Majhne tarče za dotik
- **Kje:** »Kaj pomeni katera?« in »Termini (3)« v Moj LIFFe (pod 24 px).
- **Načelo:** WCAG 2.2, 2.5.8 (najmanj 24 × 24 px).
- **Resnost:** 1 · **Rešitev:** večji odmik. · **Zahtevnost:** S · **Status:** izvedeno

### 17. Žanra in razpoloženja v podatkih ni
- **Kje:** filtri.
- **Zakaj je problem:** naloga predvideva iskanje po žanru; uradni podatki LIFFe ga ne vsebujejo, zato filtra ni mogoče zgraditi brez izmišljanja.
- **Resnost:** 2 (manjkajoča možnost, ne napaka)
- **Rešitev:** ročne oznake v Sheetu (glej predlog »Odkrivanje po razpoloženju«). Do takrat sekcije z opisi in iskanje.
- **Zahtevnost:** M · **Status:** predlog

### 18. Moj LIFFe je mešal shranjene filme in koledar
- **Kje:** Moj LIFFe (drugi krog, 25. 10. 2026).
- **Zakaj je problem:** na isti strani sta bila koledar terminov in seznam filmov s srčkom; stanji »zanima me« in »grem« sta se mešali.
- **Rešitev:** nov zavihek **Zanima me** (♡) za filme s srčkom, **Moj LIFFe** je le koledar. Navigacija zdaj sledi korakom Odkrij → Shrani → Načrtuj. Zanima me loči »Še brez termina« in »Že v Mojem LIFFu«; obe strani se povezujeta. Brisanje je ločeno (»Počisti koledar« / »Počisti seznam«). Pet zavihkov se v glavo zvrsti od 960 px, ožje je navigacija spodaj.
- **Zahtevnost:** M · **Status:** izvedeno

### 19. Povezava na Instagram ni delovala
- **Kje:** povabilo »Še ni dovolj kina?« v nogi.
- **Zakaj:** profil `lumakinoklub` ne obstaja (Instagram: »Profile isn't available«). Pravi profil je `@lumafilmklub`.
- **Rešitev:** profil je v `site/config.js` (`club.instagram`); povabilo je zdaj ena diskretna vrstica.
- **Status:** izvedeno

### 20. Ni bilo videti prostih dni in pavz med filmi
- **Rešitev:** Moj LIFFe ima pogled **Časovnica**: vsi festivalski dnevi so stolpci od leve proti desni, čas navpično; prosti dnevi so označeni, med filmoma je napisana pavza (rdeče, če je manj kot 20 min ali 30 min ob menjavi dvorane). Po želji se pokažejo še termini filmov iz »Zanima me« (črtkano), da najdeš, kaj zapolni luknjo. Status: izvedeno.

### 21. Ni bilo mogoče označiti kupljene vstopnice
- **Rešitev:** pri terminu v koledarju gumb »Imam vstopnico?« (lastna oznaka; stran nakupa ne preveri). Z oznako se skrije gumb za nakup, termin dobi značko, na časovnici je obrobljen. Opozorilo, če odstraniš ali zamenjaš termin z vstopnico. Status: izvedeno.

### 22. Glave zavihkov niso bile enotne
- **Rešitev:** vsi zavihki imajo enako barvno glavo v LuMa slogu (nadvrstica, naslov, uvod, motiv): Odkrij filme gorčična, Ziherce rožnata, Zanima me lososova, Moj LIFFe sivkasta, Z LuMa v kino turkizna; Deljen LIFFe in O strani enako. Status: izvedeno.

## Kar deluje dobro (namenoma ohranjeno)

- **Stanje v naslovu (URL):** filtri, iskanje, razvrščanje in pogled so v povezavi; deliti jih je mogoče, osvežitev jih ohrani.
- **Predogled filma:** zapre se z X, Escape, klikom na ozadje ali gumbom Nazaj; fokus gre v okno in se vrne na kartico; položaj seznama ostane. Vsak film ima tudi svojo povezavo `#/film/ID`.
- **»Imam prost čas«:** izračuna konec projekcije iz uradnega trajanja in skrije filme, ki se izidejo prepozno.
- **Moj LIFFe:** prekrivanja, zamenjava termina, izvoz .ics v Europe/Ljubljana, deljenje plana s povezavo brez osebnih podatkov, opozorilo na odstranjene projekcije.
- **Ločitev »Zanima me« (srček) in »V moj koledar« (termin).**
- **Iskanje** po slovenskem, angleškem, izvirnem naslovu in režiserju, tudi brez šumnikov.
- **Kartice:** slika, naslov, režija, država, leto, trajanje; opis za gumbom »Opis«; srček 44 × 44 px.
- **Prazna stanja z dejanji, stanje nalaganja in sporočilo ob napaki.**
- **Slike:** lazy loading, `srcset`, ~26 KB na kartico; program 152 KB.
- **Dostopnost:** povezava »Na vsebino«, vidni fokus, ikone z `aria-hidden`, gumbi z ikono imajo `aria-label`, spoštovanje `prefers-reduced-motion`.

## Hipoteze (preveriti z uporabniki)

1. Ali novi obiskovalci razumejo razliko med srčkom (»Zanima me«) in »V moj koledar«? Test: 5 oseb, naloga »shrani film, ki te zanima, in nato izberi termin«.
2. Ali je ime »Ziherce« razumljivo tistim, ki besede ne poznajo? Podnaslov pomaga; preveriti s 3–5 ljudmi izven kluba.
3. Ali je »Imam prost čas« dovolj viden kot zavihek v Odkrij filme ali ga ljudje najdejo le s prve strani?
4. Ali bi odkrivanje po razpoloženju res skrajšalo izbiro (glej spodaj)?

## Ziherce in ocene

- Ocene IMDb na strani niso prikazane in jih ne razvrščamo vidno: IMDb dovoljuje le osebno, nekomercialno rabo podatkov, prenos v Google Sheets tega ne spremeni. Letterboxd in Metacritic prepovedujeta samodejno zbiranje.
- Zakonita rešitev je že v uporabi: način »Ocene« je razvrščen po vajinem zasebnem predlogu (IMDb, prilagojen za majhno število glasov, in Metascore), na strani so le izbor, vrstni red in povezave na prave ocene.
- Ločen način »LuMa priporočila« ni dodan: odločila sta se, da ga ne bo, oznaka »LuMa priporoča« pa ostane na karticah.
- Če bi želela pokazati številke: TMDB (dovoljeno z navedbo vira) ali lastne LuMa ocene.

## Predlog za naslednjo iteracijo: odkrivanje po razpoloženju

- **Podatki:** uradni program nima žanrov ali razpoloženj. Avtomatska razvrstitev iz opisov bi bila ugibanje, zato predlagam ročno kuracijo.
- **Kako:** v uredniškem Sheetu nov zavihek `luma_razpolozenja` (`film_id`, `razpolozenje`, `aktivno`). Štiri razpoloženja, npr. »Da se malo nasmejim«, »Nekaj, kar mi ostane v glavi«, »Za petek zvečer«, »Nekaj čisto drugega«. Vsak film dobi največ dve oznaki, ki jih določita po uradnem opisu ali ogledu.
- **Kje v vmesniku:** ena vrstica čipov »Kaj ti danes paše?« nad seznamom v Odkrij filme (kot dodaten filter) in kratko na prvi strani. »Kar preseneti me« izbere naključen film med Zihercami s prvim prostim terminom.
- **Varovalke:** razpoloženje se pokaže le, če ima vsaj 5 filmov; nikjer ne piše, da je to ocena filma.
- **Zahtevnost:** M (Sheet + filter v obstoječem sistemu, brez novih knjižnic).

## Drugi predlogi

- Statične strani filmov (`/film/3961/`) z lastnim naslovom in opisom, ki jih ustvari `build.py`: boljše deljenje na družbenih omrežjih in iskalniki. M.
- Slika za deljenje (`og:image`) v LuMa slogu. S, potrebuje oblikovanje.
- Med festivalom hitri filter »Danes« in »Še danes zvečer« na vrhu Odkrij filme. S.
- Avtomatski testi (Playwright) za ključne scenarije, ko bo na voljo Node. M.
