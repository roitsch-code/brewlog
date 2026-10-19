/**
 * The candidate he did NOT brew last time (2026-10-19, "Immer wieder Neues").
 *
 * Every recommendation carries two candidates and he brews one; the other was
 * written for the same bag, the same amount, the same day, and then thrown
 * away with the screen. This picks it back out of the previous home brew of a
 * coffee so a "Try the one you skipped" pill can start it straight on the
 * timer — the recipe as it was composed, timeline included, nothing
 * regenerated. Pure; the previous-brew route serialises it.
 */
import type { BrewRecipe, RecommendationCandidate, Session } from "../types/session";

export interface SkippedCandidate {
  /** The session it was offered in. */
  sessionId: string;
  createdAt: string;
  method: string;
  title?: string;
  basedOn?: string;
  recipe: BrewRecipe;
}

/** The candidate of `session` that was offered beside the brewed one, or null. */
export function skippedCandidateOf(session: Session): SkippedCandidate | null {
  const candidates = session.recommendation?.candidates;
  if (!Array.isArray(candidates) || candidates.length < 2) return null;
  const idx = session.brew?.selectedCandidateIdx;
  let brewedIdx: number;
  if (typeof idx === "number" && idx >= 0 && idx < candidates.length) brewedIdx = idx;
  else {
    const used = session.brew?.methodUsed;
    const byMethod = used ? candidates.findIndex((c) => c.method === used) : -1;
    if (byMethod < 0) return null;
    brewedIdx = byMethod;
  }
  const other: RecommendationCandidate | undefined = candidates.find((_, i) => i !== brewedIdx);
  if (!other?.recipe || typeof other.recipe.waterGrams !== "number" || typeof other.recipe.doseGrams !== "number") return null;
  if (!Array.isArray(other.recipe.pourSteps) || other.recipe.pourSteps.length === 0) return null;
  return {
    sessionId: session.id,
    createdAt: session.createdAt,
    method: other.method,
    ...(other.title ? { title: other.title } : {}),
    ...(other.basedOn ? { basedOn: other.basedOn } : {}),
    recipe: other.recipe,
  };
}
