#!/usr/bin/env python3
"""PDF à imprimer de chaque série culture générale (www/series/*.json) -> out/pdf/<slug>.pdf

Questions (avec cases à cocher) puis page des réponses expliquées.
Les PDF sont déposés dans /media/pdf/ sur le serveur (la page /quiz-a-imprimer ne liste que ceux qui existent).
Usage : python3 scripts/site/make-pdfs.py [dossier_sortie]
"""
import glob
import json
import os
import sys

from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle)

FONT_DIR = "/usr/share/fonts/truetype/dejavu/"
pdfmetrics.registerFont(TTFont("DV", FONT_DIR + "DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("DVB", FONT_DIR + "DejaVuSans-Bold.ttf"))
pdfmetrics.registerFontFamily("DV", normal="DV", bold="DVB")

TEAL = HexColor("#0f8b8d")
INK = HexColor("#1d2433")
SOFT = HexColor("#5b6475")
LEVELS = {"facile": "Facile", "moyen": "Moyen", "expert": "Expert"}

st_title = ParagraphStyle("t", fontName="DVB", fontSize=20, leading=24, textColor=INK, alignment=TA_CENTER)
st_sub = ParagraphStyle("s", fontName="DV", fontSize=9.5, leading=13, textColor=SOFT, alignment=TA_CENTER)
st_lvl = ParagraphStyle("l", fontName="DVB", fontSize=11, leading=14, textColor=TEAL, spaceBefore=6, spaceAfter=2)
st_q = ParagraphStyle("q", fontName="DVB", fontSize=10.5, leading=13.5, textColor=INK)
st_c = ParagraphStyle("c", fontName="DV", fontSize=10, leading=13, textColor=INK)
st_a = ParagraphStyle("a", fontName="DV", fontSize=9.5, leading=12.5, textColor=INK, spaceAfter=5)


def esc(s):
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def footer(slug):
    def draw(canvas, doc):
        canvas.saveState()
        canvas.setFont("DVB", 9)
        canvas.setFillColor(TEAL)
        canvas.drawString(18 * mm, 10 * mm, "YouQwiz")
        canvas.setFont("DV", 8)
        canvas.setFillColor(SOFT)
        canvas.drawString(34 * mm, 10 * mm, f"Quiz gratuit, à jouer aussi en ligne : youqwiz.com/{slug}")
        canvas.drawRightString(192 * mm, 10 * mm, f"Page {doc.page}")
        canvas.restoreState()
    return draw


def build(series, out):
    slug = series["path"].lstrip("/")
    name = series["h1"].split(" :")[0].split(" ?")[0].strip()
    qs = series["questions"]
    doc = SimpleDocTemplate(out, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=14 * mm, bottomMargin=18 * mm,
                            title=f"{name} — quiz à imprimer avec réponses", author="YouQwiz (youqwiz.com)",
                            subject=series.get("description", ""))
    els = [Paragraph(esc(name) + " — quiz à imprimer", st_title), Spacer(1, 2 * mm),
           Paragraph(f"{len(qs)} questions de facile à expert · coche une seule réponse par question · réponses page suivante", st_sub),
           Spacer(1, 2 * mm), Paragraph("Nom : ________________________________   Score : ______ / " + str(len(qs)), st_sub), Spacer(1, 3 * mm)]
    last = None
    for i, q in enumerate(qs, 1):
        block = []
        if q.get("level") != last:
            last = q.get("level")
            block.append(Paragraph(LEVELS.get(last, "Questions"), st_lvl))
        block.append(Paragraph(f"{i}. {esc(q['q'])}", st_q))
        letters = "ABCD"
        cells = [Paragraph(f"☐ {letters[k]}. {esc(c)}", st_c) for k, c in enumerate(q["choices"])]
        rows = [cells[0:2], cells[2:4]] if len(cells) == 4 else [cells]
        t = Table(rows, colWidths=[87 * mm, 87 * mm])
        t.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 6), ("TOPPADDING", (0, 0), (-1, -1), 1.5),
                               ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5), ("VALIGN", (0, 0), (-1, -1), "TOP")]))
        block += [t, Spacer(1, 2.2 * mm)]
        els.append(KeepTogether(block))
    els += [PageBreak(), Paragraph(esc(name) + " — réponses", st_title), Spacer(1, 2 * mm)]
    if series.get("verified"):
        y, m, d = series["verified"].split("-")
        els.append(Paragraph(f"Réponses vérifiées le {d}/{m}/{y}. Sources détaillées sur youqwiz.com/{slug}", st_sub))
    els.append(Spacer(1, 4 * mm))
    for i, q in enumerate(qs, 1):
        letter = "ABCD"[q["answer"]]
        txt = f"<b>{i}. {letter}. {esc(q['choices'][q['answer']])}</b>"
        if q.get("explication"):
            txt += " — " + esc(q["explication"])
        els.append(Paragraph(txt, st_a))
    doc.build(els, onFirstPage=footer(slug), onLaterPages=footer(slug))


def main():
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    out_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, "out", "pdf")
    os.makedirs(out_dir, exist_ok=True)
    n = 0
    for f in sorted(glob.glob(os.path.join(root, "www", "series", "*.json"))):
        s = json.load(open(f, encoding="utf-8"))
        build(s, os.path.join(out_dir, s["path"].lstrip("/") + ".pdf"))
        n += 1
    print(n, "PDF dans", out_dir)


if __name__ == "__main__":
    main()
