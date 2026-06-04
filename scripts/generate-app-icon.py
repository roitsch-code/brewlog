#!/usr/bin/env python3
"""
BTTS app-icon generator.

Renders the "BT / TS" 2x2 monogram in Fraunces (high optical size, the
high-contrast editorial display cut) into the full set of PWA / Apple-touch
PNG sizes plus a master SVG.

Why this exists: the previous icon was a single washed-out serif "B" on a pale
gradient. The premium references the user pointed at (MeinMagenta, Shopify Shop)
win on (1) a confident, saturated field and (2) a strong, high-contrast
letterform. This script gives us both, reproducibly, straight from the real
Fraunces outlines — no hand-traced paths to drift out of sync with the brand.

Usage:
    python3 scripts/generate-app-icon.py <variant>
where <variant> is one of: dark | cream | warm | mauve  (default: dark)

Requires: fonttools, cairosvg, and the Fraunces 144pt SemiBold TTF at
FONT_PATH (download once from Google Fonts — see the README note below).
"""
import os, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
import cairosvg

FONT_PATH = os.environ.get("FRAUNCES_TTF", "/tmp/fraunces-display.ttf")
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "icons")

# --- brand tokens (mirror tailwind.config.ts / CLAUDE.md) ---
ANTHRACITE = "#1F1B1A"
CREAM      = "#F3E5DC"
MAUVE      = "#D4B8C9"

VARIANTS = {
    # name : (background <defs+rect> builder, letter colour)
    "dark":  ("solid", ANTHRACITE, CREAM),
    "cream": ("solid", CREAM, ANTHRACITE),
    "mauve": ("solid", MAUVE, ANTHRACITE),
    "warm":  ("warm", None, ANTHRACITE),
}

CANVAS = 1024
UPM = 2000
CAP = 1400.0            # nominal cap height in font units (B top)

# layout knobs — a true 2x2 grid (stamp/seal), each glyph optically centred in
# its cell so the columns line up regardless of differing letter widths.
TARGET_CAP = 300.0      # px cap height per letter in the 1024 canvas
COL_HALF   = 142.0      # half the gap between the two column centres
ROW_GAP    = 64.0       # px gap between the two cap-height rows

font = TTFont(FONT_PATH)
glyphset = font.getGlyphSet()
cmap = font.getBestCmap()


def glyph_path(ch):
    pen = SVGPathPen(glyphset)
    glyphset[cmap[ord(ch)]].draw(pen)
    return pen.getCommands()


def glyph_xcenter(ch):
    """Visual horizontal centre of the glyph in font units (for optical centring)."""
    bp = BoundsPen(glyphset)
    glyphset[cmap[ord(ch)]].draw(bp)
    xmin, _, xmax, _ = bp.bounds
    return (xmin + xmax) / 2.0


def build_letters(fg):
    scale = TARGET_CAP / CAP
    grid = [["B", "T"], ["T", "S"]]  # row-major: top row BT, bottom row TS

    block_h = TARGET_CAP * 2 + ROW_GAP
    top = (CANVAS - block_h) / 2.0
    col_centers = [CANVAS / 2 - COL_HALF, CANVAS / 2 + COL_HALF]

    out = []
    for row, cells in enumerate(grid):
        cap_top = top + row * (TARGET_CAP + ROW_GAP)
        baseline = cap_top + TARGET_CAP
        for col, ch in enumerate(cells):
            cmds = glyph_path(ch)
            tx = col_centers[col] - glyph_xcenter(ch) * scale
            ty = baseline
            out.append(
                f'<g transform="translate({tx:.2f},{ty:.2f}) scale({scale:.5f},{-scale:.5f})">'
                f'<path d="{cmds}" fill="{fg}"/></g>'
            )
    return "\n".join(out)


def background(kind, bg):
    if kind == "solid":
        return f'<rect width="{CANVAS}" height="{CANVAS}" fill="{bg}"/>'
    if kind == "warm":
        # richer, more confident than the old washed-out field: a warm cream
        # corner deepening to apricot then rose, keeping the upper-left light so
        # anthracite letters stay legible.
        return f'''
  <defs>
    <linearGradient id="base" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0"    stop-color="{CREAM}"/>
      <stop offset="0.5"  stop-color="#F2C9A8"/>
      <stop offset="1"    stop-color="#E59BB0"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.28" cy="0.24" r="0.7">
      <stop offset="0" stop-color="#FBEFE3" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#FBEFE3" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="{CANVAS}" height="{CANVAS}" fill="url(#base)"/>
  <rect width="{CANVAS}" height="{CANVAS}" fill="url(#glow)"/>'''
    raise ValueError(kind)


def build_svg(variant):
    kind, bg, fg = VARIANTS[variant]
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{CANVAS}" height="{CANVAS}" '
        f'viewBox="0 0 {CANVAS} {CANVAS}">\n'
        f'{background(kind, bg)}\n'
        f'{build_letters(fg)}\n'
        f'</svg>\n'
    )


SIZES = {
    "icon-76.png": 76, "icon-120.png": 120, "icon-144.png": 144,
    "icon-152.png": 152, "icon-167.png": 167, "icon-180.png": 180,
    "icon-192.png": 192, "icon-512.png": 512, "apple-touch-icon.png": 180,
}


def main():
    variant = sys.argv[1] if len(sys.argv) > 1 else "dark"
    if variant not in VARIANTS:
        sys.exit(f"unknown variant {variant}; choose from {list(VARIANTS)}")
    svg = build_svg(variant)
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(os.path.join(OUT_DIR, "icon-source.svg"), "w") as fh:
        fh.write(svg)
    for name, px in SIZES.items():
        cairosvg.svg2png(
            bytestring=svg.encode(), write_to=os.path.join(OUT_DIR, name),
            output_width=px, output_height=px,
        )
    print(f"generated {variant}: {len(SIZES)} PNGs + icon-source.svg")


if __name__ == "__main__":
    main()
