// Deterministic vessel-capacity backstops for /recommend candidates.
//
// SINGLE SOURCE OF TRUTH for every brewer's brew-volume window. The owner
// supplied these min/max values from his real kit (2026-08-31); the UI method
// chips, the /recommend prompt's HARD CAPACITY block and these guards must all
// read the same numbers — they drifted before (UI said "Clever 400ml" while the
// code enforced 450), so keep VESSEL_CAPS the one place they live.
//
// The /recommend prompt already forbids the wrong vessel for the requested
// volume, but the Mistral spike (issue #453, docs/recommend-spike-run3.md)
// showed a model can still pick one — it honours buried negatives less
// reliably than Opus did. These pure checks are the server-side guards
// recommend.ts applies after generation.
//
// Two directions are covered:
//   - vesselOverflow      — the recipe POURS a volume the vessel can't hold
//                           (>max) or is below a batch brewer's floor (<min).
//                           Compares recipe.waterGrams against the window, so an
//                           iced recipe (waterGrams = hot portion only) isn't
//                           falsely flagged.
//   - vesselCannotServe   — the vessel physically can't SERVE the volume the
//                           user asked for: the target exceeds its max (the
//                           "450ml request → 180ml AeroPress" clamp bug) OR
//                           falls below a batch brewer's min (a 350ml
//                           Moccamaster). This is the selector's hard filter.

export interface VesselCap {
  label: string;
  /** Batch-brewer floor — the vessel needs at least this much to brew well. */
  minMl?: number;
  /** The vessel physically holds at most this much brew water. */
  maxMl?: number;
}

/**
 * Every capacity-limited vessel's brew-water window (ml ≈ g). Owner-measured
 * from his real kit. Brewers not requiring a bound omit it. `match` is tested
 * against a lowercased method string OR a BrewerType id (both contain the
 * vessel keyword), so "V60 + Drip Assist", "orea-classic" and "Origami (cone)"
 * all resolve. Order is first-match; no two patterns overlap.
 */
export const VESSEL_CAPS: Array<{ match: RegExp } & VesselCap> = [
  { match: /aeropress/, label: "AeroPress", maxMl: 230 },
  { match: /clever/, label: "Clever", maxMl: 450 },
  { match: /origami/, label: "Origami", maxMl: 500 },
  { match: /moccamaster/, label: "Moccamaster", minMl: 500, maxMl: 1000 },
  { match: /chemex/, label: "Chemex", minMl: 350, maxMl: 750 },
  { match: /kalita/, label: "Kalita Wave", maxMl: 450 },
  { match: /orea/, label: "Orea", maxMl: 450 },
  { match: /v60/, label: "V60", maxMl: 550 },
  { match: /jar|cold.?brew|pitcher/, label: "Cold-brew jar", maxMl: 1000 },
];

function vesselCap(method: string): VesselCap | null {
  const m = method.toLowerCase();
  for (const { match, label, minMl, maxMl } of VESSEL_CAPS) {
    if (match.test(m)) return { label, minMl, maxMl };
  }
  return null;
}

/**
 * Returns a human-readable reason if `waterGrams` doesn't fit `method`'s vessel
 * window — the recipe pours more than the vessel holds, or less than a batch
 * brewer's floor — or null if it's fine (or the method has no bound). 1g ≈ 1ml.
 */
export function vesselOverflow(
  method: string | undefined,
  waterGrams: number | undefined,
): string | null {
  if (!method || typeof waterGrams !== "number" || !Number.isFinite(waterGrams)) return null;
  const cap = vesselCap(method);
  if (!cap) return null;
  if (cap.maxMl != null && waterGrams > cap.maxMl) {
    return `${cap.label} holds ≤${cap.maxMl}ml, recipe pours ${waterGrams}g`;
  }
  if (cap.minMl != null && waterGrams < cap.minMl) {
    return `${cap.label} is batch-only (≥${cap.minMl}ml), recipe pours ${waterGrams}g`;
  }
  return null;
}

/**
 * Returns a human-readable reason if `method`'s vessel can't serve `targetMl` of
 * brew — the target is above the vessel's max (the user asked for more than it
 * holds) or below a batch brewer's min (a small pour on a Moccamaster) — or null
 * if it fits (or the method has no bound). This is the selector's hard filter.
 *
 * The max direction catches a candidate that clamped its water down to fit a
 * too-small vessel (a 180ml AeroPress when the user typed 450ml), which
 * vesselOverflow can't see because 180 < 230. The min direction keeps a
 * batch-only brewer out of a single-cup menu. 1ml ≈ 1g.
 *
 * Also accepts a BrewerType id ("aeropress", "origami-cone", "orea-classic") —
 * those contain the vessel keyword, so the same regex matches.
 */
export function vesselCannotServe(
  method: string | undefined,
  targetMl: number | undefined,
): string | null {
  if (!method || typeof targetMl !== "number" || !Number.isFinite(targetMl)) return null;
  const cap = vesselCap(method);
  if (!cap) return null;
  if (cap.maxMl != null && targetMl > cap.maxMl) {
    return `${cap.label} holds ≤${cap.maxMl}ml but you asked for ${targetMl}ml`;
  }
  if (cap.minMl != null && targetMl < cap.minMl) {
    return `${cap.label} needs ≥${cap.minMl}ml but you asked for ${targetMl}ml`;
  }
  return null;
}
