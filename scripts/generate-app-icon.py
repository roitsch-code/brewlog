#!/usr/bin/env python3
"""
BTTS app-icon generator.

Renders the "Bt / ts" 2x2 monogram in Fraunces (high optical size, the
high-contrast editorial display cut) into the full set of PWA / Apple-touch /
native-shell PNG sizes plus a master SVG.

Design history:
  - v1 was a single washed-out serif "B" on a pale gradient.
  - v2 was the "BT / TS" all-caps seal on a pale warm gradient — too pastel.
  - v3 (this file, July 2026) — keeps the "BT / TS" caps seal (a touch smaller,
    optically re-centred) but swaps the washed field for a SATURATED, on-brand
    "murmuration" field: a soft diagonal base with large soft colour masses that
    pool in the corners and flow into each other (deep magenta lower-left, vivid
    orange-red upper-right, strong blue lower-right) — no striped linear
    gradient. Mirrors the live Field's composeGradient.ts composition.

Usage:
    python3 scripts/generate-app-icon.py <variant>
where <variant> is one of: bigsur | berry | grape | sunset | dark | cream |
mauve (default: bigsur). The gradient variants match the app's Field palette.

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

# Murmuration fields — saturated (NOT pastel), matching the live Field's
# composeGradient.ts: a soft diagonal base + large soft colour MASSES that pool
# in the corners and flow into each other (NOT a striped linear gradient). Each
# variant carries three zone colours (c0 dominant / c1 second / c2 third), a
# deep accent, and a soft two-stop base. Mass POSITIONS are shared (the
# "app-faithful" layout: c0 lower-left, c1 upper-right, c2 lower-right).
# "bigsur" carries the signature cool-blue mass.
MURMUR = {
    #          c0 (dominant) c1 (second)  c2 (third)   base A     base B
    "bigsur": ("#E00A8F",    "#FF4D1C",   "#3A46E6",   "#B4006E", "#2B34C8"),
    "berry":  ("#FF1E8A",    "#FF5A1F",   "#FFB000",   "#D11673", "#C77A00"),
    "grape":  ("#FF3D3D",    "#FF2D8B",   "#7A2BE0",   "#C42A2A", "#5A1FB0"),
    "sunset": ("#FF7A00",    "#FF2D6E",   "#D6008C",   "#C25E00", "#A6006E"),
}
BASE_ANGLE = 125         # soft diagonal base sweep
# masses: (cx%, cy%, which-colour, radius%, inner-alpha) — the app-faithful set
MASSES = [
    (18, 84, "c0", 80, 1.00),   # dominant pools lower-left
    (86, 22, "c1", 74, 1.00),   # second pools upper-right
    (84, 86, "c2", 66, 0.95),   # third pools lower-right
    (30, 20, "deep", 50, 0.60), # deep accent upper-left
]
RIBBON = (58, 22, 52)    # pale light-ribbon (cx%, cy%, r%)

# name : (kind, bg-or-None, letter-colour)
VARIANTS = {
    "bigsur": ("murmur", "bigsur", ANTHRACITE),
    "berry":  ("murmur", "berry",  ANTHRACITE),
    "grape":  ("murmur", "grape",  ANTHRACITE),
    "sunset": ("murmur", "sunset", ANTHRACITE),
    "dark":   ("solid", ANTHRACITE, CREAM),
    "cream":  ("solid", CREAM, ANTHRACITE),
    "mauve":  ("solid", MAUVE, ANTHRACITE),
}

CANVAS = 1024
CAP = 1400.0            # nominal cap height in font units (B top)

# layout knobs — a 2x2 grid (stamp/seal): caps "BT / TS", each glyph optically
# centred in its cell, then the whole ink block re-centred in the canvas.
TARGET_CAP = 282.0      # px cap height; a touch smaller than v2's 300
COL_HALF   = 150.0      # half the gap between the two column centres
ROW_GAP    = 64.0       # px gap between the two cap-height rows
Y_BIAS     = -6.0       # tiny upward optical nudge

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
    """Caps 'BT / TS' 2x2 seal, optically centred as a block."""
    grid = [["B", "T"], ["T", "S"]]
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


def _mass_gradient(idx, cx_pct, cy_pct, color, r_pct, inner):
    """A large soft colour mass fading to transparent (a murmuration blob)."""
    cx, cy, r = cx_pct / 100 * CANVAS, cy_pct / 100 * CANVAS, r_pct / 100 * CANVAS
    return (
        f'<radialGradient id="m{idx}" cx="{cx:.0f}" cy="{cy:.0f}" r="{r:.0f}" '
        f'gradientUnits="userSpaceOnUse">'
        f'<stop offset="0" stop-color="{color}" stop-opacity="{inner:.2f}"/>'
        f'<stop offset="0.62" stop-color="{color}" stop-opacity="{inner * 0.55:.2f}"/>'
        f'<stop offset="1" stop-color="{color}" stop-opacity="0"/></radialGradient>'
    )


def background(kind, bg):
    if kind == "solid":
        return f'<rect width="{CANVAS}" height="{CANVAS}" fill="{bg}"/>'
    if kind == "murmur":
        c0, c1, c2, baseA, baseB = MURMUR[bg]
        pick = {"c0": c0, "c1": c1, "c2": c2, "deep": baseA}
        defs = [
            f'<linearGradient id="base" '
            f'gradientTransform="rotate({BASE_ANGLE} 0.5 0.5)">'
            f'<stop offset="0" stop-color="{baseA}"/>'
            f'<stop offset="1" stop-color="{baseB}"/></linearGradient>'
        ]
        rects = [f'<rect width="{CANVAS}" height="{CANVAS}" fill="url(#base)"/>']
        for i, (cx, cy, key, r, a) in enumerate(MASSES):
            defs.append(_mass_gradient(i, cx, cy, pick[key], r, a))
            rects.append(f'<rect width="{CANVAS}" height="{CANVAS}" fill="url(#m{i})"/>')
        rcx, rcy, rr = RIBBON
        defs.append(
            f'<radialGradient id="rib" cx="{rcx/100*CANVAS:.0f}" '
            f'cy="{rcy/100*CANVAS:.0f}" r="{rr/100*CANVAS:.0f}" '
            f'gradientUnits="userSpaceOnUse">'
            f'<stop offset="0" stop-color="#FFE9D8" stop-opacity="0.30"/>'
            f'<stop offset="1" stop-color="#FFE9D8" stop-opacity="0"/></radialGradient>'
        )
        rects.append(f'<rect width="{CANVAS}" height="{CANVAS}" fill="url(#rib)"/>')
        return f'<defs>{"".join(defs)}</defs>{"".join(rects)}'
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
