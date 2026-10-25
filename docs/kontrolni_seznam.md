# Kontrolni seznam podatkov

Samodejno: `python3 scripts/check.py`

- ✅ **Število filmov / projekcij / dvoran** — 102 / 254 / 7
- ✅ **Nobena projekcija izven Ljubljane** — izločenih: 38 (Maribor, Celje, Novo mesto)
- ✅ **Vse projekcije v festivalskih dneh**
- ✅ **Edinstveni ID-ji projekcij**
- ✅ **Vsaka projekcija ima obstoječ film**
- ✅ **Filmi z več termini** — 92 filmov, npr. 17 (4 terminov)
- ✅ **Enak slovenski naslov, različna filma (ločena ID-ja)** — Dnevnik sobarice: 3920 (Radu Jude, 2026), 3939 (Luis Bunuel, 1964)
- ✅ **Filmi brez trajanja (stran to pošteno pove)** — nobenega – vsi imajo uradno trajanje
- ✅ **Ista dvorana: projekcija se začne pred koncem prejšnje** — 0 primerov (pričakovano 0; če ne, preveri trajanje ali uvode)
- ✅ **Povezave za vstopnice** — 1 projekcij brez neposredne povezave (gumb vodi na uradne informacije o vstopnicah)
- ✅ **Vrstni red povezav IMDb → LIFFe → Metacritic → Letterboxd**
- ✅ **IMDb povezave v pravilni obliki** — 98 neposrednih (preverjen režiser), ostalo iskanje ali sklop
- ✅ **Ni prikazanih ocen tretjih virov**
- ✅ **Povzetki** — 101 filmov s povzetkom, 1 označenih za ročno preverjanje
- ✅ **Ni testnih/demo podatkov v programu**
- ✅ **LuMa posnetek ne vsebuje testnih vrstic** — 3 resničnih vrstic
- ✅ **Uvoz podatkov** — uvoženo 2026-10-25T04:52+00:00, zadnja sprememba 2026-10-23T04:52+00:00

## Ročno preverjeno v brskalniku

- ✅ Prost večer (pet 13. 11., 18.00–22.30): prikaže le filme, ki se končajo do 22.30; ostali na izbiro.
- ✅ Prekrivanje v planu (Rumena pisma 18.00–20.07 in 17 ob 18.40) je označeno.
- ✅ Zamenjava termina, odstranitev, izbris manjkajočega termina (namerno neveljaven ID).
- ✅ .ics: VTIMEZONE Europe/Ljubljana, DTSTART;TZID=…, DTEND iz trajanja, prelom vrstic po RFC 5545.
- ✅ Deljena povezava vsebuje samo ID-je in se pravilno razčleni; dodajanje ne briše obstoječih izbir.
- ✅ Prazna stanja (ni rezultatov, prazen plan, ni LuMa priporočil, ni skupnih ogledov).
- ✅ Primeri v Sheetu (primer = DA) in vzdevki brez »objavi = DA« se ne prikažejo.
- ✅ Mobilna postavitev (375 px), spodnja navigacija, tipkovnica (fokus), zmanjšano gibanje.
