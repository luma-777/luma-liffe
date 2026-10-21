#!/usr/bin/env python3
"""
Združi uvožene podatke v eno datoteko za spletno stran.

  data/liffe.json        (import_liffe.py)  uradni program, samo Ljubljana
  data/links.json        (match_imdb.py)    preverjene zunanje povezave
  data/povzetki.json     (ročno/Claude)     kratki lastni povzetki
  data/sekcije.json      (ročno/Claude)     kratki opisi sekcij
        ↓
  site/data/program.json

Celotni uradni opisi (data/opisi_uradni.json) NE gredo na stran.
"""

import json
import os
import urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load(name, default=None):
    p = os.path.join(ROOT, "data", name)
    if not os.path.exists(p):
        return default
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def main():
    liffe = load("liffe.json")
    links = load("links.json", {})
    povzetki = {k: v for k, v in load("povzetki.json", {}).items() if not k.startswith("_")}
    sekcije = {k: v for k, v in load("sekcije.json", {}).items() if not k.startswith("_")}

    films = []
    for f in liffe["films"]:
        f = {k: v for k, v in f.items() if k not in ("title_en_raw", "title_orig_raw")}
        L = links.get(f["id"], {})
        ext = []
        imdb = L.get("imdb_id")
        s = L.get("search", {})
        # Vrstni red je zahtevan: IMDb → LIFFe → Metacritic → Letterboxd
        ext.append({"site": "IMDb", "url": "https://www.imdb.com/title/%s/" % imdb if imdb else s.get("imdb"),
                    "search": not imdb} if (imdb or s.get("imdb")) else None)
        ext.append({"site": "LIFFe", "url": f["liffe_url"], "search": False})
        mc = L.get("metacritic_url")
        ext.append({"site": "Metacritic", "url": mc or s.get("metacritic"), "search": not mc} if (mc or s.get("metacritic")) else None)
        lb = L.get("letterboxd_url") or ("https://letterboxd.com/imdb/%s/" % imdb if imdb else None)
        ext.append({"site": "Letterboxd", "url": lb or s.get("letterboxd"), "search": not lb} if (lb or s.get("letterboxd")) else None)
        if L.get("kind") == "program":
            # Sklop kratkih filmov: zunanje baze nimajo ene strani, zato samo LIFFe.
            ext = [e for e in ext if e and e["site"] == "LIFFe"]
            f["program"] = True
        f["links"] = [e for e in ext if e]
        p = povzetki.get(f["id"])
        if p and p.get("povzetek"):
            f["summary"] = p["povzetek"]
            if p.get("zakaj"):
                f["why"] = p["zakaj"]
            f["summary_status"] = p.get("status", "osnutek")
        elif p and p.get("status") == "preveri":
            f["summary_status"] = "preveri"
        films.append(f)

    for v in liffe["venues"]:
        q = "%s %s Ljubljana" % (v.get("place", ""), v["name"])
        v["map_url"] = "https://www.google.com/maps/search/?api=1&query=" + urllib.parse.quote(q.strip())

    out = {
        "festival": liffe["festival"],
        "source": liffe["source"],
        "venues": liffe["venues"],
        "sections": liffe["sections"],
        "section_info": {s: sekcije[s]["opis"] for s in liffe["sections"] if s in sekcije},
        "films": films,
        "screenings": liffe["screenings"],
        "notes": {
            "excluded_screenings_outside_ljubljana": liffe["excluded"]["screenings_outside_ljubljana"],
            "excluded_films": liffe["excluded"]["films_without_ljubljana_screening"],
        },
    }
    dst = os.path.join(ROOT, "site", "data", "program.json")
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(dst, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
    print("site/data/program.json: %d filmov, %d projekcij, %d KB"
          % (len(films), len(out["screenings"]), os.path.getsize(dst) // 1024))


if __name__ == "__main__":
    main()
