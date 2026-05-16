/**
 * Generative Field v1.1 — TypeScript shapes.
 *
 * The persisted shape of `coffees.field_zones` JSONB column (spec §10.2)
 * and the runtime types the composition algorithm consumes.
 */

import type { ZoneId } from "./zones";

export interface ZoneWeight {
  id: ZoneId;
  /** Float in [0, 1]. Weights across a FieldZones.zones array sum to 1.0. */
  weight: number;
}

export interface FieldModifiers {
  /** Integer in [-15, +15]. Applied globally to all 6 layers. */
  saturation: number;
  /** Integer in [-15, +15]. Applied globally to all 6 layers. */
  lightness: number;
}

export type FieldZonesSource = "tasting-notes" | "variety-implied" | "default";

/**
 * Persisted in coffees.field_zones JSONB. `null` means "not computed yet —
 * use Default Field". `version` allows future evolution without DB
 * migration.
 */
export interface FieldZones {
  version: 1;
  /** 1–3 entries, weights sum to 1.0. */
  zones: ZoneWeight[];
  modifiers: FieldModifiers;
  source: FieldZonesSource;
  /** ISO timestamp of when the mapping ran. */
  computedAt: string;
}
