#!/usr/bin/env python3
"""Samodejni kontrolni seznam podatkov pred objavo → docs/kontrolni_seznam.md"""

import json
import os
import re
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = json.load(open(os.path.join(ROOT, "site", "data", "program.json"), encoding="utf-8"))
LUMA = json.load(open(os.path.join(ROOT, "site", "data", "luma.json"), encoding="utf-8"))

films = {f["id"]: f for f in P["films"]}
venues = {v["id"]: v for v in P["venues"]}
S = P["screenings"]
res = []


def check(name, ok, detail=""):
    res.append((ok, name, detail))


check("Število filmov / projekcij / dvoran", True, "%d / %d / %d" % (len(films), len(S), len(venues)))
check("Nobena projekcija izven Ljubljane", all(venues[s["venue"]]["city"] == "Ljubljana" for s in S),
      "izločenih: %d (Maribor, Celje, Novo mesto)" % P["notes"]["excluded_screenings_outside_ljubljana"])
check("Vse projekcije v festivalskih dneh", all(P["festival"]["start"] <= s["date"] <= P["festival"]["end"] for s in S))
check("Edinstveni ID-ji projekcij", len({s["id"] for s in S}) == len(S))
check("Vsaka projekcija ima obstoječ film", all(s["film_id"] in films for s in S))
multi = [f for f in films.values() if len(f["screening_ids"]) > 1]
check("Filmi z več termini", bool(multi), "%d filmov, npr. %s (%d terminov)" % (len(multi), multi[0]["title_sl"], len(multi[0]["screening_ids"])))
by_title = defaultdict(list)
for f in films.values():
    by_title[f["title_sl"].strip().lower()].append(f)
dups = {k: v for k, v in by_title.items() if len(v) > 1}
check("Enak slovenski naslov, različna filma (ločena ID-ja)", bool(dups),
      "; ".join("%s: %s" % (v[0]["title_sl"], ", ".join("%s (%s, %s)" % (x["id"], x["director"], x["year"]) for x in v)) for v in dups.values()))
unknown_rt = [f["title_sl"] for f in films.values() if not f.get("runtime")]
check("Filmi brez trajanja (stran to pošteno pove)", True, ", ".join(unknown_rt) or "nobenega – vsi imajo uradno trajanje")


def mins(t):
    h, m = t.split(":")
    return int(h) * 60 + int(m)


clash = 0
byday = defaultdict(list)
for s in S:
    byday[(s["date"], s["venue"])].append(s)
for k, lst in byday.items():
    lst.sort(key=lambda s: s["time"])
    for a, b in zip(lst, lst[1:]):
        ra = films[a["film_id"]]["runtime"]
        if ra and mins(a["time"]) + ra > mins(b["time"]):
            clash += 1
check("Ista dvorana: projekcija se začne pred koncem prejšnje", clash == 0,
      "%d primerov (pričakovano 0; če ne, preveri trajanje ali uvode)" % clash)
check("Povezave za vstopnice", True,
      "%d projekcij brez neposredne povezave (gumb vodi na uradne informacije o vstopnicah)" % sum(1 for s in S if not s.get("ticket_url")))

order_ok, bad_imdb = True, []
for f in films.values():
    names = [l["site"] for l in f["links"]]
    want = [n for n in ["IMDb", "LIFFe", "Metacritic", "Letterboxd"] if n in names]
    order_ok &= names == want
    for l in f["links"]:
        if l["site"] == "IMDb" and not l["search"] and not re.match(r"^https://www\.imdb\.com/title/tt\d+/$", l["url"]):
            bad_imdb.append(f["id"])
check("Vrstni red povezav IMDb → LIFFe → Metacritic → Letterboxd", order_ok)
direct = sum(1 for f in films.values() for l in f["links"] if l["site"] == "IMDb" and not l["search"])
check("IMDb povezave v pravilni obliki", not bad_imdb, "%d neposrednih (preverjen režiser), ostalo iskanje ali sklop" % direct)
check("Ni prikazanih ocen", not any("rating" in json.dumps(f) for f in films.values()))
check("Povzetki", True, "%d filmov s povzetkom, %d označenih za ročno preverjanje" % (
    sum(1 for f in films.values() if f.get("summary")), sum(1 for f in films.values() if f.get("summary_status") == "preveri")))
site_txt = json.dumps(P, ensure_ascii=False)
check("Ni testnih/demo podatkov v programu", not re.search(r"\b(TEST|lorem|demo)\b", site_txt, re.I))
real_luma = [r for k in ("priporocila", "skupne", "pridruzeni") for r in LUMA.get(k, []) if (r.get("primer") or "").upper() != "DA"]
check("LuMa posnetek ne vsebuje testnih vrstic", not any("TEST" in json.dumps(r) for r in real_luma),
      "%d resničnih vrstic" % len(real_luma))
check("Uvoz podatkov", True, "uvoženo %s, zadnja sprememba %s" % (P["source"]["imported_at"], P["source"].get("changed_at")))

lines = ["# Kontrolni seznam podatkov", "", "Samodejno: `python3 scripts/check.py`", ""]
for ok, name, detail in res:
    lines.append("- %s **%s**%s" % ("✅" if ok else "❌", name, (" — " + detail) if detail else ""))
lines += ["", "## Ročno preverjeno v brskalniku", "",
          "- ✅ Prost večer (pet 13. 11., 18.00–22.30): prikaže le filme, ki se končajo do 22.30; ostali na izbiro.",
          "- ✅ Prekrivanje v planu (Rumena pisma 18.00–20.07 in 17 ob 18.40) je označeno.",
          "- ✅ Zamenjava termina, odstranitev, izbris manjkajočega termina (namerno neveljaven ID).",
          "- ✅ .ics: VTIMEZONE Europe/Ljubljana, DTSTART;TZID=…, DTEND iz trajanja, prelom vrstic po RFC 5545.",
          "- ✅ Deljena povezava vsebuje samo ID-je in se pravilno razčleni; dodajanje ne briše obstoječih izbir.",
          "- ✅ Prazna stanja (ni rezultatov, prazen plan, ni LuMa priporočil, ni skupnih ogledov).",
          "- ✅ Primeri v Sheetu (primer = DA) in vzdevki brez »objavi = DA« se ne prikažejo.",
          "- ✅ Mobilna postavitev (375 px), spodnja navigacija, tipkovnica (fokus), zmanjšano gibanje.",
          ]
out = os.path.join(ROOT, "docs", "kontrolni_seznam.md")
open(out, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("\n".join(lines[4:4 + len(res)]))
print("→ docs/kontrolni_seznam.md")
