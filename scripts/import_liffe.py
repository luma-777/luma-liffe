#!/usr/bin/env python3
"""
LuMa × LIFFe 2026 — uvoz uradnega programa.

Vir: uradni programski vmesnik nove strani urnika (oktober 2026)
     https://urnik.liffe.si/api/program        ves program: filmi, sekcije, dvorane, projekcije (z ID vstopnic)
     https://urnik.liffe.si/api/filmi/<idF>    podrobnosti filma: trajanje, jezik, podnapisi, uradni opis

robots.txt na urnik.liffe.si dovoljuje vse (Allow: /). Zajemamo vljudno: ena zahteva naenkrat,
premor med zahtevami, odgovori se shranijo v .cache, tako da ponovni zagon z --offline ne
obremenjuje strežnika. Če vmesnik vrne premalo filmov, uvoz NE prepiše obstoječih podatkov.

Izhod:
  data/liffe.json           javni podatki (brez celotnih uradnih opisov)
  data/opisi_uradni.json    uradni opisi, SAMO za pisanje lastnih povzetkov
                            (ni del objavljene strani, v .gitignore)
  data/spremembe.md         kaj se je spremenilo od prejšnjega uvoza

Uporaba:
  python3 scripts/import_liffe.py            # sveže z LIFFe
  python3 scripts/import_liffe.py --offline  # samo iz .cache
"""

import datetime as dt
import hashlib
import html
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "scripts", ".cache", "liffe")
OUT = os.path.join(ROOT, "data", "liffe.json")
OPISI = os.path.join(ROOT, "data", "opisi_uradni.json")
SPREMEMBE = os.path.join(ROOT, "data", "spremembe.md")

BASE = "https://urnik.liffe.si/"
UA = "Mozilla/5.0 (compatible; LuMa-LIFFe-vodic/1.0; nepridobitni festivalski vodic)"
DELAY = 1.2  # s med zahtevami

FESTIVAL = {"start": "2026-11-11", "end": "2026-11-22"}

# Mesto vsake dvorane je preverjeno na https://www.liffe.si/sl/vstopnice/prizorisca
# (razdelek »Ljubljana« proti »Maribor«, »Novo mesto«, »Celje«).
# Dvorana, ki je tu ni, se NE prikaže, dokler je ročno ne uvrstimo.
VENUES = {
    "Linhartova dvorana": {"id": "cd-linhartova", "name": "Linhartova dvorana", "place": "Cankarjev dom", "city": "Ljubljana"},
    "Kosovelova dvorana": {"id": "cd-kosovelova", "name": "Kosovelova dvorana", "place": "Cankarjev dom", "city": "Ljubljana"},
    "Kinodvor": {"id": "kinodvor", "name": "Kinodvor", "place": "", "city": "Ljubljana"},
    "Slovenska kinoteka": {"id": "kinoteka", "name": "Slovenska kinoteka", "place": "", "city": "Ljubljana"},
    "Kino Bežigrad": {"id": "kino-bezigrad", "name": "Kino Bežigrad", "place": "", "city": "Ljubljana"},
    "Kino Šiška": {"id": "kino-siska", "name": "Kino Šiška", "place": "", "city": "Ljubljana"},
    "Dvorana AGRFT": {"id": "agrft", "name": "Dvorana AGRFT", "place": "UL AGRFT", "city": "Ljubljana"},
    "Maribox": {"id": "maribox", "name": "Maribox", "place": "", "city": "Maribor"},
    "KCJT Novo mesto": {"id": "kcjt", "name": "KCJT Novo mesto", "place": "", "city": "Novo mesto"},
    "Mali Union Celje": {"id": "union-celje", "name": "Mali Union Celje", "place": "", "city": "Celje"},
    "KD Cerknica": {"id": "kd-cerknica", "name": "KD Cerknica", "place": "", "city": "Cerknica"},
}
MIN_FILMS = 50  # varovalka: manj filmov pomeni, da je vmesnik spremenjen ali nedosegljiv

# Uradna imena sekcij, kot jih uporablja LIFFe (slovensko, lepše zapisano).
SECTION_NAMES = {
    "PERSPEKTIVE": "Perspektive",
    "PREDPREMIERE": "Predpremiere",
    "KRALJI IN KRALJICE": "Kralji in kraljice",
    "PANORAMA": "Panorama",
    "EKSTRAVAGANCA": "Ekstravaganca",
    "FOKUS: AVSTRIJA": "Fokus: Avstrija",
    "JADRANSKA MREŽA": "Jadranska mreža",
    "KINOBALON": "Kinobalon",
    "KINO-INTEGRAL": "Kino-integral",
    "RETRO:COMMEDIA ALL'ITALIANA": "Retro: Commedia all'italiana",
    "POSVEČENO: PAWEL PAWLIKOWSKI": "Posvečeno: Paweł Pawlikowski",
    "POSVEČENO: IVICA MATIĆ": "Posvečeno: Ivica Matić",
    "EVROPA NA KRATKO": "Evropa na kratko",
    "VOD: FILMI URŠE MENART": "VOD: filmi Urše Menart",
}


