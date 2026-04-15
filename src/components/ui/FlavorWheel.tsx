"use client";
import { SCA_WHEEL, SCA_CATEGORIES } from "@/lib/constants/scaFlavorWheel";

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

const ICONS: Record<string, React.ReactNode> = {
  "Fruity": (
    <g fill="white" opacity={0.55}>
      <circle cx={-1.7} cy={0.6}  r={1.1} />
      <circle cx={1.7}  cy={0.6}  r={1.1} />
      <circle cx={0}    cy={-1.7} r={1.1} />
    </g>
  ),
  "Floral": (
    <g stroke="white" strokeWidth={0.65} fill="none" opacity={0.55}>
      <line x1={0} y1={-3.2} x2={0} y2={3.2} />
      <line x1={-2.8} y1={-1.6} x2={2.8} y2={1.6} />
      <line x1={-2.8} y1={1.6}  x2={2.8} y2={-1.6} />
      <circle cx={0} cy={0} r={0.85} fill="white" stroke="none" />
    </g>
  ),
  "Sweet": (
    <g fill="white" opacity={0.55}>
      <path d="M0,-3.2 C1.9,-0.5 2,1.5 0,3.2 C-2,1.5-1.9,-0.5 0,-3.2Z" />
    </g>
  ),
  "Nutty & Cocoa": (
    <g stroke="white" strokeWidth={0.7} fill="none" opacity={0.55}>
      <ellipse cx={0} cy={0} rx={1.8} ry={3} />
      <path d="M0,-3 C0.9,-1 0.9,1 0,3 M0,-3 C-0.9,-1-0.9,1 0,3" />
    </g>
  ),
  "Spices": (
    <g stroke="white" strokeWidth={0.65} fill="none" opacity={0.55}>
      <line x1={0} y1={-3.2} x2={0} y2={3.2} />
      <line x1={-3.2} y1={0} x2={3.2} y2={0} />
      <line x1={-2.3} y1={-2.3} x2={2.3} y2={2.3} />
      <line x1={-2.3} y1={2.3}  x2={2.3} y2={-2.3} />
    </g>
  ),
  "Roasted": (
    <g fill="white" opacity={0.55}>
      <rect x={-3.2} y={0.5}   width={1.5} height={2.8} rx={0.3} />
      <rect x={-0.8} y={-1}    width={1.5} height={4.3} rx={0.3} />
      <rect x={1.7}  y={-2.8}  width={1.5} height={6.1} rx={0.3} />
    </g>
  ),
  "Sour & Fermented": (
    <g stroke="white" strokeWidth={0.7} fill="none" opacity={0.55}>
      <path d="M-3.2,0 C-1.5,-2.5 1.5,-2.5 3.2,0" />
      <path d="M-3.2,0 C-1.5,2.5 1.5,2.5 3.2,0" />
      <circle cx={0} cy={0} r={0.7} fill="white" stroke="none" />
    </g>
  ),
  "Herbal & Green": (
    <g stroke="white" strokeWidth={0.7} fill="none" opacity={0.55}>
      <path d="M0,3.2 C2.2,0.5 2.5,-2 0,-3.2 C-2.5,-2-2.2,0.5 0,3.2Z" />
      <line x1={0} y1={-2.8} x2={0} y2={3.2} />
    </g>
  ),
  "Savory": (
    <g stroke="white" strokeWidth={0.7} fill="none" opacity={0.55}>
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
      {/* ── background ── */}
      <circle cx={cx} cy={cy} r={rOuter + 2} fill="#111" />

      {SCA_CATEGORIES.map((cat, i) => {
        const { shade, subcategories } = SCA_WHEEL[cat];
        const isActive = activeCategory === cat;
        const hasSel   = selectedFlavors.some(f =>
          Object.values(subcategories).flat().includes(f)
        );

        // Category angular span (full slice, no gap — gaps rendered as overlay lines)
        const catStart = slice * i - Math.PI / 2;
        const catEnd   = slice * (i + 1) - Math.PI / 2;
        const midAngle = (catStart + catEnd) / 2;

        // Fill: slightly brighter when active or has selections
        const fill = isActive ? "#484848"
          : hasSel   ? "#363636"
          : shade;

        // ── Inner ring: category segment ──
        const catPath = annularSector(cx, cy, rInner, rCenter, catStart, catEnd);

        // Text rotation (radial, corrected — no +90° bug)
        const textRotDeg = radialRotation(midAngle);

        // Icon position (upright, just translated)
        const iconPos = polar(cx, cy, iconR, midAngle);
        const iconScale = 0.88 * s;

        // All labels (single-word and multi-line) sit at textR, above the icon
        const labelParts = cat.includes(" & ") ? cat.split(" & ") : null;
        const labelPos = polar(cx, cy, textR, midAngle);

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

            {/* Tiny icon (upright, not rotated) */}
            <g
              transform={`translate(${iconPos.x},${iconPos.y}) scale(${iconScale})`}
              style={{ pointerEvents: "none" }}
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
                fill="white"
                fillOpacity={isActive ? 0.95 : hasSel ? 0.85 : 0.65}
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
                fill="white"
                fillOpacity={isActive ? 0.95 : hasSel ? 0.85 : 0.65}
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${textRotDeg},${labelPos.x},${labelPos.y})`}
                style={{ pointerEvents: "none" }}
              >
                {cat}
              </text>
            )}

            {/* Sub-category ring */}
            {subKeys.map((sub, si) => {
              const subStart = catStart + subSlice * si;
              const subEnd   = catStart + subSlice * (si + 1);
              const subMid   = (subStart + subEnd) / 2;

              const subPath  = annularSector(cx, cy, rOuter, rInner, subStart, subEnd);
              const subFill  = isActive ? "#323232" : "#1a1a1a";
              const subPos   = polar(cx, cy, subTextR, subMid);
              const subRot   = radialRotation(subMid);

              return (
                <g key={sub}>
                  <path
                    d={subPath}
                    fill={subFill}
                    fillOpacity={isActive ? 0.95 : 0.8}
                    stroke="none"
                  />
                  <text
                    x={subPos.x}
                    y={subPos.y}
                    fontSize={subFontSize}
                    fontFamily="sans-serif"
                    fill="white"
                    fillOpacity={isActive ? 0.75 : 0.38}
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

      {/* ── Even-width radial dividers — drawn on top of segments ── */}
      {/* Category boundaries: full height rCenter → rOuter */}
      {SCA_CATEGORIES.map((_, i) => {
        const angle = slice * i - Math.PI / 2;
        const p1 = polar(cx, cy, rCenter, angle);
        const p2 = polar(cx, cy, rOuter + 2, angle);
        return (
          <line key={`cdiv-${i}`}
            x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
            stroke="#111" strokeWidth={catLineW}
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
          const p2 = polar(cx, cy, rOuter + 2, angle);
          return (
            <line key={`sdiv-${cat}-${si}`}
              x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke="#111" strokeWidth={subLineW}
            />
          );
        });
      })}

      {/* ── center circle ── */}
      <circle
        cx={cx} cy={cy} r={rCenter - 1}
        fill="#0e0e0e"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="0.8"
        style={isSelect && activeCategory ? { cursor: "pointer" } : undefined}
        onClick={isSelect && activeCategory ? () => onCategorySelect?.(null) : undefined}
      />
      <text
        x={cx} y={cy}
        fontSize={Math.max(7.5 * s, 6.5)}
        fontFamily="sans-serif"
        fill="rgba(255,255,255,0.35)"
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
              fill="rgba(240,237,232,0.13)"
              stroke="#F0EDE8"
              strokeWidth="1.4"
              strokeOpacity="0.72"
            />
            {vertices.map((v, i) => {
              const val = profileData.find(d => d.label === SCA_CATEGORIES[i])?.value ?? 0;
              if (val < 5) return null;
              return <circle key={SCA_CATEGORIES[i]} cx={v.x} cy={v.y} r={2.5 * s} fill="#F0EDE8" />;
            })}
          </g>
        );
      })()}
    </svg>
  );
}
