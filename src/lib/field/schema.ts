/**
 * Generative Field v1.1 — Zod validation for the persisted FieldZones shape.
 *
 * Used at two boundaries:
 *   1. Inside /api/sessions POST, to validate the `fieldZones` field
 *      coming from the client before writing it into coffees.field_zones.
 *      Without this, a malicious or buggy client could write arbitrary
 *      JSONB into the DB column.
 *   2. As the runtime shape of /api/coffees/[id]'s response field —
 *      callers downstream import the TypeScript type from types.ts and
 *      trust the JSONB read, since we control the write path.
 *
 * Kept in its own file (not collapsed into types.ts) so the heavy Zod
 * import doesn't follow `FieldZones` consumers that only want the type.
 */

import { z } from "zod";

export const ZoneIdSchema = z.enum([
  "fruity-bright",
  "fruity-deep",
  "floral",
  "nutty-cocoa",
  "spice-earth",
  "sweet-caramel",
  "cool-berry",
]);

export const FieldZonesSchema = z
  .object({
    version: z.literal(1),
    zones: z
      .array(
        z.object({
          id: ZoneIdSchema,
          weight: z.number().min(0).max(1),
        }),
      )
      .min(1)
      .max(3),
    modifiers: z.object({
      saturation: z.number().int().min(-15).max(15),
      lightness: z.number().int().min(-15).max(15),
    }),
    source: z.enum(["tasting-notes", "variety-implied", "default"]),
    computedAt: z.string(),
  })
  // Allow weights summing within a small tolerance of 1.0 — Haiku is
  // usually within 0.01 of exact and the normalisation in
  // mapNotesToZones brings it to 1.0, but we don't want a 0.9999
  // payload to bounce on rounding alone.
  .refine(
    (v) => {
      const sum = v.zones.reduce((a, z) => a + z.weight, 0);
      return Math.abs(sum - 1) < 0.05;
    },
    { message: "zone weights must sum to ~1.0" },
  );
