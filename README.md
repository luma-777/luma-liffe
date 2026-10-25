# LuMa × LIFFe 2026

Neuradni festivalski vodič LuMa film kluba za 37. LIFFe (Ljubljana, 11.–22. 11. 2026).
Statična stran brez strežnika in brez računov: vsi filmi in ljubljanske projekcije, filter »Imam prost čas«,
»Zanima me« in »Moj plan«, opozorila na prekrivanja, izvoz v koledar (.ics), deljenje plana s povezavo,
predogled filma v oknu, »Ziherce« (ocene publike in kritikov, festivalski nagrajenci, starejše klasike – s povezavami na odzive) in »Z LuMa v kino« s prijavami.

## Struktura

```
site/                 objavljena stran (HTML, CSS, JS – brez build koraka)
  config.js           EDINA datoteka z nastavitvami (Sheet, obrazec, slike)
  data/program.json   uradni program (sestavi scripts/build.py)
  data/luma.json      posnetek LuMa Sheeta (rezerva)
  img/s, img/l        fotografije filmov (640 px za kartice, 960 px za predogled)
scripts/
  import_liffe.py     uvoz z urnik.liffe.si (samo Ljubljana) + zaznavanje sprememb
  match_imdb.py       preverjene povezave IMDb/Letterboxd (uradni IMDb dataset, brez scrapinga)
  build.py            združi vse v site/data/program.json
  fetch_images.py     uradne fotografije LIFFe → site/img (samo macOS, lokalno)
  fetch_luma.py       posnetek LuMa Sheeta → site/data/luma.json
  check.py            kontrolni seznam → docs/kontrolni_seznam.md
  serve.py            lokalni predogled (http://127.0.0.1:8765)
  make_luma_sheet.py  predloga uredniškega Sheeta
data/
  liffe.json, links.json   vmesni podatki
  povzetki.json            kratki lastni povzetki (urejaš ročno; status osnutek/pregledano)
  povezave_rocno.json      ročni popravki IMDb/Metacritic/Letterboxd
  spremembe.md             kaj se je spremenilo ob zadnjem uvozu
```

## Posodobitev uradnih podatkov

```bash
python3 scripts/import_liffe.py && python3 scripts/match_imdb.py && python3 scripts/build.py && python3 scripts/check.py
```

Na GitHubu to samodejno teče vsak dan (glej `.github/workflows/objava.yml`). Izbire obiskovalcev ostanejo,
ker so vezane na stabilne ID-je projekcij iz LIFFe sistema vstopnic (npr. `t227379`). Če LIFFe projekcijo
odstrani, jo »Moj LIFFe« označi kot »ni več v uradnem urniku«. Novi filmi nimajo povzetka, dokler ga ne dodaš
v `data/povzetki.json` (stran deluje tudi brez njega).

Novi filmi dobijo fotografijo, ko na svojem Macu zaženeš `python3 scripts/fetch_images.py && python3 scripts/build.py`
in narediš Push. Do takrat imajo na kartici barvni nadomestek.

Podrobnosti o virih, licencah, ocenah in prijavah: [docs/OBJAVA_IN_UREJANJE.md](docs/OBJAVA_IN_UREJANJE.md).
