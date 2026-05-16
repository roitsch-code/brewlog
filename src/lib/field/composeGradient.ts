/**
 * Generative Field v1.1 — gradient composition.
 *
 * Pure deterministic function: same input → same CSS gradient string.
 * No randomness, no Date.now(), no Math.random(). The same FieldZones +
 * rotation always produces identical output, which is what makes
 * "same coffee → same Field" hold across devices and re-opens.
 *
 * Output keeps the v1.0 structural shape exactly — one linear base +
 * five radials, ready to drop into the existing `.bg-brew-field` slot.
 * Only the colours and positions change. Spec §7 governs the mapping.
 */

import { ZONES, type ZoneId } from "./zones";
import type { FieldModifiers, FieldZones, ZoneWeight } from "./types";

interface Hsl {
  h: number; // 0–360 (allowed to go past during interpolation, wrap at render)
  s: number; // 0–100
  l: number; // 0–100
}

/** Linear interpolation between two numbers. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Clamp x into [min, max]. */
function clamp(x: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, x));
}

/** Sample a [min, max] range at position `t` in [0, 1]. */
function sampleRange(range: [number, number], t: number): number {
  return lerp(range[0], range[1], t);
}

/** Wrap a hue into [0, 360). Handles fruity-deep's 350–375° encoding. */
function wrapHue(h: number): number {
  const r = h % 360;
  return r < 0 ? r + 360 : r;
}

/** Format HSL to a CSS hsl() string with optional alpha. */
function hslToCss(hsl: Hsl, alpha?: number): string {
  const h = wrapHue(hsl.h);
  const s = clamp(hsl.s, 0, 100);
  const l = clamp(hsl.l, 0, 100);
  if (alpha === undefined || alpha >= 1) {
    return `hsl(${h.toFixed(0)} ${s.toFixed(0)}% ${l.toFixed(0)}%)`;
  }
  return `hsl(${h.toFixed(0)} ${s.toFixed(0)}% ${l.toFixed(0)}% / ${alpha.toFixed(2)})`;
}

/** Apply global S/L modifiers, clamped to legal ranges. Hue unchanged. */
function applyMods(hsl: Hsl, mods: FieldModifiers): Hsl {
  return {
    h: hsl.h,
    s: clamp(hsl.s + mods.saturation, 0, 100),
    l: clamp(hsl.l + mods.lightness, 0, 100),
  };
}

/**
 * Rotate a (x%, y%) position around the viewport centre (50%, 50%).
 * Standard math convention (positive θ = counter-clockwise in cartesian
 * coords; in CSS y-down coords this reads visually as clockwise — both
 * are fine, spec only constrains "moves slightly per step", not which
 * way).
 */
function rotatePos(x: number, y: number, rotationDeg: number): { x: number; y: number } {
  const theta = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const dx = x - 50;
  const dy = y - 50;
  return {
    x: 50 + dx * cos - dy * sin,
    y: 50 + dx * sin + dy * cos,
  };
}

/**
 * Pick a base colour for a single zone at the given position along its
 * S/L ranges. `huePos`, `satPos`, `lightPos` are in [0, 1] (0 = range
 * min, 1 = range max, 0.5 = midpoint).
 */
function sampleZone(
  zoneId: ZoneId,
  huePos: number,
  satPos: number,
  lightPos: number,
  hueOffset = 0,
): Hsl {
  const z = ZONES[zoneId];
  return {
    h: sampleRange(z.hueRange, huePos) + hueOffset,
    s: sampleRange(z.saturationRange, satPos),
    l: sampleRange(z.lightnessRange, lightPos),
  };
}

/**
 * Compose the 6-layer Field CSS gradient string for the given zone
 * composition and step rotation.
 *
 * The returned string is a valid `background` value — paint by setting
 * `style={{ background: composeFieldGradient(zones, 0) }}` on the inner
 * div of the LightShell sandwich (the v1.0 utility wrapper still
 * applies the blur/scale).
 *
 * Spec §7.1 mapping:
 *  - Layer 1 (linear base): top-3 zones, dim/desat (-15 sat, -10 light)
 *  - Layer 2 (bottom-left): highest, hue mid, sat HIGH, light MID
 *  - Layer 3 (mid-right):   second, hue mid, sat MID,  light HIGH
 *  - Layer 4 (mid-left):    third if present, else echo of highest with
 *                           hue +10°; sat MID, light HIGH
 *  - Layer 5 (upper-mid):   highest, hue mid, sat LOW, light HIGH
 *  - Layer 6 (top-right):   highest, hue mid, sat HIGH, light MAX
 *
 * Rotation rotates radial positions and the linear base's 135° angle by
 * the same delta. Hues, saturation, lightness are untouched.
 */