def slug(s):
    import unicodedata
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def text(s):
    if s is None:
        return ""
    s = re.sub(r"(?i)<br\s*/?>", "\n", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s).replace("\xa0", " ")
    s = "\n".join(re.sub(r"[ \t]+", " ", line).strip() for line in s.split("\n"))
    return s.strip()


def fetch(path, offline):
    os.makedirs(CACHE, exist_ok=True)
    fn = os.path.join(CACHE, re.sub(r"[^\w.=-]+", "_", path) + (".json" if path.startswith("api/") else ".html"))
    if offline:
        if not os.path.exists(fn):
            raise SystemExit("ni v .cache: %s (zaženi brez --offline)" % path)
        return open(fn, encoding="utf-8").read()
    req = urllib.request.Request(BASE + path, headers={"User-Agent": UA, "Accept-Language": "sl"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                body = r.read().decode("utf-8", "replace")
            break
        except Exception as e:  # noqa: BLE001
            if attempt == 2:
                raise
            print("  ponovni poskus (%s): %s" % (e, path), file=sys.stderr)
            time.sleep(5)
    with open(fn, "w", encoding="utf-8") as f:
        f.write(body)
    time.sleep(DELAY)
    return body


def fetch_json(path, offline):
    return json.loads(fetch(path, offline))


def api_film(fid, offline):
    """Podrobnosti filma iz api/filmi/<idF>: trajanje, jezik, podnapisi, uradni opis."""
    d = fetch_json("api/filmi/%s" % fid, offline)
    sl = d.get("sl") or {}
    body = sl.get("body") or []
    lead = next((p.get("t", "") for p in body if p.get("b")), "")
    return {
        "runtime": (d.get("common") or {}).get("length") or None,
        "language": re.sub(r"\s*,\s*", ", ", (sl.get("language") or "").strip(" /")) or None,
        "subtitles": (sl.get("subtitles") or "").strip(" /") or None,
        "lead": text(lead),
        "full_desc": "\n\n".join(text(p.get("t", "")) for p in body if p.get("t")),
    }


def clean_title(s):
    return re.sub(r"\s+", " ", s or "").strip()


def build(offline=False):
    now = dt.datetime.now(dt.timezone.utc).astimezone()
    warnings = []

    prog = fetch_json("api/program", offline)
    listing = prog.get("films") or []
    print("filmov v programu: %d" % len(listing))
    if len(listing) < MIN_FILMS:
        raise SystemExit("Vmesnik LIFFe je vrnil le %d filmov – podatkov ne prepišem. Preveri https://urnik.liffe.si/api/program" % len(listing))
    sec_by_id = {x["id"]: (x.get("name") or {}).get("sl", "") for x in prog.get("sections", [])}
    venue_by_id = {x["id"]: (x.get("name") or {}).get("sl", "") for x in prog.get("venues", [])}
    by_film = {}
    for s in prog.get("screenings", []):
        by_film.setdefault(str(s["film"]), []).append(s)

    films, screenings, opisi = [], [], {}
    out_of_scope = []
    for i, item in enumerate(listing, 1):
        fid = str(item["id"])
        det = api_film(fid, offline)
        title, dirs, ctr = item.get("title") or {}, item.get("directors") or {}, item.get("countries") or {}
        year = re.search(r"(18|19|20)\d{2}", str(item.get("year") or ""))
        f = {
            "title_sl": title.get("sl") or "", "title_en": title.get("en") or "", "title_orig": item.get("original") or "",
            "director": (dirs.get("sl") or "").strip(" ,"),
            "countries": [c.strip() for c in (ctr.get("sl") or "").split(",") if c.strip()],
            "year": int(year.group(0)) if year else None,
            "image": urllib.parse.unquote(item.get("imageLarge") or item.get("image") or "") or None,
            "vod": bool(item.get("vod")),
            "screenings": [], **det,
        }
        for s in sorted(by_film.get(fid, []), key=lambda x: (x["date"], x["time"])):
            if s.get("status", "scheduled") != "scheduled":
                warnings.append("Projekcija %s (film %s, %s %s) ima status »%s« – izpuščeno" % (s["id"], fid, s["date"], s["time"], s.get("status")))
                continue
            f["screenings"].append({"date": s["date"], "time": s["time"][:5], "venue_raw": venue_by_id.get(s["venue"], str(s["venue"])),
                                    "ticket_id": str(s["ticket"]) if s.get("ticket") else None})
        print("  [%3d/%d] %s — %s (%d projekcij)" % (i, len(listing), fid, f["title_sl"], len(f["screenings"])))

        sec_key = sec_by_id.get(item.get("section"), "").strip().upper()
        section = SECTION_NAMES.get(sec_key)
        if not section:
            section = sec_key.title()
            warnings.append("Neznana sekcija »%s« pri filmu %s" % (sec_key, fid))

        lj = []
        for s in f["screenings"]:
            v = VENUES.get(s["venue_raw"])
            if not v:
                warnings.append("Neznana dvorana »%s« (film %s, %s %s) — izpuščeno, preveri ročno"
                                % (s["venue_raw"], fid, s["date"], s["time"]))
                continue
            if v["city"] != "Ljubljana":
                out_of_scope.append((fid, s["date"], s["time"], v["name"]))
                continue
            if s["ticket_id"]:
                sid = "t" + s["ticket_id"]
            else:
                sid = "f%s-%s-%s-%s" % (fid, s["date"].replace("-", ""), s["time"].replace(":", ""), v["id"])
            lj.append({
                "id": sid,
                "film_id": fid,
                "date": s["date"],
                "time": s["time"],
                "venue": v["id"],
                "ticket_url": ("https://vstopnice.cd-cc.si/tickets/basket.php5?action=add&id=%s" % s["ticket_id"])
                              if s["ticket_id"] else None,
            })

        title_sl = clean_title(f["title_sl"])
        title_en = clean_title(f["title_en"])
        title_orig = clean_title(f["title_orig"])
        film = {
            "id": fid,
            "title_sl": title_sl or None,
            "title_en": title_en if title_en and title_en.lower() != title_sl.lower() else None,
            "title_orig": title_orig if title_orig and title_orig.lower() not in (title_sl.lower(), title_en.lower()) else None,
            "title_en_raw": title_en or None,  # za iskanje in zunanje baze
            "title_orig_raw": title_orig or None,
            "section": section,
            "director": f["director"] or None,
            "countries": f["countries"],
            "year": f["year"],
            "runtime": f["runtime"],
            "language": f["language"] or None,
            "subtitles": f["subtitles"] or None,
            "image": f["image"],
            "vod": f["vod"],
            "liffe_url": "https://urnik.liffe.si/Film.aspx?ln=sl&idF=%s" % fid,
            "screening_ids": [s["id"] for s in lj],
        }
        if f["runtime"] is None:
            warnings.append("Film %s (%s) nima podatka o trajanju" % (fid, title_sl))
        if not lj:
            # Ne sodi v ljubljanski vodič (npr. samo VOD ali samo druga mesta).
            film["ljubljana"] = False
        else:
            film["ljubljana"] = True
        films.append(film)
        screenings.extend(lj)
        opisi[fid] = {"title_sl": title_sl, "lead": f["lead"], "opis": f["full_desc"]}

    # Podvojeni ID-ji projekcij (ne bi smelo biti)
    ids = [s["id"] for s in screenings]
    dup = {x for x in ids if ids.count(x) > 1}
    if dup:
        warnings.append("Podvojeni ID-ji projekcij: %s" % ", ".join(sorted(dup)))

    # Festivalski dnevi v Ljubljani (uradni začetek lahko vključuje projekcije drugje, npr. v Cerknici)
    if screenings:
        lj_dates = sorted(x["date"] for x in screenings)
        FESTIVAL["start"], FESTIVAL["end"] = lj_dates[0], lj_dates[-1]
    fest = prog.get("festival") or {}
    if fest.get("start") and (fest.get("start"), fest.get("end")) != (FESTIVAL["start"], FESTIVAL["end"]):
        print("uradni festival %s–%s, v Ljubljani %s–%s" % (fest.get("start"), fest.get("end"), FESTIVAL["start"], FESTIVAL["end"]))

    lj_films = [f for f in films if f["ljubljana"]]
    used_venues = sorted({s["venue"] for s in screenings})
    venues = [dict(v) for v in VENUES.values() if v["id"] in used_venues]
    sections = []
    for f in lj_films:
        if f["section"] not in sections:
            sections.append(f["section"])
    order = list(SECTION_NAMES.values())
    sections.sort(key=lambda s: order.index(s) if s in order else 99)

    screenings.sort(key=lambda s: (s["date"], s["time"], s["venue"]))
    data = {
        "festival": {"name": "37. Ljubljanski mednarodni filmski festival", "short": "LIFFe 2026",
                     "start": FESTIVAL["start"], "end": FESTIVAL["end"], "timezone": "Europe/Ljubljana",
                     "url": "https://www.liffe.si/sl/", "tickets_url": "https://www.liffe.si/sl/vstopnice/vstopnice"},
        "source": {"films": BASE + "filmi.aspx", "schedule": BASE + "urnik.aspx", "api": BASE + "api/program",
                   "imported_at": now.isoformat(timespec="minutes")},
        "venues": venues,
        "sections": sections,
        "films": [{k: v for k, v in f.items() if k != "ljubljana"} for f in lj_films],
        "screenings": screenings,
        "excluded": {
            "films_without_ljubljana_screening": [{"id": f["id"], "title_sl": f["title_sl"]} for f in films if not f["ljubljana"]],
            "screenings_outside_ljubljana": len(out_of_scope),
        },
        "warnings": warnings,
    }
    return data, opisi


def diff(old, new):
    lines = []
    if not old:
        return ["Prvi uvoz."]
    of = {f["id"]: f for f in old.get("films", [])}
    nf = {f["id"]: f for f in new["films"]}
    for k in sorted(set(nf) - set(of)):
        lines.append("+ nov film: %s %s" % (k, nf[k]["title_sl"]))
    for k in sorted(set(of) - set(nf)):
        lines.append("- film odstranjen: %s %s" % (k, of[k]["title_sl"]))
    for k in sorted(set(of) & set(nf)):
        for fld in ("title_sl", "title_en", "director", "runtime", "section", "year"):
            if of[k].get(fld) != nf[k].get(fld):
                lines.append("~ film %s %s: %s %r → %r" % (k, nf[k]["title_sl"], fld, of[k].get(fld), nf[k].get(fld)))
    os_ = {s["id"]: s for s in old.get("screenings", [])}
    ns = {s["id"]: s for s in new["screenings"]}
    for k in sorted(set(ns) - set(os_)):
        s = ns[k]
        lines.append("+ nova projekcija %s: film %s %s %s %s" % (k, s["film_id"], s["date"], s["time"], s["venue"]))
    for k in sorted(set(os_) - set(ns)):
        s = os_[k]
        lines.append("- projekcija odstranjena %s: film %s %s %s %s" % (k, s["film_id"], s["date"], s["time"], s["venue"]))
    for k in sorted(set(os_) & set(ns)):
        a, b = os_[k], ns[k]
        if (a["date"], a["time"], a["venue"]) != (b["date"], b["time"], b["venue"]):
            lines.append("~ projekcija %s spremenjena: %s %s %s → %s %s %s"
                         % (k, a["date"], a["time"], a["venue"], b["date"], b["time"], b["venue"]))
    return lines or ["Brez sprememb."]


def main():
    offline = "--offline" in sys.argv
    data, opisi = build(offline)
    old = None
    if os.path.exists(OUT):
        with open(OUT, encoding="utf-8") as f:
            old = json.load(f)
    changes = diff(old, data)
    data["source"]["checksum"] = hashlib.sha1(json.dumps(
        [data["films"], data["screenings"]], sort_keys=True).encode()).hexdigest()[:12]
    if old and old.get("source", {}).get("checksum") == data["source"]["checksum"]:
        data["source"]["changed_at"] = old["source"].get("changed_at", old["source"]["imported_at"])
    else:
        data["source"]["changed_at"] = data["source"]["imported_at"]

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    os.makedirs(os.path.dirname(OPISI), exist_ok=True)
    with open(OPISI, "w", encoding="utf-8") as f:
        json.dump(opisi, f, ensure_ascii=False, indent=1)
    with open(SPREMEMBE, "w", encoding="utf-8") as f:
        f.write("# Spremembe ob uvozu %s\n\n" % data["source"]["imported_at"])
        f.write("\n".join("- " + l for l in changes) + "\n")
        if data["warnings"]:
            f.write("\n## Opozorila\n\n" + "\n".join("- " + w for w in data["warnings"]) + "\n")

    print("\nLjubljana: %d filmov, %d projekcij, %d dvoran; izven Ljubljane izpuščenih projekcij: %d"
          % (len(data["films"]), len(data["screenings"]), len(data["venues"]),
             data["excluded"]["screenings_outside_ljubljana"]))
    print("Filmi brez ljubljanske projekcije: %s" % ", ".join(
        x["title_sl"] for x in data["excluded"]["films_without_ljubljana_screening"]) or "—")
    print("Opozorila: %d (glej data/spremembe.md)" % len(data["warnings"]))
    for c in changes[:30]:
        print("  " + c)


if __name__ == "__main__":
    main()
