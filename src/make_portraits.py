#!/usr/bin/env python3
"""The four portraits, squared for the 72 px circle on research.html.

The cards draw a circle with object-fit:cover, which centre-crops — and a centre crop of a tall
portrait takes the chin off. So the square is cut here instead, horizontally centred and, for an
image taller than it is wide, BIASED UPWARDS (a third of the excess off the top rather than half),
because in a head-and-shoulders photograph the face sits above the middle. Nothing is upscaled:
Gary's is 180 px and the circle is 72, which is already two and a half times what the page needs.
"""
from PIL import Image
import os, sys

# The four photographs Søren sent on 2026-10-20; pass the folder holding them as the first
# argument. Kept in src/ as the record of HOW the files in research/people/ were made, so a
# replacement photograph gets the same treatment rather than a hand crop.
SRC = sys.argv[1] if len(sys.argv) > 1 else "."
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "research", "people")
os.makedirs(OUT, exist_ok=True)
MAX = 256

WANT = [
    ("355c43d2-image.jpg", "gary-morris",      "Gary P. Morris"),
    ("bcceb09f-image.jpg", "amreen-mughal",    "Amreen Mughal"),
    ("545f0ac5-image.jpg", "changsi-cai",      "Changsi Cai"),
    ("af314616-image.jpg", "stephanie-bonney", "Stephanie K. Bonney"),
]

for src, slug, name in WANT:
    im = Image.open(os.path.join(SRC, src)).convert("RGB")
    w, h = im.size
    s = min(w, h)
    left = (w - s) // 2
    top = (h - s) // 3 if h > w else (h - s) // 2   # upward bias only when there is excess height
    im = im.crop((left, top, left + s, top + s))
    if s > MAX:
        im = im.resize((MAX, MAX), Image.LANCZOS)
    p = os.path.join(OUT, slug + ".jpg")
    im.save(p, "JPEG", quality=85, optimize=True, progressive=True)
    print("%-22s %3dx%-3d -> %3dx%-3d  %5.1f kB  %s"
          % (name, w, h, im.size[0], im.size[1], os.path.getsize(p) / 1024.0, slug + ".jpg"))

# A contact sheet, drawn as the page draws them: circular, at the size the card uses. Written
# only when a second argument gives a path for it, so a re-run does not drop a stray image into
# research/people/, which is served.
sheet_to = sys.argv[2] if len(sys.argv) > 2 else None
sheet = Image.new("RGB", (4 * 160, 200), (251, 250, 248))
try:
    if not sheet_to:
        raise SystemExit(0)
    from PIL import ImageDraw
    for i, (_s, slug, _n) in enumerate(WANT):
        im = Image.open(os.path.join(OUT, slug + ".jpg")).resize((144, 144), Image.LANCZOS)
        mask = Image.new("L", (144, 144), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, 143, 143), fill=255)
        sheet.paste(im, (i * 160 + 8, 28), mask)
    sheet.save(sheet_to)
    print("\ncontact sheet: " + sheet_to)
except Exception as e:
    print("sheet failed:", e)
