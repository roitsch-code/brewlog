/**
 * Deterministic agitation backstop for `/recommend` — a sibling of
 * `dripAssist.ts` and `vesselCapacity.ts` (pure, SDK-free, unit-tested).
 *
 * Minimal-agitation brewers (Origami / Chemex / Moccamaster, Orea Apex/Open)
 * must not carry agitation the MODEL invented — the reported defect was a
 * settle swirl on an Origami-wave that never had one, sequenced AFTER the
 * drawdown. But the agitation a published recipe carries stays: since
 * 2026-09-30 the guard judges each stir/swirl by its position against the
 * `basedOn` reference instead of deleting all of them (owner decision: recipe
 * fidelity over a blanket house style). See `stripMinimalAgitationSwirls`.
 */
import type { RecommendationCandidate } from "../types/session";

/** Flat-bottom / low-turbulence brewers the house brews with minimal agitation.
 * Orea Fast/Classic are turbulent by design and deliberately NOT included. */
export function isMinimalAgitationMethod(method?: string): boolean {
  if (!method) return false;
  const m = method.toLowerCase();
  if (/origami|chemex|moccamaster/.test(m)) return true;
  return /orea/.test(m) && /(apex|open)/.test(m);
}

const AGITATION = new Set<string>(["swirl", "stir", "agitate-bed"]);
/** Steps that add water to the brewer. Candidate steps use bloom/pour/final;
 * corpus steps use "pour" for all of them. */
const WATER = new Set<string>(["bloom", "pour", "final"]);

/** Where in the brew an agitation step sits. Recipe fidelity is judged by
 * position, not by label, because the model relabels freely. */
export type AgitationPhase = "bloom" | "mid" | "post-final" | "after-drawdown";

type StepLike = { action: string; durationSec?: number };

/** Classify every agitation step of a sequence by its position relative to the
 * water steps: right after the bloom, between later pours, right after the
 * final pour, or after the drawdown (a drain, or a rest of 30 s or more, has
 * already happened since the last pour — e.g. a serving swirl of the carafe). */
export function agitationPhases(steps: ReadonlyArray<StepLike>): Array<AgitationPhase | null> {
  const waterIdx = steps.map((s, i) => (WATER.has(s.action) ? i : -1)).filter((i) => i >= 0);
  const total = waterIdx.length;
  const lastWater = total ? waterIdx[total - 1] : -1;
  return steps.map((s, i) => {
    if (!AGITATION.has(s.action)) return null;
    const before = waterIdx.filter((w) => w < i).length;
    if (total > 0 && before === total) {
      const drained = steps
        .slice(lastWater + 1, i)
        .some((x) => x.action === "drain" || (x.action === "wait" && (x.durationSec ?? 0) >= 30));
      if (drained) return "after-drawdown";
      return before <= 1 ? "bloom" : "post-final";
    }
    return before <= 1 ? "bloom" : "mid";
  });
}

/** The published recipe a candidate is `basedOn`, as far as this guard needs it. */
export type AgitationReference = { pourSequence: ReadonlyArray<StepLike> } | null;

/**
 * Remove the agitation a MODEL added to a minimal-agitation brewer's recipe —
 * never the agitation the recipe it adapts was published with.
 *
 * Until 2026-09-30 this dropped EVERY stir/swirl on these brewers. That also
 * deleted the bloom stir the /recommend prompt itself requires on Origami and
 * Orea Apex, and rewrote the published agitation of 12 of the 36 corpus recipes
 * on these brewers (Hoffmann Chemex, Hedrick Origami, three verified
 * Moccamaster recipes) — the owner's rule is that recipes are not falsified.
 *
 * Now an agitation step stays when its POSITION (see `agitationPhases`) also
 * occurs in the `basedOn` reference. Without a resolvable reference (an Own
 * experiment, or a name the corpus doesn't know) only bloom agitation stays.
 * The reported defect this guard exists for — a settle swirl sequenced after
 * the drawdown on an Origami-wave that never had one — is still removed.
 * Pour milestones are never touched, so waterGrams stays consistent.
 */
export function stripMinimalAgitationSwirls(
  candidates: RecommendationCandidate[],
  resolveRef: (basedOn: string | undefined) => AgitationReference = () => null,
): RecommendationCandidate[] {
  return candidates.map((c) => {
    if (!isMinimalAgitationMethod(c.method)) return c;
    const steps = c.recipe?.pourSteps;
    if (!steps || steps.length === 0) return c;
    const ref = resolveRef(c.basedOn);
    const allowed = new Set<AgitationPhase>(
      ref ? agitationPhases(ref.pourSequence).filter((p): p is AgitationPhase => p !== null) : ["bloom"],
    );
    const phases = agitationPhases(steps);
    const kept = steps.filter((_, i) => phases[i] === null || allowed.has(phases[i] as AgitationPhase));
    if (kept.length === steps.length) return c;
    console.warn(
      `[recommend] agitation guard: dropped ${steps.length - kept.length} agitation step(s) the ${
        ref ? `reference "${c.basedOn}"` : "recipe"
      } doesn't have, from "${c.title}" (${c.method})`,
    );
    return { ...c, recipe: { ...c.recipe, pourSteps: kept } };
  });
}
