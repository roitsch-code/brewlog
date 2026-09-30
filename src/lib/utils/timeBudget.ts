/**
 * The "Special" time bucket — the flow's fast shot (`timeAvailable: "special"`,
 * legacy `"quick"`). The UI promises it and the /recommend prompt asks for
 * ≤150 s, but until 2026-09-30 nothing enforced it: the selector ignored
 * `timeAvailable` entirely and later guards could lift a candidate's clock past
 * it. Pure, SDK-free, shared by the recipe selector and the post-parse guard.
 */
import type { RecommendationCandidate } from "../types/session";

/** Hard ceiling for a Special brew: the prompt's 150 s target plus 20 %
 * tolerance, so a recipe scaled to a bigger batch still counts as fast. */
export const SPECIAL_MAX_SEC = 180;

export function isSpecialTime(timeAvailable?: string): boolean {
  const t = (timeAvailable ?? "").toLowerCase();
  return t === "special" || t === "quick";
}

/**
 * Drop candidates whose clock is over the Special ceiling on a Special brew.
 * Keeps everything when every candidate is over it (never leave the user with
 * nothing) and is a no-op for any other time bucket.
 */
export function guardSpecialTime(
  candidates: RecommendationCandidate[],
  timeAvailable?: string,
): RecommendationCandidate[] {
  if (!isSpecialTime(timeAvailable)) return candidates;
  const fast = candidates.filter((c) => (c.recipe?.targetTimeSec ?? 0) <= SPECIAL_MAX_SEC);
  if (!fast.length || fast.length === candidates.length) return candidates;
  for (const c of candidates) {
    if ((c.recipe?.targetTimeSec ?? 0) > SPECIAL_MAX_SEC) {
      console.warn(
        `[recommend] special-time: dropped "${c.title ?? c.method}" — ${c.recipe?.targetTimeSec}s is over the ${SPECIAL_MAX_SEC}s fast-shot ceiling`,
      );
    }
  }
  return fast;
}
