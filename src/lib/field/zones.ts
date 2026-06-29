/**
 * Generative Field v1.1 — Zone definitions.
 *
 * Six palette specifications within the warm envelope (hues 0–60° and
 * 320–360° per spec §2). Each Zone is a perceptual band defined by
 * hue/saturation/lightness ranges. The composition algorithm samples
 * from these ranges deterministically — given the same FieldZones
 * input, the same colours come out.
 *
 * Zone overlap on the hue axis is intentional (Nutty-Cocoa and Sweet-
 * Caramel both ~30–45°; Fruity-Bright and Fruity-Deep both ~0–30°).
 * The differentiator is saturation × lightness, not hue.
 *
 * Lightness range is intentionally broadened from v1.0's 65–95% down
 * to 25–90% across zones, allowing dim-warm Fields (a cocoa-bomb
 * Brazilian Natural) without going cold. "Never cold" stays, "never
 * dim" goes — see spec §2 second paragraph.
 *
 * Exemplar aromas live in the Haiku mapping prompt (Appendix A of the
 * spec) — they're language-level metadata, not used by the gradient
 * algorithm.
 */

export type ZoneId =
  | "fruity-bright"
  | "fruity-deep"
  | "floral"
  | "nutty-cocoa"
  | "spice-earth"
  | "sweet-caramel";

export interface Zone {
  id: ZoneId;
  /** Hue range in degrees. Some zones wrap past 360 (encoded as 360 + n). */
  hueRange: [number, number];
  /** Saturation range in percent. */
  saturationRange: [number, number];
  /** Lightness range in percent. */
  lightnessRange: [number, number];
}

export const ZONES: Record<ZoneId, Zone> = {
  "fruity-bright": {
    id: "fruity-bright",
    hueRange: [0, 30],
    // Big-Sur lift: saturation floor pushed up so even the muted end reads vivid.
    saturationRange: [80, 100],
    lightnessRange: [70, 90],
  },
  "fruity-deep": {
    // Spec: 350–360° ∪ 0–15°. We encode as [350, 375] and mod-360 at
    // sample time so hue arithmetic stays linear.
    id: "fruity-deep",
    hueRange: [350, 375],
    saturationRange: [68, 92],
    lightnessRange: [50, 70],
  },
  floral: {
    id: "floral",
    hueRange: [320, 355],
    saturationRange: [62, 90],
    lightnessRange: [70, 88],
  },
  // nutty-cocoa + spice-earth stay comparatively restrained on purpose — the
  // Big-Sur drama is the CONTRAST between vivid fruit zones and these deep warm
  // ones, so a chocolatey Brazilian still reads warm-deep, not neon. Modest lift
  // only.
  "nutty-cocoa": {
    id: "nutty-cocoa",
    hueRange: [20, 40],
    saturationRange: [42, 62],
    lightnessRange: [30, 55],
  },
  "spice-earth": {
    id: "spice-earth",
    hueRange: [25, 45],
    saturationRange: [32, 52],
    lightnessRange: [28, 48],
  },
  "sweet-caramel": {
    id: "sweet-caramel",
    hueRange: [30, 50],
    saturationRange: [70, 95],
    lightnessRange: [60, 80],
  },
};

/** Convenience: ordered list of all zone ids. */
export const ZONE_IDS: ZoneId[] = Object.keys(ZONES) as ZoneId[];

/** True if the value is a known ZoneId. */
export function isZoneId(value: unknown): value is ZoneId {
  return typeof value === "string" && (ZONE_IDS as string[]).includes(value);
}
