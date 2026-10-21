#!/usr/bin/env python3
"""Izdela prazno predlogo LuMa uredniškega Sheeta (data/luma_predloga.xlsx), samo stdlib.
Primeri so v vrsticah s primer = DA in se na strani nikoli ne prikažejo."""
import os
import zipfile
from xml.sax.saxutils import escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "luma_predloga.xlsx")

SHEETS = [
    ("luma_priporocila", [
        ["film_id", "naslov (za lažje branje)", "aktivno", "komentar", "vrstni_red", "primer"],
        ["3926", "17", "NE", "PRIMER – to ni resnično priporočilo. Vrstico izbriši ali prepiši.", "1", "DA"],
    ]),
    ("luma_skupne_projekcije", [
        ["screening_id", "film (za lažje branje)", "termin (za lažje branje)", "gremo", "povabilo", "zbirno_mesto", "prijava_url", "primer"],
        ["t227379", "17", "sre 11. 11. 16.00, Dvorana AGRFT", "NE", "PRIMER – to ni resničen skupni ogled.", "", "", "DA"],
    ]),
    ("luma_potrjeni_pridruzeni", [
        ["screening_id", "vzdevek", "objavi", "primer"],
        ["t227379", "PrimerVzdevek", "NE", "DA"],
    ]),
    ("navodila", [
        ["LuMa × LIFFe 2026 – uredniški podatki"],
        ["Ta Sheet je JAVNO berljiv (spletna stran ga bere). Vanj ne piši zasebnih podatkov, e-naslovov ali odgovorov obrazca."],
        ["ID-je najdeš na strani z dodatkom ?urednik na koncu naslova, npr. …/#/film/3926?urednik – pri filmu in vsakem terminu se izpiše ID."],
        ["luma_priporocila: film_id = LIFFe ID filma; aktivno = DA, da se prikaže; komentar = kratko besedilo LuMa; vrstni_red = 1, 2, 3 …"],
        ["luma_skupne_projekcije: screening_id = ID termina (začne se s t); gremo = DA; povabilo = besedilo; zbirno_mesto neobvezno; prijava_url = predizpolnjena povezava Google obrazca (neobvezno)."],
        ["luma_potrjeni_pridruzeni: sem prepiši SAMO vzdevke, ki so v obrazcu izrecno dovolili javni prikaz in si jih pregledala; objavi = DA. Za odjavo vrstico izbriši."],
        ["Stolpec primer: DA = vrstica se nikoli ne prikaže. Stolpci »za lažje branje« so samo zate; stran jih ne uporablja."],
        ["Spremembe so na strani vidne v nekaj minutah (ali takoj po osvežitvi, če stran bere Sheet neposredno)."],
    ]),
]


def col(i):
    s = ""
    i += 1
    while i:
        i, r = divmod(i - 1, 26)
        s = chr(65 + r) + s
    return s


def sheet_xml(rows):
    out = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>']
    for r, row in enumerate(rows, 1):
        out.append('<row r="%d">' % r)
        for c, v in enumerate(row):
            out.append('<c r="%s%d" t="inlineStr"><is><t xml:space="preserve">%s</t></is></c>' % (col(c), r, escape(v)))
        out.append("</row>")
    out.append("</sheetData></worksheet>")
    return "".join(out)


def main():
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
                   + "".join('<Override PartName="/xl/worksheets/sheet%d.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' % (i + 1) for i in range(len(SHEETS))) + "</Types>")
        z.writestr("_rels/.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
        z.writestr("xl/workbook.xml", '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'
                   + "".join('<sheet name="%s" sheetId="%d" r:id="r%d"/>' % (n, i + 1, i + 1) for i, (n, _) in enumerate(SHEETS)) + "</sheets></workbook>")
        z.writestr("xl/_rels/workbook.xml.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                   + "".join('<Relationship Id="r%d" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet%d.xml"/>' % (i + 1, i + 1) for i in range(len(SHEETS))) + "</Relationships>")
        for i, (_, rows) in enumerate(SHEETS):
            z.writestr("xl/worksheets/sheet%d.xml" % (i + 1), sheet_xml(rows))
    print(OUT, os.path.getsize(OUT), "B")


if __name__ == "__main__":
    main()
