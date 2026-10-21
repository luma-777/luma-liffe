#!/usr/bin/env python3
"""
LuMa × LIFFe 2026 — preverjene povezave na IMDb (in prek IMDb ID na Letterboxd).

Brez scrapinga imdb.com ali letterboxd.com:
  * IMDb suggestion API (javni, brez ključa) predlaga kandidate tt… po naslovu
    in osebe nm… po imenu režiserja,
  * uradni IMDb dataset title.crew.tsv.gz (datasets.imdbws.com) pove, kdo je
    film režiral.

Film dobi neposredno povezavo SAMO, če se ujema režiser (nm ID iz IMDb je
med režiserji kandidata) in leto (±1, če ga LIFFe navaja). Vse drugo dobi
iskalno povezavo, ki je na strani jasno označena kot iskanje.

Letterboxd podpira preusmeritev https://letterboxd.com/imdb/tt…/ na pravi
film, zato za preverjen IMDb ID dobimo tudi pravo Letterboxd stran.
Metacritic nima javnega preslikovanja IMDb ID → stran, zato je vedno iskanje,
razen če v data/povezave_rocno.json ročno vpišemo preverjen URL.

Izhod: data/links.json (združi ga scripts/build.py)
"""

import gzip
import json
import os
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "scripts", ".cache")
LIFFE = os.path.join(ROOT, "data", "liffe.json")
MANUAL = os.path.join(ROOT, "data", "povezave_rocno.json")
OUT = os.path.join(ROOT, "data", "links.json")
CREW_URL = "https://datasets.imdbws.com/title.crew.tsv.gz"
CREW = os.path.join(CACHE, "title.crew.tsv.gz")
SUGG = os.path.join(CACHE, "imdb_suggest.json")

UA = "Mozilla/5.0 (compatible; LuMa-LIFFe-vodic/1.0)"

# Sklopi kratkih filmov nimajo ene IMDb strani.
PROGRAM_IDS_HINT = re.compile(r"(sklop|kratki filmi|VOD - filmi)", re.I)


def norm(s):
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.replace("ł", "l").replace("Ł", "L").replace("đ", "d").replace("Đ", "D")
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


_cache = None


def suggest(q):
    global _cache
    if _cache is None:
        _cache = json.load(open(SUGG)) if os.path.exists(SUGG) else {}
    key = norm(q)
    if not key:
        return []
    if key in _cache:
        return _cache[key]
    url = "https://v3.sg.media-imdb.com/suggestion/x/%s.json" % urllib.parse.quote(key)
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=20) as r:
            d = json.loads(r.read().decode("utf-8")).get("d", [])
    except Exception as e:  # noqa: BLE001
        print("  suggest napaka %s: %s" % (q, e), file=sys.stderr)
        d = []
    _cache[key] = d
    time.sleep(0.4)
    return d


def save_cache():
    if _cache is not None:
        os.makedirs(CACHE, exist_ok=True)
        json.dump(_cache, open(SUGG, "w"), ensure_ascii=False)


def ensure_crew():
    os.makedirs(CACHE, exist_ok=True)
    if os.path.exists(CREW) and time.time() - os.path.getmtime(CREW) < 7 * 86400:
        return
    print("prenašam %s …" % CREW_URL)
    urllib.request.urlretrieve(CREW_URL, CREW)


def load_crew(tts):
    out = {}
    with gzip.open(CREW, "rt", encoding="utf-8") as f:
        next(f)
        for line in f:
            tt, _, rest = line.partition("\t")
            if tt in tts:
                directors = rest.split("\t")[0]
                out[tt] = set() if directors == "\\N" else set(directors.split(","))
    return out


def same_person(a, b):
    """»Teodora Ana Mihai« ~ »Teodora Mihai«, »Kore-eda« ~ »Koreeda«,
    »Cris Tapia Marchiori« ~ »Cristian Tapia Marchiori«. Priimek mora biti enak."""
    a, b = norm(a), norm(b)
    if a.replace(" ", "") == b.replace(" ", ""):
        return True
    ta, tb = a.split(), b.split()
    if len(ta) < 2 or len(tb) < 2 or ta[-1] != tb[-1]:
        return False
    return ta[0].startswith(tb[0]) or tb[0].startswith(ta[0])


def director_ids(name):
    """IMDb nm ID-ji, katerih ime se (brez naglasov) ujema z imenom režiserja."""
    ids = set()
    for d in suggest(name):
        if d.get("id", "").startswith("nm") and same_person(d.get("l", ""), name):
            ids.add(d["id"])
    return ids


def title_candidates(film):
    seen, out = set(), []
    queries = []
    for t in (film.get("title_orig_raw"), film.get("title_en_raw"), film.get("title_sl")):
        if t:
            queries.append(t)
            if film.get("year"):
                queries.append("%s %s" % (t, film["year"]))
    for q in queries:
        for d in suggest(q):
            tt = d.get("id", "")
            if tt.startswith("tt") and tt not in seen and d.get("qid") in ("movie", "tvMovie", "short", "video", "tvSpecial", None):
                seen.add(tt)
                out.append(d)
    return out


