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

// ── Field richness dials (full "Big-Sur" punch — owner-requested) ───────────
// The Field used to hold itself back to stay cream-dominant (the linear base
// dropped saturation/lightness, the hotspots capped low, the blobs sat at 0.62
// alpha). The owner wants the opposite now: a vivid, saturated, magenta-→-blue
// wallpaper feel that leans AWAY from cream. So the base is no longer washed
// out, the hotspots ride higher, and the drifting blobs are near-opaque and
// strongly saturated. These six numbers are the whole richness surface — every
// one is a one-line on-device dial; lower them if a screen reads too hot.
// (The old "BASE_DIM ≥ 4 / BLOB_ALPHA ≤ 0.7 keep-cream" guardrail is the exact
// thing being relaxed here — the punch lands in open areas; anthracite text
// still sits on the 55%-cream backdrop-blur cards, so legibility holds.)
const BASE_DESAT = 0; // linear-base desaturation (was 8 → now base keeps its colour)
const BASE_DIM = 3; // linear-base dimming (was 6 → brighter, more colourful base)
const RADIAL_ALPHA_BOOST = 0.2; // added to each hotspot's alpha …
const RADIAL_ALPHA_CAP = 0.97; // … then clamped so a hotspot can ride near-solid
const BLOB_ALPHA = 0.85; // alpha of the drifting FieldBlobs (the living layer)
const BLOB_SAT_BOOST = 24; // blobs ride near the top of their saturation so the drift pops

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

/** Boost a hotspot alpha by the richness dial, clamped so it never blows out. */
function boostAlpha(alpha: number): number {
  return clamp(alpha + RADIAL_ALPHA_BOOST, 0, RADIAL_ALPHA_CAP);
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
      s: clamp(baseColour.s - BASE_DESAT, 0, 100),
      l: clamp(baseColour.l - BASE_DIM, 0, 100),
    };
    const final = applyMods(dimmed, mods);
    const pos = baseTops.length === 1 ? 0 : (i * 100) / (baseTops.length - 1);
    return `${hslToCss(final)} ${pos.toFixed(0)}%`;
  });
  const layer1 = `linear-gradient(${baseAngle.toFixed(0)}deg, ${baseStops.join(", ")})`;

  // ── Layer 2 — bottom-left hotspot ─────────────────────────────────
  const l2Colour = applyMods(sampleZone(z0.id, 0.5, 1.0, 0.5), mods);
  const l2Pos = rotatePos(12, 92, rotationDeg);
  const layer2 = `radial-gradient(circle at ${l2Pos.x.toFixed(0)}% ${l2Pos.y.toFixed(0)}%, ${hslToCss(l2Colour, boostAlpha(0.8))} 0%, transparent 60%)`;

  // ── Layer 3 — mid-right warm ──────────────────────────────────────
  const l3Colour = applyMods(sampleZone(z1.id, 0.5, 0.5, 1.0), mods);
  const l3Pos = rotatePos(95, 45, rotationDeg);
  const layer3 = `radial-gradient(circle at ${l3Pos.x.toFixed(0)}% ${l3Pos.y.toFixed(0)}%, ${hslToCss(l3Colour, boostAlpha(0.7))} 0%, transparent 50%)`;

  // ── Layer 4 — mid-left anchor ─────────────────────────────────────
  // Third zone if present, else echo of highest with hue rotated +10°.
  const l4Colour = z2
    ? applyMods(sampleZone(z2.id, 0.5, 0.5, 1.0), mods)
    : applyMods(sampleZone(z0.id, 0.5, 0.5, 1.0, /* hueOffset */ 10), mods);
  const l4Pos = rotatePos(18, 50, rotationDeg);
  const layer4 = `radial-gradient(circle at ${l4Pos.x.toFixed(0)}% ${l4Pos.y.toFixed(0)}%, ${hslToCss(l4Colour, boostAlpha(0.85))} 0%, transparent 55%)`;

  // ── Layer 5 — upper-mid cool mauve ────────────────────────────────
  const l5Colour = applyMods(sampleZone(z0.id, 0.5, 0.0, 1.0), mods);
  const l5Pos = rotatePos(55, 25, rotationDeg);
  const layer5 = `radial-gradient(circle at ${l5Pos.x.toFixed(0)}% ${l5Pos.y.toFixed(0)}%, ${hslToCss(l5Colour, boostAlpha(0.55))} 0%, transparent 50%)`;

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

export interface FieldBlob {
  /** hsl(...) colour string — carries its own alpha. */
  color: string;
  /** Resting centre X, viewport %. */
  cx: number;
  /** Resting centre Y, viewport %. */
  cy: number;
}

/**
 * The four drifting blob layers of the living Field (motion §A).
 *
 * Lifts the same sorted zones the base gradient uses (z0/z1/z2) out as four
 * individually-transformable radial blobs so they can drift over the static
 * base — flow comes from the relative motion, never from repainting the base.
 * The four span a wide light↔deep range so the motion reads on the pale
 * default palette. Pure + deterministic, same contract as composeFieldGradient.
 */
export function fieldBlobColors(fieldZones: FieldZones): FieldBlob[] {
  const zones = [...fieldZones.zones].sort((a, b) => b.weight - a.weight);
  if (zones.length === 0) return [];

  const mods = fieldZones.modifiers;
  const z0 = zones[0];
  const z1 = zones[1] ?? zones[0];
  const z2 = zones[2] ?? null;

  // A blob colour: the zone's hue, saturation pushed to the top of its range
  // (+ boost), and an EXPLICIT lightness so the four blobs span a wide
  // light↔deep range. On the pale default palette an even lightness reads as a
  // static wash — moving LIGHT highlights against DEEP warm shadows is what
  // makes the flow actually visible.
  const blob = (zoneId: ZoneId, lightness: number, hueOffset = 0): string => {
    const sampled = sampleZone(zoneId, 0.5, 1.0, 0.5, hueOffset);
    const tuned = applyMods(
      { h: sampled.h, s: clamp(sampled.s + BLOB_SAT_BOOST, 0, 100), l: lightness },
      mods,
    );
    return hslToCss(tuned, BLOB_ALPHA);
  };

  // Anchors span the FULL height (not bottom-biased) so the deep blobs carry
  // strong colour up into the header and off the top edge — not just the lower
  // screen. idx1 is the upper-left deep anchor (behind the wordmark); idx3 keeps
  // one deep anchor low so colour still spans bottom→top. Lightness values
  // unchanged — this is positional, NOT a saturation change.
  return [
    { color: blob(z0.id, 84), cx: 80, cy: 10 }, // top-right highlight (bright)
    { color: blob(z0.id, 52), cx: 22, cy: 24 }, // upper-left warm shadow (deep) — strong colour into the header
    { color: blob(z1.id, 76), cx: 92, cy: 56 }, // mid-right (mid-bright)
    { color: blob(z2 ? z2.id : z0.id, 54, z2 ? 0 : 12), cx: 14, cy: 82 }, // lower-left shadow (deep) — anchors the bottom
  ];
}
