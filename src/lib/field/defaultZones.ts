/**
 * Generative Field v1.1 — Default Field composition.
 *
 * The v1.0 Field expressed as a Zone composition. Per spec §6, this is
 * what renders when no `field_zones` is available (no scanned coffee,
 * variety fallback unavailable, or column null).
 *
 * Rendered output is **identical** to the v1.0 Field gradient — users
 * with no scanned coffees see exactly what they used to.
 *
 * `computedAt` is a fixed sentinel since this composition is a constant,
 * not a runtime result. Treated as "always fresh" by the cache layer.
 */

import type { FieldZones } from "./types";

export const DEFAULT_FIELD_ZONES: FieldZones = {
  version: 1,
  zones: [
    { id: "floral", weight: 0.4 },
    { id: "sweet-caramel", weight: 0.35 },
    { id: "fruity-bright", weight: 0.25 },
  ],
  modifiers: { saturation: 0, lightness: 0 },
  source: "default",
  computedAt: "1970-01-01T00:00:00.000Z",
};
