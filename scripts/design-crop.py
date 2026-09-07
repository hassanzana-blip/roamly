#!/usr/bin/env python3
"""Slice a full-page screenshot into legible tiles.
usage: design-crop.py <png> [tile_height_px=1700] [max_width_px=780]
writes <png-stem>-tN.png next to the source."""
import sys, pathlib
from PIL import Image
src = pathlib.Path(sys.argv[1]); th = int(sys.argv[2]) if len(sys.argv) > 2 else 1700; mw = int(sys.argv[3]) if len(sys.argv) > 3 else 780
im = Image.open(src); W, H = im.size
if W > mw:
    im = im.resize((mw, int(H * mw / W)), Image.LANCZOS); W, H = im.size
n = 0
for y in range(0, H, th):
    tile = im.crop((0, y, W, min(y + th, H)))
    out = src.with_name(f"{src.stem}-t{n:02d}.png"); tile.save(out, optimize=True); n += 1
print(f"{src.name}: {W}x{H} -> {n} tiles of {th}px")
