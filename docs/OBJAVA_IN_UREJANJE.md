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

Enkratna nastavitev:
1. V Sheetu **Deli → Splošni dostop → Kdor koli s povezavo → Ogledovalec**. (Sheet je zato javno berljiv – vanj ne
   piši zasebnih podatkov. Urejanje ostane samo tebi.)
2. V `site/config.js` vpiši `sheetId: "15VJlwoEo1KPfKAyiwHojf7GvGDcZEVlBYMMTJHgPOi8"`.

Urejanje (brez kode):
- **ID-ji**: odpri stran z `?urednik` na koncu, npr. `…/#/film/3926?urednik`. Pri filmu se izpiše `film_id`, pri vsakem
  terminu `screening_id` z gumbom »kopiraj«. Uredniški način velja do zaprtja zavihka.
- `luma_priporocila`: `film_id`, `aktivno` = DA, `komentar`, `vrstni_red`.
- `luma_skupne_projekcije`: `screening_id`, `gremo` = DA, `povabilo`, neobvezno `zbirno_mesto` in `prijava_url`.
- `luma_potrjeni_pridruzeni`: samo pregledani vzdevki z izrecnim soglasjem, `objavi` = DA.
- Vrstice s `primer` = DA se nikoli ne prikažejo. Stolpci »za lažje branje« so le zate.

Spremembe so vidne ob naslednjem nalaganju strani (stran bere Sheet neposredno); če Google ne odgovori,
stran uporabi urni posnetek.

## 3. »Pridem tudi jaz« (možnost C, brez strežnika)

1. forms.google.com → nov obrazec *Pridem tudi jaz – LuMa × LIFFe*. Vprašanja:
   - **ID projekcije** (kratek odgovor, obvezno)
   - **Vzdevek** (kratek odgovor, obvezno; opis: »ne uporabljaj polnega imena«)
   - **Ali sme LuMa vzdevek javno pokazati pri tej projekciji?** (Da / Ne, obvezno)
   - **Želim se odjaviti** (potrditveno polje, neobvezno)
2. Nastavitve: **ne** zbiraj e-naslovov. Odgovori ostanejo zasebni (če jih povežeš s Sheetom, naj bo to
   ločen, nedeljen Sheet – nikoli uredniški).
3. ⋮ → **Pridobi predizpolnjeno povezavo** → v »ID projekcije« vpiši `X` → **Kopiraj povezavo**. V povezavi je del
   `entry.123456789=X`. V `site/config.js` vpiši `formUrl` (del do `viewform`) in `screeningEntry: "entry.123456789"`.
   Gumb se nato pokaže pri vsakem skupnem ogledu in sam vpiše ID projekcije.
4. Moderacija: v odgovorih preglej vzdevke; tiste z »Da« (in primerne) prepiši v `luma_potrjeni_pridruzeni`.
   Odjava: izbriši vrstico.

Dokler obrazec ni nastavljen, stran pokaže le povabilo (možnost A) – nikoli gumba, ki ne bi ničesar zabeležil.

## 4. Kaj je preverjeno in kakšne so omejitve

- **Program**: urnik.liffe.si nima API-ja; `robots.txt` ne prepoveduje dostopa. Uvoz je vljuden (ena zahteva naenkrat,
  premor, predpomnjenje) in teče enkrat dnevno. Uradnih opisov ne objavljamo – samo naše kratke povzetke in povezavo.
- **Ljubljana**: mesto vsake dvorane je preverjeno na liffe.si/prizorišča. Neznana dvorana se ne prikaže, dokler je ne
  dodaš v `VENUES` v `scripts/import_liffe.py` (uvoz te opozori).
- **IMDb/Letterboxd**: povezava je neposredna le, če se v uradnem IMDb datasetu ujemata režiser in leto. Letterboxd
  povezava gre prek `letterboxd.com/imdb/<tt-ID>/`. Metacritic je iskanje.
- **Ocene** (IMDb, Metascore) niso prikazane: IMDb podatki so licencirani za osebno, nekomercialno rabo, Metacritic
  za ponovno objavo nima odprte licence. Tvoja tabela z ocenami na Drive ostaja zasebni pripomoček.
- **Plakati**: izklopljeni (`showPosters: false`), dokler LIFFe ne potrdi, da jih smemo uporabljati.
- **Vstopnice**: gumb odpre uradno prodajo Cankarjevega doma za ta termin. Razprodanosti ne prikazujemo.
- **Napaka v uradnih podatkih**: opis filma *Ljudska romanca* (idF 3945) je na LIFFe enak opisu *Običajni osumljenci*;
  povzetka zato ni. Ko LIFFe popravi, dopolni `data/povzetki.json`.
