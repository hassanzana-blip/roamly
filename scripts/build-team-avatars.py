#!/usr/bin/env python3
"""Kvadratiske avatarer fra portrettene i public/team.

Portrettene er 1122x1402 med ansiktet i øvre halvdel. Avataren skal vise
hode og skuldre, ikke halve dressen, så vi klipper en kvadrat rundt ansiktet
og skalerer ned til de størrelsene grensesnittet faktisk ber om.
"""
from PIL import Image
import pathlib

SRC = pathlib.Path("public/team")
# (fil, senter_x, senter_y, side) i originalens piksler
FACES = {
    "zyar": ("team-1.jpg", 505, 470, 760),
    "zana": ("team-2.jpg", 540, 470, 760),
}
SIZES = (64, 128, 256)

for slug, (name, cx, cy, side) in FACES.items():
    im = Image.open(SRC / name).convert("RGB")
    half = side // 2
    left = max(0, min(cx - half, im.width - side))
    top = max(0, min(cy - half, im.height - side))
    face = im.crop((left, top, left + side, top + side))
    for s in SIZES:
        out = SRC / f"{slug}-{s}.jpg"
        face.resize((s, s), Image.LANCZOS).save(out, quality=88, optimize=True, progressive=True)
        print(f"{out}  {s}x{s}  {out.stat().st_size // 1024} kB")
