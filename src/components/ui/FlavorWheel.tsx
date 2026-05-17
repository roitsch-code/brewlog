"use client";
import { SCA_WHEEL, SCA_CATEGORIES } from "@/lib/constants/scaFlavorWheel";

/**
 * SCA Coffee Flavor Wheel — Light System rendering.
 *
 * The wheel is intrinsically monochrome (see scaFlavorWheel.ts: every
 * category's `shade` field is a near-identical dark gray). Category
 * differentiation comes from the icon glyphs + label opacity + a
 * tonal lift for active / has-selection states, not from per-category
 * brand colors. That made the Light port mostly a palette inversion:
 *
 *   - Canvas transparent so the page's Field gradient shows through
 *     the SVG instead of being covered by a solid panel.
 *   - Default segment fill = cream-glass at 55% — same token as the
 *     rest of the Light surfaces (Card, Chip, NavigationOverlay).
 *   - Has-selection segment fills a step darker (taupe) so the user
 *     can scan which categories already have picks.
 *   - Active segment uses low-opacity anthracite to read as a "press
 *     focus" without going harsh.
 *   - Text + icons swap from white to anthracite.
 *
 * Icons in the ICONS map use `currentColor`; the wrapping <g> sets
 * `color` so the whole icon palette tracks the theme without
 * touching individual fill/stroke attributes.
 *
 * `/taste` (still Dark) keeps consuming this component — it now
 * shows a Light-themed wheel on a Dark background until that page
 * gets its own Light migration. Acceptable transient per user
 * direction ("Taste ist egal").
 */

// ─── palette ──────────────────────────────────────────────────────────────────

const PALETTE = {
  // Canvas: transparent — Field paints behind. The outermost background
  // circle uses this so the SVG composes against whatever the parent
  // route's Field renders.
  canvas: "transparent",
  // Radial dividers between segments: warm cream slightly darker than
  // the card-default so they read as separation lines without competing
  // with the labels.
  divider: "hsl(30 60% 92%)",
  // Inner ring — category segments
  panelDefault: "hsl(36 55% 96% / 0.55)",
  panelHasSel: "hsl(30 30% 80% / 0.70)",
  panelActive: "hsl(0 0% 14% / 0.18)",
  // Outer ring — sub-category segments. Mirrors the inner ring's three
  // tonal states (default cream-glass, taupe has-sel, anthracite press)
  // at slightly weaker alpha so the inner ring stays the primary read.
  // Whole-wedge active treatment: tapping a category darkens both rings.
  subPanelDefault: "hsl(36 55% 96% / 0.55)",
  subPanelHasSel: "hsl(30 30% 80% / 0.50)",
  subPanelActive: "hsl(0 0% 14% / 0.12)",
  // Center circle
  center: "hsl(36 55% 96%)",
  centerStroke: "hsl(0 0% 14% / 0.15)",
  centerLabel: "hsl(0 0% 14% / 0.45)",
  // Text + icons (anthracite)
  text: "hsl(0 0% 14%)",
  icon: "hsl(0 0% 14%)",
  iconOpacity: 0.55,
  textOpacityActive: 0.95,
  textOpacityHasSel: 0.85,
  textOpacityDefault: 0.65,
  subTextOpacityActive: 0.85,
  subTextOpacityDefault: 0.55,
  // Radar polygon (profile mode)
  radarFill: "hsl(0 0% 14% / 0.10)",
  radarStroke: "hsl(0 0% 14%)",
  radarStrokeOpacity: 0.72,
  radarDot: "hsl(0 0% 14%)",
};

// ─── geometry helpers ─────────────────────────────────────────────────────────

