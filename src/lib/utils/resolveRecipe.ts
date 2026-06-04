import type { Session, BrewRecipe, RecommendationCandidate } from "@/lib/types/session";

export interface ResolvedBrew {
  /** The recipe the user actually brewed (selected candidate, not primary). */
  recipe?: BrewRecipe;
  /** The selected candidate — carries title / basedOn / role / whyChosen. */
  candidate?: RecommendationCandidate;
  /** Brewer used. */
  method: string;
}

/**
 * Resolve the recipe a session ACTUALLY brewed — the candidate at
 * `brew.selectedCandidateIdx`, NOT `recommendation.primaryRecipe`.
 *
 * Two candidates can share a method, so matching by method name (the old
 * shortcut) returns the wrong one — the exact bug PR #193 fixed in the brew UI.
 * Reading `primaryRecipe` instead of the selected candidate is what made the
 * chat report a wrong grind (398° vs the 405° actually brewed). Use this single
 * helper everywhere a session's brewed recipe / numbers / name are read (chat
 * history, offline cache, detail pages) so the bug can't reappear per-call.
 */
export function resolveBrewedRecipe(session: Session): ResolvedBrew {
  const rec = session.recommendation;
  const idx = session.brew?.selectedCandidateIdx;
  const candidate =
    (idx != null ? rec?.candidates?.[idx] : undefined) ??
    (session.brew?.methodUsed
      ? rec?.candidates?.find((c) => c.method === session.brew?.methodUsed)
      : undefined);
  const recipe = candidate?.recipe ?? rec?.primaryRecipe;
  const method = candidate?.method || session.brew?.methodUsed || rec?.primaryMethod || "Brew";
  return { recipe, candidate, method };
}

/** The reference recipe to surface as a "based on …" subtitle, or undefined when
 * there's nothing worth showing: no reference, the "Own recipe" placeholder, or a
 * value that just repeats the title. Single source of truth for the sentinel. */
export function basedOnReference(basedOn?: string, title?: string): string | undefined {
  const ref = basedOn?.trim();
  if (!ref) return undefined;
  if (ref.toLowerCase() === "own recipe") return undefined;
  if (title && ref.toLowerCase() === title.trim().toLowerCase()) return undefined;
  return ref;
}

/** The display name for a brewed recipe: the AI title, with the stable
 * reference appended when present ("Reduced agitation Orea — based on April 1-2-3"). */
export function brewedRecipeName(candidate?: RecommendationCandidate): string | undefined {
  if (!candidate) return undefined;
  const title = candidate.title?.trim();
  const ref = basedOnReference(candidate.basedOn, candidate.title);
  if (title && ref) return `${title} (based on ${ref})`;
  return title || candidate.basedOn?.trim() || undefined;
}