export function composeFieldGradient(fieldZones: FieldZones, rotationDeg = 0): string {
  const zones = [...fieldZones.zones].sort((a, b) => b.weight - a.weight);
  if (zones.length === 0) {
    // Degenerate input — caller should have used DEFAULT_FIELD_ZONES.
    // Return a neutral warm cream so we never render transparent.
    return "hsl(30 60% 92%)";
  }

  const mods = fieldZones.modifiers;
  const z0: ZoneWeight = zones[0];
  const z1: ZoneWeight = zones[1] ?? zones[0];
  const z2: ZoneWeight | null = zones[2] ?? null;

  // ── Layer 1 — linear base (135° rotated by rotationDeg) ──────────
  // Three-stop interpolation across the top-3 weighted zones, dim and
  // desaturated. With <3 zones we pad by repeating the highest.
  const baseAngle = (135 + rotationDeg) % 360;
  const baseTops: ZoneWeight[] = [z0, z1, z2 ?? z0];
  const baseStops = baseTops.map((zw, i) => {
    const baseColour = sampleZone(zw.id, 0.5, 0.5, 0.5);
    const dimmed: Hsl = {
      h: baseColour.h,
      s: clamp(baseColour.s - 15, 0, 100),
      l: clamp(baseColour.l - 10, 0, 100),
    };
    const final = applyMods(dimmed, mods);
    const pos = baseTops.length === 1 ? 0 : (i * 100) / (baseTops.length - 1);
    return `${hslToCss(final)} ${pos.toFixed(0)}%`;
  });
  const layer1 = `linear-gradient(${baseAngle.toFixed(0)}deg, ${baseStops.join(", ")})`;

  // ── Layer 2 — bottom-left hotspot ─────────────────────────────────
  const l2Colour = applyMods(sampleZone(z0.id, 0.5, 1.0, 0.5), mods);
  const l2Pos = rotatePos(12, 92, rotationDeg);
  const layer2 = `radial-gradient(circle at ${l2Pos.x.toFixed(0)}% ${l2Pos.y.toFixed(0)}%, ${hslToCss(l2Colour, 0.8)} 0%, transparent 60%)`;

  // ── Layer 3 — mid-right warm ──────────────────────────────────────
  const l3Colour = applyMods(sampleZone(z1.id, 0.5, 0.5, 1.0), mods);
  const l3Pos = rotatePos(95, 45, rotationDeg);
  const layer3 = `radial-gradient(circle at ${l3Pos.x.toFixed(0)}% ${l3Pos.y.toFixed(0)}%, ${hslToCss(l3Colour, 0.7)} 0%, transparent 50%)`;

  // ── Layer 4 — mid-left anchor ─────────────────────────────────────
  // Third zone if present, else echo of highest with hue rotated +10°.
  const l4Colour = z2
    ? applyMods(sampleZone(z2.id, 0.5, 0.5, 1.0), mods)
    : applyMods(sampleZone(z0.id, 0.5, 0.5, 1.0, /* hueOffset */ 10), mods);
  const l4Pos = rotatePos(18, 50, rotationDeg);
  const layer4 = `radial-gradient(circle at ${l4Pos.x.toFixed(0)}% ${l4Pos.y.toFixed(0)}%, ${hslToCss(l4Colour, 0.85)} 0%, transparent 55%)`;

  // ── Layer 5 — upper-mid cool mauve ────────────────────────────────
  const l5Colour = applyMods(sampleZone(z0.id, 0.5, 0.0, 1.0), mods);
  const l5Pos = rotatePos(55, 25, rotationDeg);
  const layer5 = `radial-gradient(circle at ${l5Pos.x.toFixed(0)}% ${l5Pos.y.toFixed(0)}%, ${hslToCss(l5Colour, 0.55)} 0%, transparent 50%)`;

  // ── Layer 6 — top-right highlight (the "lit ceiling") ─────────────
  const l6Colour = applyMods(sampleZone(z0.id, 0.5, 1.0, 1.0), mods);
  const l6Pos = rotatePos(92, 8, rotationDeg);
  const layer6 = `radial-gradient(circle at ${l6Pos.x.toFixed(0)}% ${l6Pos.y.toFixed(0)}%, ${hslToCss(l6Colour)} 0%, transparent 60%)`;

  // CSS stacks gradients top-to-bottom in source order. Spec §2.1 lists
  // Layer 1 as the base (painted first, at the bottom), Layer 6 as the
  // top highlight (painted last, on top). CSS background-image is
  // *reverse* painter — the first item in the comma list paints last
  // (on top). So we list Layer 6 FIRST and Layer 1 LAST.
  return [layer6, layer5, layer4, layer3, layer2, layer1].join(", ");
}
