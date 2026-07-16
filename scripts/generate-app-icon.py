#!/usr/bin/env python3
"""
BTTS app-icon generator.

Renders the "Bt / ts" 2x2 monogram in Fraunces (high optical size, the
high-contrast editorial display cut) into the full set of PWA / Apple-touch /
native-shell PNG sizes plus a master SVG.

Design history:
  - v1 was a single washed-out serif "B" on a pale gradient.
  - v2 (the "BT / TS" all-caps seal) fixed the field but the two big capital
    T's dominated and read awkwardly.
  - v3 (this file, July 2026) — brighter, on-brand "Big-Sur" field to match the
    live Field background, and a LOWERCASE "Bt / ts" monogram: one tall cap B
    with lowercase t/t/s at natural x-height reads as a little word, killing the
    twin-T problem. Letters are a touch smaller than v2.

Usage:
    python3 scripts/generate-app-icon.py <variant>
where <variant> is one of: bigsur | berry | sunset | dark | cream | mauve
(default: bigsur). The gradient variants match the app's Field palette.

Requires: fonttools, cairosvg, and a Fraunces variable/SemiBold TTF at
FONT_PATH (download once from Google Fonts). It reads the real Fraunces
outlines — no hand-traced paths to drift out of sync with the brand.

Outputs (relative to repo root):
  public/icons/icon-source.svg + all PWA PNG sizes + apple-touch-icon.png
  src/app/icon.png                                   (Next.js app icon, 192)
  native/assets/logo.svg                             (Capacitor asset source)
  native/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png (1024)
  native/ios/App/BTTSWatch/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png (1024)
"""
import os, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
import cairosvg

FONT_PATH = os.environ.get("FRAUNCES_TTF", "/tmp/fraunces-display.ttf")
ROOT = os.path.join(os.path.dirname(__file__), "..")
PWA_DIR = os.path.join(ROOT, "public", "icons")

# --- brand tokens (mirror tailwind.config.ts / CLAUDE.md) ---
ANTHRACITE = "#1F1B1A"
CREAM      = "#F3E5DC"
MAUVE      = "#D4B8C9"

# Gradient fields — brighter, matching the live Field zones (fruity / floral /
# cool-berry). "bigsur" carries the signature cool-blue corner.
GRADIENTS = {
    "bigsur": [("0", "#F05CA6"), ("0.52", "#FF8A6B"), ("1", "#6E8BE0")],
    "berry":  [("0", "#FF7EB0"), ("0.5", "#FF8C72"), ("1", "#FFC163")],
    "sunset": [("0", "#FFC27A"), ("0.5", "#FF8FA6"), ("1", "#F56A9A")],
}
# name : (kind, bg-or-None, letter-colour)
VARIANTS = {
    "bigsur": ("grad", "bigsur", ANTHRACITE),
    "berry":  ("grad", "berry",  ANTHRACITE),
    "sunset": ("grad", "sunset", ANTHRACITE),
    "dark":   ("solid", ANTHRACITE, CREAM),
    "cream":  ("solid", CREAM, ANTHRACITE),
    "mauve":  ("solid", MAUVE, ANTHRACITE),
}

CANVAS = 1024
CAP = 1400.0            # nominal cap height in font units (B top)

# layout knobs — a 2x2 grid (stamp/seal). Lowercase-natural: cap B + x-height
# t/t/s, then the whole ink block is optically re-centred in the canvas.
TARGET_CAP = 286.0      # px cap height (the B); a touch smaller than v2's 300
COL_HALF   = 150.0      # half the gap between the two column centres
ROW_GAP    = 44.0       # px gap between the two rows
Y_BIAS     = -8.0       # tiny upward optical nudge

font = TTFont(FONT_PATH)
glyphset = font.getGlyphSet()
cmap = font.getBestCmap()


def glyph_path(ch):
    pen = SVGPathPen(glyphset)
    glyphset[cmap[ord(ch)]].draw(pen)
    return pen.getCommands()


def glyph_bounds(ch):
    bp = BoundsPen(glyphset)
    glyphset[cmap[ord(ch)]].draw(bp)
    return bp.bounds  # xmin, ymin, xmax, ymax


