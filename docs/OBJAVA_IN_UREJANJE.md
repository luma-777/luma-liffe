# Objava in urejanje – kratka navodila

## 1. Javna objava (brezplačno, GitHub Pages)

Potrebuješ brezplačen račun na github.com. Gesel ne pošiljaj nikomur, tudi ne Claudu.

1. Na github.com → **New repository** → ime npr. `luma-liffe` → *Public* → **Create**.
2. Naloži vsebino mape `luma-liffe` (brez `scripts/.cache` in `data/opisi_uradni.json`):
   najlažje z **GitHub Desktop** (File → Add local repository → Publish), ali »uploading an existing file« v brskalniku.
3. V repozitoriju: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. **Actions → Objava → Run workflow**. Po ~2 minutah je stran na `https://<uporabnik>.github.io/luma-liffe/`.
5. Od tu naprej se stran sama posodobi: vsako uro LuMa Sheet, vsak dan uradni LIFFe program.

Alternativa brez GitHuba: [Netlify Drop](https://app.netlify.com/drop) – povlečeš mapo `site`. Deluje takoj, a se ne posodablja samo.

## 2. LuMa Sheet

Sheet **LuMa × LIFFe 2026 – uredniški podatki** je v mapi *Kino in film / Liffe 2026*.

Nastavitev (narejeno 21. 10. 2026):
- Sheet je **zaseben** (Deli → Omejeno). Javni so samo podatki zavihkov, objavljenih z
  **Datoteka → Deli → Objavi v spletu** (CSV). Kdor ima objavljeno povezavo, lahko te zavihke prebere,
  zato vanje ne piši zasebnih podatkov.
- Povezave CSV so v `site/config.js` pod `luma.csv`. Če kdaj ustaviš objavo, stran uporabi zadnji urni posnetek
  (`site/data/luma.json`).
- Objavljen je tudi zavihek `navodila`; ni občutljiv, a ga lahko pod »Objavljena vsebina in nastavitve« odkljukaš.

Urejanje (brez kode):
- **ID-ji**: odpri stran z `?urednik` na koncu, npr. `…/#/film/3926?urednik`. Pri filmu se izpiše `film_id`, pri vsakem
  terminu `screening_id` z gumbom »kopiraj«. Uredniški način velja do zaprtja zavihka.
- `luma_priporocila` (oznaka »LuMa priporoča« na karticah, komentar v predogledu filma): `film_id`, `aktivno` = DA,
  `komentar`, `vrstni_red`, `videla_sva` = DA (film sta že videla) ali NE (»Na radarju«).
- `luma_skupne_projekcije`: `screening_id`, `gremo` = DA, `povabilo`, neobvezno `zbirno_mesto` in `prijava_url`.
- `luma_potrjeni_pridruzeni`: samo pregledani vzdevki z izrecnim soglasjem, `objavi` = DA.
- Vrstice s `primer` = DA se nikoli ne prikažejo. Stolpci »za lažje branje« so le zate.

Spremembe so na strani vidne v nekaj minutah (Google objavljene podatke osveži približno na 5 minut), brez Pusha.
Če Google ne odgovori, stran uporabi urni posnetek.

## 3. »Pridem tudi jaz« (obrazec na strani, odgovori v Google obrazcu)

Obiskovalec pri skupnem ogledu vpiše ime ali vzdevek in klikne »Pošlji«. Stran prijavo pošlje v Google obrazec LuMa;
odgovori so zasebni in jih vidita samo lastnika obrazca. Dokler obrazec ni povezan, gumba na strani ni.

Enkratna nastavitev:
1. forms.google.com → prazen obrazec *Pridem tudi jaz – LuMa × LIFFe*. Štiri vprašanja, vsa obvezna:
   - **ID projekcije** (kratek odgovor)
   - **Ime ali vzdevek** (kratek odgovor)
   - **Javni prikaz imena** (izbira med več možnostmi): točno `Da` in `Ne`
   - **Pridem ali odjava** (izbira med več možnostmi): točno `Pridem` in `Odjava`
2. Nastavitve → Odgovori: e-naslovov **ne** zbiraj, »Omeji na 1 odgovor« pusti izklopljeno (sicer obrazec zahteva prijavo).
3. ⋮ → **Pridobi predizpolnjeno povezavo** → izpolni vsa štiri polja (npr. `test`, `test`, `Da`, `Pridem`) →
   **Pridobi povezavo** → **Kopiraj povezavo**. Iz nje se v `site/config.js` vpišeta `rsvp.formUrl` (del do `viewform`)
   in štiri številke `entry.…` (`screening`, `name`, `publish`, `action`).
4. Odgovorov **ne** povezuj z uredniškim Sheetom (ta je delno objavljen). Če jih želiš v tabeli, naj bo to ločen, zaseben Sheet.

Moderacija: v odgovorih preglej imena; tista z »Da« (in primerna) prepiši v `luma_potrjeni_pridruzeni` z `objavi = DA`.
Pri »Odjava« vrstico izbriši. Stran ne more preveriti, ali je Google prijavo sprejel, zato po spremembi obrazca naredi
eno testno prijavo in jo nato izbriši.

## 3a. Ziherce (`luma_ziherce`)

Stolpci: `film_id`, `naslov` (za lažje branje), `razlog`, `nagrada`, `vrstni_red`, `aktivno` = DA, `primer`.
- `razlog` = `ocene` (ocene publike in kritikov), `festivali` (odmevni filmi velikih festivalov; v `nagrada` vpiši
  nagrado, npr. »Zlati lev, Benetke 2026«) ali `starejsi` (starejše klasike). Film je lahko v več vrsticah z različnim razlogom.
- Ocen (IMDb, Letterboxd, Metacritic) na strani ne objavljamo: njihovi pogoji tega ne dovolijo. Uporabita jih zase
  (zasebna tabela *LIFFe 2026 – vsi filmi, IMDb in Metascore*, zavihek »Predlog Ziherc«), na stran gre le vajin izbor.
- Uredniški Sheet je objavljen v celoti: **vsak nov zavihek je takoj javen**. Zasebnih podatkov vanj ne dodajaj.

## 4. Kaj je preverjeno in kakšne so omejitve

- **Program**: urnik.liffe.si nima API-ja; `robots.txt` ne prepoveduje dostopa. Uvoz je vljuden (ena zahteva naenkrat,
  premor, predpomnjenje) in teče enkrat dnevno. Uradnih opisov ne objavljamo – samo naše kratke povzetke in povezavo.
- **Ljubljana**: mesto vsake dvorane je preverjeno na liffe.si/prizorišča. Neznana dvorana se ne prikaže, dokler je ne
  dodaš v `VENUES` v `scripts/import_liffe.py` (uvoz te opozori).
- **IMDb/Letterboxd**: povezava je neposredna le, če se v uradnem IMDb datasetu ujemata režiser in leto. Letterboxd
  povezava gre prek `letterboxd.com/imdb/<tt-ID>/`. Metacritic je iskanje.
- **Ocene** IMDb, Letterboxd in Metacritic niso prikazane: IMDb dovoli le osebno rabo, Letterboxd in Metacritic
  prepovedujeta samodejno zbiranje. Vajina tabela z ocenami na Drive ostaja zasebni pripomoček za izbor Ziherc.
- **Fotografije filmov**: uradne slike LIFFe (iste kot v mapah *LIFFE 2026 thumbnaili* in *LIFFE 2026 slike velike* na Drive).
  Stran jih gosti sama (`site/img`, ~9 MB), ne nalaga jih s strežnika LIFFe. Na strani »O strani« in v nogi piše
  »fotografije: LIFFe«. Če bi LIFFe prosil, da jih umaknemo: v `site/config.js` nastavi `showPosters: false`.
- **Vstopnice**: gumb odpre uradno prodajo Cankarjevega doma za ta termin. Razprodanosti ne prikazujemo.
- **Napaka v uradnih podatkih**: opis filma *Ljudska romanca* (idF 3945) je na LIFFe enak opisu *Običajni osumljenci*;
  povzetka zato ni. Ko LIFFe popravi, dopolni `data/povzetki.json`.
