/**
 * How far from its PUBLISHED water a reference recipe may be adapted: ±20 %.
 *
 * Owner decision, 2026-10-10 ("It is called 1 cup recipe. Don't scale this
 * one. There is a 2-cup recipe from Hoffmann as well. Use that."): a recipe
 * published for one batch is not the same recipe at 1.5× — the author pours
 * differently at that size when they publish one at all (Hoffmann's 15 : 250
 * is four 50 g pulses; his 30 : 500 is two big pours). The menu has excluded
 * recipes MORE than 20 % above the batch since #480; this is that window,
 * applied in BOTH directions and in every place a reference is adapted: the
 * menu (helpers.ts), the scaled line, the fidelity snap and the pour-time copy
 * (recipeFidelity.ts, pourDurations.ts), the chat's drift check
 * (validateRecipe.ts). Outside it the reference does not apply at all — the
 * app picks the author's recipe for that size, or another one.
 *
 * Lives in its own module because helpers.ts (the menu) and recipeFidelity.ts
 * (the guards) sit on opposite sides of an import cycle.
 */
export const REFERENCE_BATCH_WINDOW = 0.2;

/** Water within ±20 % of the published water? Both sides exclusive of nothing. */
export function batchWithinWindow(publishedWaterGrams: number, waterGrams: number): boolean {
  if (!(publishedWaterGrams > 0) || !(waterGrams > 0)) return false;
  const k = waterGrams / publishedWaterGrams;
  return k >= 1 - REFERENCE_BATCH_WINDOW - 1e-9 && k <= 1 + REFERENCE_BATCH_WINDOW + 1e-9;
}