def build_letters(fg):
    """Lowercase 'Bt / ts', natural proportions, optically centred as a block."""
    grid = [["B", "t"], ["t", "s"]]
    scale = TARGET_CAP / CAP
    cols = [CANVAS / 2 - COL_HALF, CANVAS / 2 + COL_HALF]

    block_h = TARGET_CAP * 2 + ROW_GAP
    top = (CANVAS - block_h) / 2.0

    placements = []          # (ch, tx, baseline)
    ink_tops, ink_bots = [], []
    for row, cells in enumerate(grid):
        baseline = top + row * (TARGET_CAP + ROW_GAP) + TARGET_CAP
        for col, ch in enumerate(cells):
            xmin, ymin, xmax, ymax = glyph_bounds(ch)
            tx = cols[col] - (xmin + xmax) / 2.0 * scale
            placements.append((ch, tx, baseline))
            # canvas y (glyph y is flipped): top = baseline - ymax*scale
            ink_tops.append(baseline - ymax * scale)
            ink_bots.append(baseline - ymin * scale)

    shift = (CANVAS - (min(ink_tops) + max(ink_bots))) / 2.0 + Y_BIAS
    out = []
    for ch, tx, baseline in placements:
        out.append(
            f'<g transform="translate({tx:.2f},{baseline + shift:.2f}) '
            f'scale({scale:.5f},{-scale:.5f})">'
            f'<path d="{glyph_path(ch)}" fill="{fg}"/></g>'
        )
    return "\n".join(out)


def background(kind, bg):
    if kind == "solid":
        return f'<rect width="{CANVAS}" height="{CANVAS}" fill="{bg}"/>'
    if kind == "grad":
        stops = "".join(
            f'<stop offset="{o}" stop-color="{c}"/>' for o, c in GRADIENTS[bg]
        )
        # a soft cream glow in the upper-left keeps the anthracite letters legible
        return (
            f'<defs>'
            f'<linearGradient id="base" x1="0" y1="0" x2="1" y2="1">{stops}</linearGradient>'
            f'<radialGradient id="glow" cx="0.30" cy="0.24" r="0.72">'
            f'<stop offset="0" stop-color="#FFF4EA" stop-opacity="0.5"/>'
            f'<stop offset="1" stop-color="#FFF4EA" stop-opacity="0"/>'
            f'</radialGradient></defs>'
            f'<rect width="{CANVAS}" height="{CANVAS}" fill="url(#base)"/>'
            f'<rect width="{CANVAS}" height="{CANVAS}" fill="url(#glow)"/>'
        )
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


PWA_SIZES = {
    "icon-76.png": 76, "icon-120.png": 120, "icon-144.png": 144,
    "icon-152.png": 152, "icon-167.png": 167, "icon-180.png": 180,
    "icon-192.png": 192, "icon-512.png": 512, "apple-touch-icon.png": 180,
}


def png(svg, path, px):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    cairosvg.svg2png(bytestring=svg.encode(), write_to=path,
                     output_width=px, output_height=px)


def main():
    variant = sys.argv[1] if len(sys.argv) > 1 else "bigsur"
    if variant not in VARIANTS:
        sys.exit(f"unknown variant {variant}; choose from {list(VARIANTS)}")
    svg = build_svg(variant)

    # 1) PWA icon set + master SVG
    os.makedirs(PWA_DIR, exist_ok=True)
    with open(os.path.join(PWA_DIR, "icon-source.svg"), "w") as fh:
        fh.write(svg)
    for name, px in PWA_SIZES.items():
        png(svg, os.path.join(PWA_DIR, name), px)

    # 2) Next.js app icon
    png(svg, os.path.join(ROOT, "src", "app", "icon.png"), 192)

    # 3) Capacitor native-shell asset source (regenerated by `npm run assets`)
    with open(os.path.join(ROOT, "native", "assets", "logo.svg"), "w") as fh:
        fh.write(svg)

    # 4) Committed native AppIcons (iPhone app + Watch app), 1024px
    png(svg, os.path.join(
        ROOT, "native", "ios", "App", "App", "Assets.xcassets",
        "AppIcon.appiconset", "AppIcon-512@2x.png"), 1024)
    png(svg, os.path.join(
        ROOT, "native", "ios", "App", "BTTSWatch", "Assets.xcassets",
        "AppIcon.appiconset", "AppIcon-1024.png"), 1024)

    print(f"generated '{variant}': PWA set + app icon + native logo + 2 AppIcons")


if __name__ == "__main__":
    main()
