/**
 * Deterministic agitation backstop for `/recommend` — a sibling of
 * `dripAssist.ts` and `vesselCapacity.ts` (pure, SDK-free, unit-tested).
 *
 * Minimal-agitation brewers (Origami / Chemex / Moccamaster, Orea Apex/Open) are
 * brewed with NO stirring or swirling in the house style (the owner's silky /
 * floral taste). The `/recommend` prompt already carves them out ("include NO
 * agitation steps beyond what the recipe calls for — never add a trailing swirl
 * such a recipe doesn't want"), but Mistral leaks that buried negative where
 * Opus held — this is the code net. It kills two reported pathologies on an
 * Origami-wave at once: a settle swirl the flat-bottom brew never wanted, AND a
 * swirl sequenced AFTER the drawdown.
 */
import type { BrewStepAction, RecommendationCandidate } from "../types/session";

/** Flat-bottom / low-turbulence brewers the house brews with minimal agitation.
 * Orea Fast/Classic are turbulent by design and deliberately NOT included. */
export function isMinimalAgitationMethod(method?: string): boolean {
  if (!method) return false;
  const m = method.toLowerCase();
  if (/origami|chemex|moccamaster/.test(m)) return true;
  return /orea/.test(m) && /(apex|open)/.test(m);
}

const AGITATION = new Set<BrewStepAction>(["swirl", "stir", "agitate-bed"]);

/**
 * Strip model-added swirl/stir/agitate-bed steps from a minimal-agitation
 * brewer's `pourSteps`. The pour milestones (bloom/pour/final) are untouched, so
 * `waterGrams` and the `pourSequence` string stay exactly consistent — only the
 * agitation cues are removed. No-op for turbulent brewers (V60 / Orea Fast /
 * Kalita) and for candidates that already carry no agitation.
 */
export function stripMinimalAgitationSwirls(
  candidates: RecommendationCandidate[],
): RecommendationCandidate[] {
  return candidates.map((c) => {
    if (!isMinimalAgitationMethod(c.method)) return c;
    const steps = c.recipe?.pourSteps;
    if (!steps || steps.length === 0) return c;
    const kept = steps.filter((s) => !AGITATION.has(s.action));
    if (kept.length === steps.length) return c;
    console.warn(
      `[recommend] agitation guard: dropped ${steps.length - kept.length} swirl/stir step(s) from minimal-agitation "${c.title}" (${c.method})`,
    );
    return { ...c, recipe: { ...c.recipe, pourSteps: kept } };
  });
}
