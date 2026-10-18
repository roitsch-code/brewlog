/**
 * Chemex grind floor (2026-10-18). Owner report: a 750 ml Chemex at 400° Niche
 * drained far too long. Nothing in the engine ever moved the batch-blind Chemex
 * estimate with the batch (see CHEMEX in grindSettings.ts), and the large-batch
 * branch of the fidelity guard is unreachable for in-window references.
 *
 * A deliberate, narrow exception to "no hard grind validators": Chemex only,
 * and only a FLOOR — a Chemex candidate ground finer than chemexNicheFloor(its
 * water) is lifted to it. Anything coarser is left alone. Revert this module's
 * call in recommend.ts to undo it.
 */
import type { RecommendationCandidate } from "../types/session";
import { brewersFromMethod } from "../knowledge/recipes/helpers";
import { chemexNicheFloor } from "../constants/grindSettings";
import { parseGrindDegrees, resolveReference } from "../claude/recipeFidelity";

/** A VERIFIED reference that itself sits below the floor at its own batch
 * (Coava's medium-fine Chemex) keeps its own grind — a verified recipe is never
 * bent to fit a house rule. Everything else (own experiments, the batch-blind
 * estimated entries) gets the floor. */
function isVerifiedFinerReference(basedOn: string | undefined): boolean {
  const ref = resolveReference(basedOn);
  const range = ref?.grind?.nicheZeroDegrees;
  if (!ref?.verified || !Array.isArray(range) || !(ref.water?.grams > 0)) return false;
  return range[1] < chemexNicheFloor(ref.water.grams);
}

export function isChemexMethod(method: string | undefined): boolean {
  return brewersFromMethod(method).has("chemex");
}

export function guardChemexGrindFloor(
  candidates: RecommendationCandidate[],
): { candidates: RecommendationCandidate[]; changes: string[] } {
  const changes: string[] = [];
  const out = candidates.map((c) => {
    if (!isChemexMethod(c.method) || isVerifiedFinerReference(c.basedOn)) return c;
    const water = c.recipe.waterGrams;
    const g = parseGrindDegrees(c.recipe.grindSize);
    if (!(water > 0) || g === null) return c;
    const floor = chemexNicheFloor(water);
    if (g >= floor) return c;
    changes.push(`"${c.title ?? c.method}" ${c.recipe.grindSize} → ${floor}° (Chemex floor at ${Math.round(water)} g)`);
    return { ...c, recipe: { ...c.recipe, grindSize: `${floor}°` } };
  });
  return { candidates: out, changes };
}