function polar(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

/** SVG path for an annular (ring) sector. r1 = outer radius, r2 = inner radius. */
function annularSector(
  cx: number, cy: number,
  r1: number, r2: number,
  startAngle: number, endAngle: number,
): string {
  const large = endAngle - startAngle > Math.PI ? 1 : 0;
  const o1 = polar(cx, cy, r1, startAngle);
  const o2 = polar(cx, cy, r1, endAngle);
  const i1 = polar(cx, cy, r2, startAngle);
  const i2 = polar(cx, cy, r2, endAngle);
  return [
    `M ${o1.x} ${o1.y}`,
    `A ${r1} ${r1} 0 ${large} 1 ${o2.x} ${o2.y}`,
    `L ${i2.x} ${i2.y}`,
    `A ${r2} ${r2} 0 ${large} 0 ${i1.x} ${i1.y}`,
    "Z",
  ].join(" ");
}

/** Correct radial text rotation: text reads from center outward, stays legible in both halves. */
function radialRotation(midAngleRad: number): number {
  const deg = (midAngleRad * 180) / Math.PI;
  // Left half (between straight-down and straight-up going the long way round): flip 180°
  const isLeftHalf = midAngleRad > Math.PI / 2 && midAngleRad < (3 * Math.PI) / 2;
  return isLeftHalf ? deg + 180 : deg;
}

// ─── tiny category icons ──────────────────────────────────────────────────────
// Each icon is a small SVG group centered at (0,0) in a ±3.5 unit coordinate
// space. Rendered at the icon position inside each inner-ring segment.
// All strokes/fills use currentColor so the wrapping <g color={...}>
// drives the theme.

const ICONS: Record<string, React.ReactNode> = {
  "Fruity": (
    <g fill="currentColor">
      <circle cx={-1.7} cy={0.6}  r={1.1} />
      <circle cx={1.7}  cy={0.6}  r={1.1} />
      <circle cx={0}    cy={-1.7} r={1.1} />
    </g>
  ),
  "Floral": (
    <g stroke="currentColor" strokeWidth={0.65} fill="none">
      <line x1={0} y1={-3.2} x2={0} y2={3.2} />
      <line x1={-2.8} y1={-1.6} x2={2.8} y2={1.6} />
      <line x1={-2.8} y1={1.6}  x2={2.8} y2={-1.6} />
      <circle cx={0} cy={0} r={0.85} fill="currentColor" stroke="none" />
    </g>
  ),
  "Sweet": (
    <g fill="currentColor">
      <path d="M0,-3.2 C1.9,-0.5 2,1.5 0,3.2 C-2,1.5-1.9,-0.5 0,-3.2Z" />
    </g>
  ),
  "Nutty & Cocoa": (
    <g stroke="currentColor" strokeWidth={0.7} fill="none">
      <ellipse cx={0} cy={0} rx={1.8} ry={3} />
      <path d="M0,-3 C0.9,-1 0.9,1 0,3 M0,-3 C-0.9,-1-0.9,1 0,3" />
    </g>
  ),
  "Spices": (
    <g stroke="currentColor" strokeWidth={0.65} fill="none">
      <line x1={0} y1={-3.2} x2={0} y2={3.2} />
      <line x1={-3.2} y1={0} x2={3.2} y2={0} />
      <line x1={-2.3} y1={-2.3} x2={2.3} y2={2.3} />
      <line x1={-2.3} y1={2.3}  x2={2.3} y2={-2.3} />
    </g>
  ),
  "Roasted": (
    <g fill="currentColor">
      <rect x={-3.2} y={0.5}   width={1.5} height={2.8} rx={0.3} />
      <rect x={-0.8} y={-1}    width={1.5} height={4.3} rx={0.3} />
      <rect x={1.7}  y={-2.8}  width={1.5} height={6.1} rx={0.3} />
    </g>
  ),
  "Sour & Fermented": (
    <g stroke="currentColor" strokeWidth={0.7} fill="none">
      <path d="M-3.2,0 C-1.5,-2.5 1.5,-2.5 3.2,0" />
      <path d="M-3.2,0 C-1.5,2.5 1.5,2.5 3.2,0" />
      <circle cx={0} cy={0} r={0.7} fill="currentColor" stroke="none" />
    </g>
  ),
  "Herbal & Green": (
    <g stroke="currentColor" strokeWidth={0.7} fill="none">
      <path d="M0,3.2 C2.2,0.5 2.5,-2 0,-3.2 C-2.5,-2-2.2,0.5 0,3.2Z" />
      <line x1={0} y1={-2.8} x2={0} y2={3.2} />
    </g>
  ),
  "Savory": (
    <g stroke="currentColor" strokeWidth={0.7} fill="none">
      <path d="M-3,0.6 C-2.5,-2.4 2.5,-2.4 3,0.6Z" />
      <rect x={-0.9} y={0.6} width={1.8} height={2.8} />
    </g>
  ),
};

// ─── component ────────────────────────────────────────────────────────────────

interface FlavorWheelProps {
  mode: "select" | "profile";
  // select mode
  activeCategory?: string | null;
  onCategorySelect?: (cat: string | null) => void;
  selectedFlavors?: string[];
  // profile mode
  profileData?: { label: string; value: number }[];
  // shared
  size?: number;
}

export default function FlavorWheel({
  mode,
  activeCategory = null,
  onCategorySelect,
  selectedFlavors = [],
  profileData,
  size = 280,
}: FlavorWheelProps) {
  const cx = size / 2;
  const cy = size / 2;
  const s  = size / 280; // scale factor

  // Ring radii
  const rCenter = 24 * s;   // center dead-zone
  const rInner  = 94 * s;   // outer edge of category ring
  const rOuter  = 135 * s;  // outer edge of sub-category ring

  // No angular gap — even-width gaps are rendered as radial overlay lines
  const n     = SCA_CATEGORIES.length;      // 9
  const slice = (2 * Math.PI) / n;

  const isSelect = mode === "select";

  // Icon position: inner 40% of category ring
  const iconR = rCenter + (rInner - rCenter) * 0.36;
  // Text position: outer 68% of category ring — used for ALL labels (single and multi-line)
  const textR = rCenter + (rInner - rCenter) * 0.70;
  // Sub-category text radius: middle of outer ring
  const subTextR = rInner + (rOuter - rInner) * 0.50;

  const baseFontSize = Math.max(6.5 * s, 5.8);
  const subFontSize  = Math.max(5.5 * s, 5.0);

  // Gap line widths (in viewBox units)
  const catLineW = 1.8 * s;
  const subLineW = 1.2 * s;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${size} ${size}`}
      aria-label="SCA Coffee Flavor Wheel"
      style={{ display: "block" }}
    >
      {/* ── background ── transparent so the Field shows through ── */}
      <circle cx={cx} cy={cy} r={rOuter + 2} fill={PALETTE.canvas} />

      {SCA_CATEGORIES.map((cat, i) => {
        const { subcategories } = SCA_WHEEL[cat];
        const isActive = activeCategory === cat;
        const hasSel   = selectedFlavors.some(f =>
          Object.values(subcategories).flat().includes(f)
        );

        // Category angular span (full slice, no gap — gaps rendered as overlay lines)
        const catStart = slice * i - Math.PI / 2;
        const catEnd   = slice * (i + 1) - Math.PI / 2;
        const midAngle = (catStart + catEnd) / 2;

        const fill = isActive ? PALETTE.panelActive
          : hasSel ? PALETTE.panelHasSel
          : PALETTE.panelDefault;

        // ── Inner ring: category segment ──
        const catPath = annularSector(cx, cy, rInner, rCenter, catStart, catEnd);

        // Text rotation (radial)
        const textRotDeg = radialRotation(midAngle);

        // Icon position (upright, just translated)
        const iconPos = polar(cx, cy, iconR, midAngle);
        const iconScale = 0.88 * s;

        // All labels (single-word and multi-line) sit at textR, above the icon
        const labelParts = cat.includes(" & ") ? cat.split(" & ") : null;
        const labelPos = polar(cx, cy, textR, midAngle);

        const textOpacity = isActive ? PALETTE.textOpacityActive
          : hasSel ? PALETTE.textOpacityHasSel
          : PALETTE.textOpacityDefault;

        // Sub-categories
        const subKeys  = Object.keys(subcategories);
        const subSlice = (catEnd - catStart) / subKeys.length;

        return (
          <g key={cat}>
            {/* Category segment */}
            <path
              d={catPath}
              fill={fill}
              stroke="none"
              style={isSelect ? { cursor: "pointer" } : undefined}
              onClick={isSelect ? () => onCategorySelect?.(isActive ? null : cat) : undefined}
            />

            {/* Tiny icon (upright, not rotated). color drives currentColor in ICONS. */}
            <g
              transform={`translate(${iconPos.x},${iconPos.y}) scale(${iconScale})`}
              style={{ pointerEvents: "none", color: PALETTE.icon }}
              opacity={PALETTE.iconOpacity}
            >
              {ICONS[cat]}
            </g>

            {/* Category label — rotated radially, always at textR.
                Multi-word categories split into two tspan lines. */}
            {labelParts ? (
              <text
                x={labelPos.x}
                y={labelPos.y}
                fontSize={baseFontSize * 0.88}
                fontFamily="sans-serif"
                fontWeight={isActive ? "700" : "500"}
                fill={PALETTE.text}
                fillOpacity={textOpacity}
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${textRotDeg},${labelPos.x},${labelPos.y})`}
                style={{ pointerEvents: "none" }}
              >
                <tspan x={labelPos.x} dy="-0.65em">{labelParts[0]} &amp;</tspan>
                <tspan x={labelPos.x} dy="1.3em">{labelParts[1]}</tspan>
              </text>
            ) : (
              <text
                x={labelPos.x}
                y={labelPos.y}
                fontSize={baseFontSize}
                fontFamily="sans-serif"
                fontWeight={isActive ? "700" : "500"}
                fill={PALETTE.text}
                fillOpacity={textOpacity}
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${textRotDeg},${labelPos.x},${labelPos.y})`}
                style={{ pointerEvents: "none" }}
              >
                {cat}
              </text>
            )}

            {/* Sub-category ring — fill mirrors the inner-ring state of
                the parent category so the whole pie-wedge reacts together
                (active and has-sel both ripple through). */}
            {subKeys.map((sub, si) => {
              const subStart = catStart + subSlice * si;
              const subEnd   = catStart + subSlice * (si + 1);
              const subMid   = (subStart + subEnd) / 2;

              const subPath  = annularSector(cx, cy, rOuter, rInner, subStart, subEnd);
              const subPos   = polar(cx, cy, subTextR, subMid);
              const subRot   = radialRotation(subMid);

              const subFill = isActive ? PALETTE.subPanelActive
                : hasSel ? PALETTE.subPanelHasSel
                : PALETTE.subPanelDefault;

              return (
                <g key={sub}>
                  <path
                    d={subPath}
                    fill={subFill}
                    stroke="none"
                  />
                  <text
                    x={subPos.x}
                    y={subPos.y}
                    fontSize={subFontSize}
                    fontFamily="sans-serif"
                    fill={PALETTE.text}
                    fillOpacity={isActive ? PALETTE.subTextOpacityActive : PALETTE.subTextOpacityDefault}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${subRot},${subPos.x},${subPos.y})`}
                    style={{ pointerEvents: "none" }}
                  >
                    {sub}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}

      {/* ── Even-width radial dividers — drawn on top of segments.
          End exactly at rOuter (was rOuter + 2): with the transparent
          canvas the overshoot painted cream spikes beyond the wheel
          edge against the Field gradient. ── */}
      {/* Category boundaries: full height rCenter → rOuter */}
      {SCA_CATEGORIES.map((_, i) => {
        const angle = slice * i - Math.PI / 2;
        const p1 = polar(cx, cy, rCenter, angle);
        const p2 = polar(cx, cy, rOuter, angle);
        return (
          <line key={`cdiv-${i}`}
            x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
            stroke={PALETTE.divider} strokeWidth={catLineW}
          />
        );
      })}
      {/* Subcategory boundaries: outer ring only rInner → rOuter */}
      {SCA_CATEGORIES.map((cat, i) => {
        const { subcategories } = SCA_WHEEL[cat];
        const subKeys = Object.keys(subcategories);
        const catStart = slice * i - Math.PI / 2;
        const subSlice = slice / subKeys.length;
        return subKeys.slice(1).map((_, si) => {
          const angle = catStart + subSlice * (si + 1);
          const p1 = polar(cx, cy, rInner, angle);
          const p2 = polar(cx, cy, rOuter, angle);
          return (
            <line key={`sdiv-${cat}-${si}`}
              x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke={PALETTE.divider} strokeWidth={subLineW}
            />
          );
        });
      })}

      {/* ── center circle ── */}
      <circle
        cx={cx} cy={cy} r={rCenter - 1}
        fill={PALETTE.center}
        stroke={PALETTE.centerStroke}
        strokeWidth="0.8"
        style={isSelect && activeCategory ? { cursor: "pointer" } : undefined}
        onClick={isSelect && activeCategory ? () => onCategorySelect?.(null) : undefined}
      />
      <text
        x={cx} y={cy}
        fontSize={Math.max(7.5 * s, 6.5)}
        fontFamily="sans-serif"
        fill={PALETTE.centerLabel}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ pointerEvents: "none", letterSpacing: "0.05em" }}
      >
        {isSelect && activeCategory ? "×" : "SCA"}
      </text>

      {/* ── profile mode: radar polygon ── */}
      {mode === "profile" && profileData && profileData.length === n && (() => {
        // Radar polygon drawn inside the inner ring
        const radarMaxR = rCenter + (rInner - rCenter) * 0.85;
        const vertices  = SCA_CATEGORIES.map((cat, i) => {
          const catStart = slice * i - Math.PI / 2;
          const catEnd   = slice * (i + 1) - Math.PI / 2;
          const mid      = (catStart + catEnd) / 2;
          const val      = profileData.find(d => d.label === cat)?.value ?? 0;
          return polar(cx, cy, (val / 100) * radarMaxR + rCenter * 0.3, mid);
        });
        const pointStr = vertices.map(v => `${v.x},${v.y}`).join(" ");

        return (
          <g>
            <polygon
              points={pointStr}
              fill={PALETTE.radarFill}
              stroke={PALETTE.radarStroke}
              strokeWidth="1.4"
              strokeOpacity={PALETTE.radarStrokeOpacity}
            />
            {vertices.map((v, i) => {
              const val = profileData.find(d => d.label === SCA_CATEGORIES[i])?.value ?? 0;
              if (val < 5) return null;
              return <circle key={SCA_CATEGORIES[i]} cx={v.x} cy={v.y} r={2.5 * s} fill={PALETTE.radarDot} />;
            })}
          </g>
        );
      })()}
    </svg>
  );
}
