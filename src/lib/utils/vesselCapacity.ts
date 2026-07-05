// Deterministic vessel-capacity backstops for /recommend candidates.
//
// The /recommend prompt already forbids the wrong vessel for the requested
// volume, but the Mistral spike (issue #453, docs/recommend-spike-run3.md)
// showed a model can still pick one — it honours buried negatives less
// reliably than Opus did. These pure checks are the server-side guards
// recommend.ts applies after generation.
//
// Two directions are covered:
//   - vesselOverflow          — vessel too SMALL for the water it POURS (the
//                               520ml-in-a-Clever spike failure). Compares
//                               recipe.waterGrams against the cap, so an iced
//                               recipe (waterGrams = hot portion only) isn't
//                               falsely flagged.
//   - vesselTooSmallForTarget — vessel that physically can't SERVE the volume
//                               the user asked for (the "450ml request → 180ml
//                               AeroPress" bug, where the model clamped the
//                               water down to fit a too-small vessel — invisible
//                               to vesselOverflow because 180 < 230).

/**
 * Single source of truth for each capacity-limited vessel's max brew water
 * (ml ≈ g). Brewers not listed (V60, Orea, Kalita, Chemex, cold-brew jar) have
 * no hard upper limit — they scale with filter size and pour count. The
 * Moccamaster is batch-only and handled separately (it has a MINIMUM, not a
 * maximum). Order matters only for the human-readable label.
 */
const VESSEL_MAX_ML: Array<{ match: RegExp; label: string; maxMl: number }> = [
  { match: /aeropress/, label: "AeroPress", maxMl: 230 },
  { match: /clever/, label: "Clever", maxMl: 450 },
  { match: /origami/, label: "Origami Air M", maxMl: 450 },
];

function vesselCap(method: string): { label: string; maxMl: number } | null {
  const m = method.toLowerCase();
  for (const { match, label, maxMl } of VESSEL_MAX_ML) {
    if (match.test(m)) return { label, maxMl };
  }
  return null;
}

/**
 * Returns a human-readable reason if `waterGrams` doesn't fit `method`'s vessel,
 * or null if it's fine (or the method has no hard capacity limit). 1g ≈ 1ml.
 */
export function vesselOverflow(
  method: string | undefined,
  waterGrams: number | undefined,
): string | null {
  if (!method || typeof waterGrams !== "number" || !Number.isFinite(waterGrams)) return null;
  const cap = vesselCap(method);
  if (cap && waterGrams > cap.maxMl) {
    return `${cap.label} holds ≤${cap.maxMl}ml, recipe pours ${waterGrams}g`;
  }
  if (/moccamaster/.test(method.toLowerCase()) && waterGrams < 500) {
    return `Moccamaster is batch-only (≥500ml), recipe pours ${waterGrams}g`;
  }
  return null;
}

/**
 * Returns a human-readable reason if `method`'s vessel physically can't serve
 * `targetMl` of brew — i.e. the user asked for more than the vessel holds — or
 * null if it fits (or the method has no hard limit). This is the UNDER-delivery
 * counterpart to vesselOverflow: it catches a candidate that clamped its water
 * down to fit a too-small vessel (e.g. a 180ml AeroPress when the user typed
 * 450ml), which vesselOverflow can't see because 180 < 230. 1ml ≈ 1g.
 *
 * Also accepts a BrewerType id ("aeropress", "aeropress-prismo", "origami-cone",
 * "clever") — those contain the vessel keyword, so the same regex matches.
 */
export function vesselTooSmallForTarget(
  method: string | undefined,
  targetMl: number | undefined,
): string | null {
  if (!method || typeof targetMl !== "number" || !Number.isFinite(targetMl)) return null;
  const cap = vesselCap(method);
  if (cap && targetMl > cap.maxMl) {
    return `${cap.label} holds ≤${cap.maxMl}ml but you asked for ${targetMl}ml`;
  }
  return null;
}
