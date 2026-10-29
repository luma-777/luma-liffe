#!/usr/bin/env python3
"""
Posnetek LuMa uredniškega Google Sheeta → site/data/luma.json

Stran Sheet bere tudi neposredno (če je v config.js nastavljen sheetId). Ta
posnetek je rezerva: če Google ni dosegljiv, ali če se odločiš, da Sheet bere
samo samodejna objava (GitHub Actions), ne pa obiskovalci.

Bere povezave »Objavi v splet« (luma.csv v config.js), sicer Sheet, deljen
»Kdor koli s povezavo: ogledovalec« (luma.sheetId). Vsebuje samo neobčutljive
uredniške podatke – odgovori obrazca so v ločenem, zasebnem listu.

Uporaba:  python3 scripts/fetch_luma.py [SHEET_ID]
          (brez argumenta vzame sheetId iz site/config.js ali okolja LUMA_SHEET_ID)
"""

import csv
import datetime as dt
import io
import json
import os
import re
import sys
import urllib.parse
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "site", "data", "luma.json")
TABS = {"priporocila": "luma_priporocila", "skupne": "luma_skupne_projekcije", "pridruzeni": "luma_potrjeni_pridruzeni",
        "ziherce": "luma_ziherce", "opombe": "luma_opombe_projekcij"}
# Javno gredo samo ti stolpci – vse drugo (npr. opombe) ostane v Sheetu.
KEEP = {
    "priporocila": ["film_id", "aktivno", "komentar", "vrstni_red", "videla_sva", "primer"],
    "skupne": ["screening_id", "gremo", "povabilo", "zbirno_mesto", "prijava_url", "vrsta", "sedeza", "primer"],
    "pridruzeni": ["screening_id", "vzdevek", "objavi", "primer"],
    "ziherce": ["film_id", "razlog", "nagrada", "vrstni_red", "aktivno", "primer"],
    "opombe": ["screening_id", "oznaka", "besedilo", "aktivno", "primer"],
}


def sheet_id():
    if len(sys.argv) > 1:
        return sys.argv[1]
    if os.environ.get("LUMA_SHEET_ID"):
        return os.environ["LUMA_SHEET_ID"]
    cfg = open(os.path.join(ROOT, "site", "config.js"), encoding="utf-8").read()
    m = re.search(r'sheetId:\s*"([^"]*)"', cfg)
    return m.group(1) if m else ""


def key(h):
    import unicodedata
    h = unicodedata.normalize("NFKD", h)
    h = "".join(c for c in h if not unicodedata.combining(c)).lower()
    return re.sub(r"[^a-z0-9]+", "_", h).strip("_")


def published_csv():
    """Povezave »Objavi v splet« (CSV) iz site/config.js → luma.csv, če so vpisane."""
    cfg = open(os.path.join(ROOT, "site", "config.js"), encoding="utf-8").read()
    m = re.search(r"csv:\s*\{([^}]*)\}", cfg)
    if not m:
        return {}
    found = dict(re.findall(r'(\w+):\s*"([^"]*)"', m.group(1)))
    return found if all(found.get(k) for k in TABS) else {}


def fetch(sid, tab, url=None):
    url = url or "https://docs.google.com/spreadsheets/d/%s/gviz/tq?tqx=out:csv&sheet=%s" % (sid, urllib.parse.quote(tab))
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "LuMa-LIFFe"}), timeout=30) as r:
            ctype = r.headers.get("Content-Type", "")
            body = r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            raise SystemExit("Sheet ni javno berljiv (HTTP %d). Deli ga kot »Kdor koli s povezavo: ogledovalec«." % e.code)
        raise
    if "text/csv" not in ctype:
        raise SystemExit("Sheet ni javno berljiv (dobili smo %s). Deli ga kot »Kdor koli s povezavo: ogledovalec«." % ctype)
    rows = list(csv.reader(io.StringIO(body)))
    if not rows:
        return []
    head = [key(h) for h in rows[0]]
    return [dict(zip(head, r)) for r in rows[1:] if any(c.strip() for c in r)]


def main():
    pub = published_csv()
    sid = sheet_id()
    if not pub and not sid:
        raise SystemExit("Ni ne luma.csv ne luma.sheetId v site/config.js.")
    out = {"_opomba": "Posnetek LuMa Google Sheeta (scripts/fetch_luma.py).",
           "updated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="minutes")}
    for k, tab in TABS.items():
        rows = fetch(sid, tab, pub.get(k))
        out[k] = [{c: (r.get(c) or "").strip() for c in KEEP[k]} for r in rows]
        print("%-12s %d vrstic" % (k, len(out[k])))
    # Brez sprememb v Sheetu datoteke ne prepišemo, da robot ne dela praznih commitov vsako uro.
    if os.path.exists(OUT):
        old = json.load(open(OUT, encoding="utf-8"))
        if all(old.get(k) == out[k] for k in TABS):
            print("brez sprememb")
            return
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print("→", os.path.relpath(OUT, ROOT))


if __name__ == "__main__":
    main()
