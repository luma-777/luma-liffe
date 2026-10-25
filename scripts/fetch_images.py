#!/usr/bin/env python3
"""
Slike filmov → site/img/s/<id>.jpg (640 px, kartice) in site/img/l/<id>.jpg (do 960 px, predogled).

Vir so uradne fotografije LIFFe (ista datoteka kot v LuMa mapi na Drive
»LIFFE 2026 slike velike«). Prenesemo jih enkrat, jih stisnemo in gostimo
sami, da stran ne nalaga slik s strežnika LIFFe.

Potrebuje macOS (orodje »sips«), zato teče lokalno, ne v GitHub Actions.
Novi filmi brez slike na strani dobijo tipografski nadomestek.

Uporaba:  python3 scripts/fetch_images.py [--vse]   (--vse prenese tudi že obstoječe)
"""

import json
import os
import shutil
import subprocess
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "scripts", ".cache", "img")
OUT_S = os.path.join(ROOT, "site", "img", "s")
OUT_L = os.path.join(ROOT, "site", "img", "l")
UA = "Mozilla/5.0 (compatible; LuMa-LIFFe-vodic/1.0)"


def sips(src, dst, width, quality):
    subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", str(quality),
                    "--resampleWidth", str(width), src, "--out", dst],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def width_of(path):
    out = subprocess.run(["sips", "-g", "pixelWidth", path], capture_output=True, text=True).stdout
    return int(out.strip().split()[-1])


def main():
    if not shutil.which("sips"):
        raise SystemExit("Potrebuješ macOS (sips).")
    films = json.load(open(os.path.join(ROOT, "data", "liffe.json"), encoding="utf-8"))["films"]
    for d in (CACHE, OUT_S, OUT_L):
        os.makedirs(d, exist_ok=True)
    done, miss = 0, []
    for f in films:
        fid, url = f["id"], f.get("image")
        s, l = os.path.join(OUT_S, fid + ".jpg"), os.path.join(OUT_L, fid + ".jpg")
        if os.path.exists(s) and os.path.exists(l) and "--vse" not in sys.argv:
            done += 1
            continue
        if not url:
            miss.append(f["title_sl"])
            continue
        raw = os.path.join(CACHE, fid + os.path.splitext(url)[1].lower())
        if not os.path.exists(raw):
            try:
                safe = urllib.parse.quote(url, safe=":/%")  # šumniki in presledki v imenih datotek
                with urllib.request.urlopen(urllib.request.Request(safe, headers={"User-Agent": UA}), timeout=30) as r:
                    open(raw, "wb").write(r.read())
                time.sleep(0.5)  # vljudno do strežnika LIFFe
            except Exception as e:  # noqa: BLE001
                miss.append("%s (%s)" % (f["title_sl"], e))
                continue
        w = width_of(raw)
        sips(raw, s, min(640, w), 60)
        sips(raw, l, min(960, w), 62)
        done += 1
        print("  %s %s" % (fid, f["title_sl"]))
    kb = sum(os.path.getsize(os.path.join(d, x)) for d in (OUT_S, OUT_L) for x in os.listdir(d)) // 1024
    print("slike: %d filmov, skupaj %d KB; brez slike: %s" % (done, kb, ", ".join(miss) or "—"))


if __name__ == "__main__":
    main()