def search_links(film):
    q_imdb = film.get("title_orig_raw") or film.get("title_en_raw") or film["title_sl"]
    q_en = film.get("title_en_raw") or q_imdb
    yr = " %s" % film["year"] if film.get("year") else ""
    return {
        "imdb": "https://www.imdb.com/find/?q=%s&s=tt" % urllib.parse.quote(q_imdb + yr),
        "metacritic": "https://www.metacritic.com/search/%s/?category=2" % urllib.parse.quote(q_en),
        "letterboxd": "https://letterboxd.com/search/films/%s/" % urllib.parse.quote(q_en),
    }


def main():
    data = json.load(open(LIFFE, encoding="utf-8"))
    manual = json.load(open(MANUAL, encoding="utf-8")) if os.path.exists(MANUAL) else {}
    manual = {k: v for k, v in manual.items() if not k.startswith("_")}
    ensure_crew()

    films = data["films"]
    # Že preverjenih filmov ne iščemo znova (manj zahtev ob dnevnem uvozu).
    prev = json.load(open(OUT, encoding="utf-8")) if os.path.exists(OUT) and "--vse" not in sys.argv else {}
    cands, dirs = {}, {}
    for f in films:
        if PROGRAM_IDS_HINT.search(f["title_sl"] or ""):
            continue
        if prev.get(f["id"], {}).get("imdb_id") and not prev[f["id"]].get("manual"):
            continue
        cands[f["id"]] = title_candidates(f)
        names = [n.strip() for n in re.split(r",| in | & ", f.get("director") or "") if n.strip()]
        dirs[f["id"]] = set().union(*[director_ids(n) for n in names]) if names else set()
    save_cache()

    all_tt = {d["id"] for c in cands.values() for d in c}
    crew = load_crew(all_tt)

    out, report = {}, []
    for f in films:
        fid = f["id"]
        entry = {"search": search_links(f)}
        if fid not in cands and prev.get(fid, {}).get("imdb_id") and not prev[fid].get("manual"):
            entry.update({k: prev[fid][k] for k in ("imdb_id", "imdb_match") if k in prev[fid]})
            out[fid] = entry
            report.append("OK (prej) %s %s → %s" % (fid, f["title_sl"], entry["imdb_id"]))
            continue
        if fid not in cands:
            entry["kind"] = "program"
            out[fid] = entry
            report.append("PROGRAM  %s %s" % (fid, f["title_sl"]))
            continue
        hits = []
        for d in cands[fid]:
            dset = crew.get(d["id"], set())
            if not (dset & dirs[fid]):
                continue
            # Leto ±1; pri restavriranih klasikah LIFFe včasih navaja leto
            # restavracije (npr. Il sorpasso »2026«), zato točno ujemanje
            # izvirnega naslova skupaj z režiserjem zadošča.
            y = d.get("y")
            exact_title = norm(d.get("l")) in {norm(f.get("title_orig_raw")), norm(f.get("title_en_raw"))}
            if f.get("year") and y and abs(int(y) - int(f["year"])) > 1 and not exact_title:
                continue
            hits.append(d)
        if len(hits) > 1 and (f.get("runtime") or 0) >= 45:
            hits = [h for h in hits if h.get("qid") != "short"] or hits
        if len(hits) > 1 and f.get("year"):
            hits = [h for h in hits if h.get("y") == f["year"]] or hits
        if len(hits) == 1:
            h = hits[0]
            entry["imdb_id"] = h["id"]
            entry["imdb_match"] = {"title": h.get("l"), "year": h.get("y"), "director_verified": True}
            report.append("OK       %s %-40s → %s %s (%s)" % (fid, f["title_sl"][:40], h["id"], h.get("l"), h.get("y")))
        elif len(hits) > 1:
            report.append("VEČ      %s %s → %s" % (fid, f["title_sl"], ", ".join(h["id"] for h in hits)))
        else:
            report.append("NI       %s %s (režiser nm: %s, kandidatov: %d)"
                          % (fid, f["title_sl"], ",".join(sorted(dirs[fid])) or "—", len(cands[fid])))
        m = manual.get(fid)
        if m:
            entry.update({k: v for k, v in m.items() if k in ("imdb_id", "metacritic_url", "letterboxd_url")})
            entry["manual"] = True
            report.append("  ročno: %s" % m)
        out[fid] = entry

    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1)
    with open(os.path.join(ROOT, "data", "imdb_ujemanje.txt"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(report) + "\n")
    ok = sum(1 for v in out.values() if v.get("imdb_id"))
    # (zagon z --vse ponovno preveri vse filme)
    print("preverjenih IMDb ID: %d / %d (sklopi: %d)" % (ok, len(films), sum(1 for v in out.values() if v.get("kind") == "program")))
    print("\n".join(r for r in report if not r.startswith("OK")))


if __name__ == "__main__":
    main()
