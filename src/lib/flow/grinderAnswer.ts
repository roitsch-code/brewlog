/**
 * The owner's one-tap answer to a candidate's grinder proposal (2026-10-19).
 *
 * Pure: takes the draft, returns the next draft (or null when there is
 * nothing to answer). Accept swaps the recipe's grind into the proposed
 * grinder's unit and sets the brew's grinder to it; decline swaps back and
 * restores the grinder the brew was set up with. Reversible any number of
 * times; nothing is regenerated. `recipe.grindSize` is what the brew screen
 * shows and the Log prefills, so the tap reaches the brew with no plumbing.
 */
import type { DraftSession, SessionContext } from "../types/session";

export function applyGrinderAnswer(draft: DraftSession, candidateIdx: number, accepted: boolean): DraftSession | null {
  const rec = draft.recommendation;
  const c = rec?.candidates?.[candidateIdx];
  const sug = c?.grinderSuggestion;
  if (!rec || !c || !sug) return null;
  const wasAccepted = Boolean(sug.accepted);
  if (wasAccepted === accepted) return null;
  const context = draft.context ?? ({} as SessionContext);
  // The two grind strings swap places; the suggestion always holds the one
  // NOT currently on the recipe, so the toggle is reversible.
  const swapped = { ...c, recipe: { ...c.recipe, grindSize: sug.grindSize } };
  const next = accepted
    ? { ...swapped, grinderSuggestion: { ...sug, grindSize: c.recipe.grindSize, accepted: true, previousGrinder: context.grinder ?? "" } }
    : { ...swapped, grinderSuggestion: { ...sug, grindSize: c.recipe.grindSize, accepted: false } };
  const candidates = rec.candidates.map((x, i) => (i === candidateIdx ? next : x));
  const grinder = accepted ? sug.grinder : sug.previousGrinder ?? "";
  return {
    ...draft,
    recommendation: {
      ...rec,
      candidates,
      ...(candidateIdx === 0 ? { primaryRecipe: next.recipe } : {}),
      ...(candidateIdx === 1 ? { alternativeRecipe: next.recipe } : {}),
    },
    context: { ...context, grinder },
  };
}
