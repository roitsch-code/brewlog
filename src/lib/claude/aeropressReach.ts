import type { RecommendationCandidate } from "../types/session";

/**
 * The AeroPress past its chamber (owner, 2026-11-15): a candidate on it is kept
 * only when it adapts one of the concentrate + bypass recipes the menu offered
 * for this amount (a published cup within ±20 %, menu.ts concentrateServes),
 * or the recipe the owner named himself. Anything else is a recipe sized up
 * from nothing and is dropped. Never returns empty — if every candidate is
 * such a one (an AeroPress locked at a size it cannot serve), they are kept
 * and logged loudly rather than failing the recommendation.
 */
export function guardAeropressReach(
  candidates: RecommendationCandidate[],
  allowedIds: ReadonlySet<string> | null,
  resolveId: (basedOn: string | undefined) => string | undefined,
  requestedId?: string,
): RecommendationCandidate[] {
  if (!allowedIds) return candidates;
  const safe = candidates.filter((c) => {
    if (!/aeropress/i.test(c.method ?? "")) return true;
    const id = resolveId(c.basedOn);
    if (id && (allowedIds.has(id) || id === requestedId)) return true;
    console.warn(
      `[recommend] aeropress reach: dropped "${c.title}" — basedOn "${c.basedOn ?? "none"}" is not a documented concentrate + bypass recipe for this amount`,
    );
    return false;
  });
  if (!safe.length) console.warn("[recommend] aeropress reach: every candidate failed — kept them; the AeroPress cannot serve this amount");
  return safe.length ? safe : candidates;
}
