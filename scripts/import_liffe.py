#!/usr/bin/env python3
"""
LuMa × LIFFe 2026 — uvoz uradnega programa.

Vir: https://urnik.liffe.si/filmi.aspx  (seznam filmov, stabilni idF)
     https://urnik.liffe.si/Film.aspx?ln=sl&idF=…  (podatki + projekcije)
     https://urnik.liffe.si/urnik.aspx  (samo za navzkrižno preverjanje)

robots.txt na urnik.liffe.si ne vsebuje nobene prepovedi (Disallow) in nobenih
content-signal vrednosti. Kljub temu zajemamo vljudno: ena zahteva naenkrat,
premor med zahtevami, surov HTML se shrani v .cache, tako da ponovni zagon
z --offline ne obremenjuje strežnika.

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
}

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
    fn = os.path.join(CACHE, re.sub(r"[^\w.=-]+", "_", path) + ".html")
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


def label(doc, lid):
    m = re.search(r'id="%s"[^>]*>(.*?)</span>' % re.escape(lid), doc, re.S)
    if not m or text(m.group(1)).strip(" /,") == "":
        return None  # LIFFe za manjkajoče vrednosti izpiše »/«
    return m.group(1)


def parse_list(doc):
    """Seznam filmov: idF, slovenski naslov, izvirni naslov, sekcija, sličica."""
    films = []
    for block in re.split(r'<div class="container-fluid"', doc):
        m = re.search(r'idF=(\d+)&amp;url=filmi', block)
        if not m or "css-crka" not in block:
            continue
        sec = re.search(r'sekcijaDiv">\s*<a[^>]*>([^<]*)</a>', block)
        films.append({
            "id": m.group(1),
            "section_raw": text(sec.group(1)) if sec else "",
        })
    seen, out = set(), []
    for f in films:
        if f["id"] not in seen:
            seen.add(f["id"])
            out.append(f)
    return out


DATE_RE = re.compile(r"(\d{1,2})\.(\d{1,2})\.(\d{4})")


def parse_film(fid, doc):
    title_sl = text(label(doc, "Label1"))
    title_orig = text(label(doc, "Label2"))
    title_en = text(label(doc, "Label3"))
    section_raw = text(label(doc, "Label4"))
    country_year = text(label(doc, "Label5"))
    runtime_raw = text(label(doc, "Label6"))
    director = text(label(doc, "Label7")).strip(" ,")
    language = text(label(doc, "Label12"))
    subtitles = text(label(doc, "Label13"))
    desc_html = label(doc, "Label15") or ""

    year = None
    countries = country_year
    m = re.search(r",?\s*((?:18|19|20)\d{2})\s*$", country_year)
    if m:
        year = int(m.group(1))
        countries = country_year[: m.start()]
    countries = [c.strip() for c in countries.split(",") if c.strip()]

    runtime = None
    m = re.search(r"(\d{1,3})\s*min", runtime_raw)
    if m:
        runtime = int(m.group(1))

    img = re.search(r'<img src="(https://liffe\.si/images/movies/[^"]+)" id="slika"', doc)

    # Uradni opis: prvi krepki stavek je uradni »logline«, ostalo sinopsis.
    lead = ""
    mb = re.search(r"(?s)<b>(.*?)</b>", desc_html)
    if mb:
        lead = text(mb.group(1))
    full_desc = text(desc_html)

    screenings = []
    for m in re.finditer(r'Repeater1_ctl(\d+)_Label1">([^<]*)</span>(.*?)(?=Repeater1_ctl\d+_Label1"|</table>)', doc, re.S):
        chunk = m.group(3)
        d = DATE_RE.search(m.group(2))
        t = re.search(r'_Label3">\s*(\d{1,2}):(\d{2})', chunk)
        v = re.search(r'_Label4">([^<]*)</span>', chunk)
        tk = re.search(r"basket\.php5\?action=add&amp;id=(\d+)", chunk)
        if not (d and t and v):
            continue
        date = "%04d-%02d-%02d" % (int(d.group(3)), int(d.group(2)), int(d.group(1)))
        time_ = "%02d:%s" % (int(t.group(1)), t.group(2))
        screenings.append({
            "date": date,
            "time": time_,
            "venue_raw": text(v.group(1)),
            "ticket_id": tk.group(1) if tk else None,
        })

    vod = "storitev VOD za izbrani film ni omogočena" not in doc

    return {
        "id": fid,
        "title_sl": title_sl,
        "title_en": title_en,
        "title_orig": title_orig,
        "section_raw": section_raw,
        "director": director,
        "countries": countries,
        "year": year,
        "runtime": runtime,
        "language": language,
        "subtitles": subtitles,
        "image": img.group(1) if img else None,
        "lead": lead,
        "full_desc": full_desc,
        "screenings": screenings,
        "vod": vod,
    }


def parse_urnik(doc):
    """Urnik za navzkrižno preverjanje: množica (idF, datum, ura, dvorana)."""
    out = set()
    cur_date = None
    for block in re.split(r'<div class="container-fluid"', doc):
        h = re.search(r"<h3>[^<]*?(\d{1,2}\.\d{1,2}\.\d{4})</h3>", block)
        if h:
            d = DATE_RE.search(h.group(1))
            cur_date = "%04d-%02d-%02d" % (int(d.group(3)), int(d.group(2)), int(d.group(1)))
            continue
        m = re.search(r"idF=(\d+)&amp;url=urnik", block)
        t = re.search(r'datum-ura">\s*<span[^>]*>\s*(\d{1,2}):(\d{2})', block)
        v = re.search(r'dvorana">\s*<span[^>]*>([^<]*)</span>', block)
        if m and t and v and cur_date:
            out.add((m.group(1), cur_date, "%02d:%s" % (int(t.group(1)), t.group(2)), text(v.group(1))))
    return out


def clean_title(s):
    return re.sub(r"\s+", " ", s or "").strip()


def build(offline=False):
    now = dt.datetime.now(dt.timezone.utc).astimezone()
    warnings = []

    listing = parse_list(fetch("filmi.aspx?ln=sl", offline))
    print("filmov na seznamu: %d" % len(listing))

    films, screenings, opisi = [], [], {}
    out_of_scope = []
    for i, item in enumerate(listing, 1):
        fid = item["id"]
        doc = fetch("Film.aspx?ln=sl&idF=%s" % fid, offline)
        f = parse_film(fid, doc)
        print("  [%3d/%d] %s — %s (%d projekcij)" % (i, len(listing), fid, f["title_sl"], len(f["screenings"])))

        sec_key = (f["section_raw"] or item["section_raw"]).strip().upper()
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
            if not (FESTIVAL["start"] <= s["date"] <= FESTIVAL["end"]):
                warnings.append("Projekcija izven festivalskih datumov: film %s %s" % (fid, s["date"]))
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

    # Navzkrižno preverjanje z urnikom
    try:
        urnik = parse_urnik(fetch("urnik.aspx?ln=sl", offline))
        name_of = {v["id"]: v["name"] for v in VENUES.values()}
        ours = {(s["film_id"], s["date"], s["time"], name_of[s["venue"]]) for s in screenings}
        urnik_lj = {u for u in urnik if VENUES.get(u[3], {}).get("city") == "Ljubljana"}
        only_film = ours - urnik_lj
        only_urnik = urnik_lj - ours
        for x in sorted(only_film):
            warnings.append("Na strani filma, ne pa v urniku: %s" % (x,))
        for x in sorted(only_urnik):
            warnings.append("V urniku, ne pa na strani filma: %s" % (x,))
        print("urnik: %d ljubljanskih vrstic, ujemanje s stranmi filmov: %s"
              % (len(urnik_lj), "DA" if not (only_film or only_urnik) else "NE"))
    except SystemExit as e:
        warnings.append("Urnik ni bil preverjen: %s" % e)

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
        "source": {"films": BASE + "filmi.aspx", "schedule": BASE + "urnik.aspx",
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
