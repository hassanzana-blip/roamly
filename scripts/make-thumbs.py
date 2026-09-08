#!/usr/bin/env python3
"""Lager 256 px-varianter av reisemålsfotoene.

Miniatyrene i listene er 44–64 px brede, men den minste varianten var 640 px.
En rute hjem lastet dermed 83 kB for et bilde på 64 piksler. Denne skriver en
-256-variant ved siden av de eksisterende, med samme utsnitt og navn.
"""
import pathlib
from PIL import Image

SRC = pathlib.Path("public/destinations")
WIDTH = 256
made = 0
for p in sorted(SRC.glob("*.jpg")):
    if p.stem.endswith(("-640", "-256")):
        continue
    out = p.with_name(f"{p.stem}-256.jpg")
    if out.exists():
        continue
    im = Image.open(p)
    im = im.convert("RGB")
    h = round(im.height * WIDTH / im.width)
    im.resize((WIDTH, h), Image.LANCZOS).save(out, "JPEG", quality=78, optimize=True, progressive=True)
    made += 1
print(f"[thumbs] {made} nye 256 px-varianter")
