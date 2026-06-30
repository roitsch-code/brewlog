// Deterministic vessel-capacity backstop for /recommend candidates.
//
// The /recommend prompt already forbids over-capacity vessels for the requested
// volume, but the Mistral spike (issue #453, docs/recommend-spike-run3.md) showed
// a model can still occasionally pick one at large volumes (e.g. a Clever or
// Origami for a 520ml brew). This pure check is the server-side guard recommend.ts
// applies after generation.
//
// It compares the WATER THE BREWER ACTUALLY HOLDS (recipe.waterGrams ≈ ml) against
// each brewer's limit — NOT the drink volume — so an iced recipe (where waterGrams
// is only the hot portion poured into the vessel) is correctly NOT flagged.

/**
 * Returns a human-readable reason if `waterGrams` doesn't fit `method`'s vessel,
 * or null if it's fine (or the method has no hard capacity limit). 1g ≈ 1ml.
 */
export function vesselOverflow(
  method: string | undefined,
  waterGrams: number | undefined,
): string | null {
  if (!method || typeof waterGrams !== "number" || !Number.isFinite(waterGrams)) return null;
  const m = method.toLowerCase();
  if (/aeropress/.test(m) && waterGrams > 230) return `AeroPress holds ≤230ml, recipe pours ${waterGrams}g`;
  if (/clever/.test(m) && waterGrams > 450) return `Clever holds ≤450ml, recipe pours ${waterGrams}g`;
  if (/origami/.test(m) && waterGrams > 450) return `Origami Air M tops out ~450ml, recipe pours ${waterGrams}g`;
  if (/moccamaster/.test(m) && waterGrams < 500) return `Moccamaster is batch-only (≥500ml), recipe pours ${waterGrams}g`;
  return null;
}
