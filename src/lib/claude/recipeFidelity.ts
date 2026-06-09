/**
 * Recipe-fidelity backstop — deterministic guard that runs AFTER the model
 * returns its candidates, before they reach the user.
 *
 * The problem it solves (PR #265 + this follow-up): when /recommend adapts a
 * published reference recipe to the user's batch, the model is supposed to
 * scale ONLY the gram amounts and keep the recipe's signature (grind, pour
 * cadence, temperature, total time). It doesn't always obey — the documented
 * failure was Kasuya's Super Coarse 10-Pour (20g:300g, super-coarse, ~3:30)
 * coming back as 23g:350g at a normal 412° grind with a 4:45 total: the grind
 * that DEFINES the recipe was dropped and the brew time nearly doubled for a
 * 50ml batch bump. The prompt (#265) asks the model not to do this; THIS guard
 * catches it mechanically when the model ignores the prompt.
 *
 * Behaviour: for a candidate whose `basedOn` resolves to a VERIFIED corpus
 * recipe, compute what the published recipe looks like scaled to the
 * candidate's batch, and if the candidate's total time, grind, or temperature
 * has drifted beyond a generous tolerance, REPLACE the candidate's mechanical
 * signature (time / grind / temp / pour steps) with the faithful scaled
 * reference. The candidate keeps the user's dose+water and all of its prose
 * (whyChosen, hypothesis, …) — only the numbers that must match the published
 * recipe are snapped back.
 *
 * Scope guards (kept deliberately narrow so legitimate adaptations pass
 * untouched):
 *   - only VERIFIED references (unverified ones have reconstructed pour
 *     sequences we don't want to snap to);
 *   - only a "simple scale" (0.5×–2.5× the reference water) — a wildly
 *     different batch isn't really the same recipe scaled;
 *   - skipped entirely for iced/bypass recipes, where waterGrams and the
 *     reference's water basis (hot vs hot+ice) differ and naive scaling
 *     would mis-map the milestones.
 */

import type { BrewRecipe, BrewPourStep, BrewStepAction } from "../types/session";
import type { Recipe } from "../knowledge/recipes";
import { ALL_RECIPES } from "../knowledge/recipes";

export interface FidelityResult {
  recipe: BrewRecipe;
  /** True when the guard rewrote the recipe's mechanics. */
  changed: boolean;
  /** Human-readable drift reasons (for logging), empty when unchanged. */
  reasons: string[];
  /** The reference recipe name that was snapped to, when changed. */
  reference?: string;
}

/** Pour-type steps that add water to the bed (so their cumulative milestone is
 * part of the brew-water total). bypass/drain/press/stir/etc. are excluded:
 * bypass water is dilution counted separately, and the rest move no new water. */
const WATER_POUR_ACTIONS = new Set<BrewStepAction>(["bloom", "pour", "final", "melodrip"]);

/**
 * Internal-consistency guard — runs on EVERY recipe, independent of any
 * reference match.
 *
 * The model sometimes fills the headline `waterGrams` with a reference recipe's
 * published number while writing the actually-adapted recipe into `pourSteps`
 * (and the prose). The reported case: the card header read 225g while the pour
 * plan poured "to 230g" and the rationale described 1:15.3 — the same recipe
 * showing two different water totals, and the recommend grid disagreeing with
 * the brew screen. The pour plan is the operative truth: it's what the timer
 * advances through and what the user actually pours to. So snap `waterGrams`
 * to the final water-into-bed milestone whenever they diverge.
 *
 * Only acts when the pour plan is COMPLETE (the last water-adding pour carries a
 * cumulative milestone) so a half-specified `pourSteps` can never drag the
 * headline down to a mid-brew number. Counts bloom/pour/final/melodrip only —
 * bypass (dilution) and drain steps are excluded, so concentrate-and-bypass
 * recipes (waterGrams = brew water) and iced recipes (waterGrams = hot water)
 * keep their correct, intentionally-smaller headline.
 */
export function reconcileWaterToPourPlan(recipe: BrewRecipe): BrewRecipe {
  const steps = recipe.pourSteps;
  if (!Array.isArray(steps) || steps.length === 0) return recipe;

  const pours = steps.filter((s) => WATER_POUR_ACTIONS.has(s.action));
  const lastPour = pours[pours.length - 1];
  // Require a complete plan: the final water-adding pour must declare its
  // cumulative milestone, otherwise we don't trust it as the brew-water total.
  if (!lastPour || typeof lastPour.waterGramsAtEnd !== "number") return recipe;

  const planned = Math.max(
    ...pours.map((s) => (typeof s.waterGramsAtEnd === "number" ? s.waterGramsAtEnd : 0)),
  );
  if (planned > 0 && typeof recipe.waterGrams === "number" && planned !== recipe.waterGrams) {
    return { ...recipe, waterGrams: planned };
  }
  return recipe;
}

/** Normalise a name for fuzzy matching — lowercase, punctuation → spaces. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Resolve a candidate's `basedOn` string to a corpus recipe. Matches by full
 * name or shortName, exact-first then containment, and requires a reasonably
 * specific overlap so a vague "V60" doesn't bind to an arbitrary recipe.
 * Prefers a verified recipe when two match equally well.
 */
export function resolveReference(basedOn: string | undefined): Recipe | null {
  if (!basedOn) return null;
  const q = norm(basedOn);
  if (!q || q === "own recipe") return null;

  let best: Recipe | null = null;
  let bestScore = 0;
  for (const r of ALL_RECIPES) {
    for (const name of [norm(r.name), norm(r.shortName)]) {
      if (!name) continue;
      let score = 0;
      if (name === q) score = 1000;
      else if (name.includes(q) || q.includes(name)) score = Math.min(name.length, q.length);
      // Tie-break toward verified recipes.
      if (score > 0 && r.verified) score += 0.5;
      if (score > bestScore) {
        bestScore = score;
        best = r;
      }
    }
  }
  // Require a meaningful overlap (≥6 chars or an exact hit) to avoid binding
  // a short query to an unrelated recipe.
  return bestScore >= 6 ? best : null;
}

function refGrindRange(r: Recipe): [number, number] | null {
  const nz = r.grind?.nicheZeroDegrees;
  if (nz == null) return null;
  return Array.isArray(nz) ? [nz[0], nz[1]] : [nz, nz];
}

function refTemp(r: Recipe): number | null {
  const t = r.temperature;
  if (typeof t.celsius === "number") return t.celsius;
  if (Array.isArray(t.rangeC)) return t.rangeC[1];
  return null;
}

/** Pull the leading Niche-degree number out of a free-text grind string. */
function parseGrindDegrees(grindSize: string | undefined): number | null {
  if (!grindSize) return null;
  const m = /(\d{2,3}(?:\.\d+)?)/.exec(grindSize);
  return m ? Number(m[1]) : null;
}

/** A recipe that brews onto ice / uses bypass dilution — different water basis. */
function hasIceOrBypass(ref: Recipe): boolean {
  const ratio = (ref.water?.ratio || "").toLowerCase();
  if (ratio.includes("ice") || ratio.includes("bypass")) return true;
  return ref.pourSequence?.some((s) => s.action === "bypass") ?? false;
}

/** Scale the reference's structured pour sequence to the candidate's batch.
 * Milestones scale by the water ratio; durations (the cadence) are preserved
 * verbatim; per-step temperatures are dropped (single-temperature rule). */
function scalePourSteps(ref: Recipe, k: number): BrewPourStep[] {
  return ref.pourSequence.map((s) => {
    const step: BrewPourStep = {
      label: s.label,
      action: s.action as BrewStepAction,
    };
    if (typeof s.waterGramsAtEnd === "number") step.waterGramsAtEnd = Math.round(s.waterGramsAtEnd * k);
    if (typeof s.durationSec === "number") step.durationSec = s.durationSec;
    if (s.notes) step.notes = s.notes;
    return step;
  });
}

/** Cumulative-grams milestone string (" – "-joined) for the legacy renderer. */
function cumulativeGramsString(steps: BrewPourStep[]): string {
  return steps
    .filter((s) => typeof s.waterGramsAtEnd === "number")
    .map((s) => s.waterGramsAtEnd)
    .join(" – ");
}

/** The published grind, scaling-adjusted to the candidate's dose (a bigger
 * bed legitimately runs a touch coarser — ~+20°/doubling per grind-settings). */
function refGrindString(ref: Recipe, doseRatio: number): string {
  const range = refGrindRange(ref);
  if (!range) return ref.grind?.referenceSetting ?? ref.grind?.description ?? "";
  const adj = Math.round(20 * (doseRatio - 1));
  const mid = Math.round((range[0] + range[1]) / 2) + adj;
  return `${mid}°`;
}

/**
 * Core check: has the candidate drifted from the (scaled) published recipe on
 * total time, grind, or temperature beyond a generous tolerance?
 */
function driftReasons(recipe: BrewRecipe, ref: Recipe, k: number, doseRatio: number): string[] {
  const reasons: string[] = [];

  // Total time — published time barely moves for a small batch change. Allow a
  // floor of ±45s or ±20%, plus extra slack proportional to how much bigger
  // the batch is (a genuine 2× batch adds some drawdown).
  const refTime = ref.totalTimeSec;
  if (refTime > 0 && typeof recipe.targetTimeSec === "number") {
    const tol = Math.max(45, 0.2 * refTime) + (k > 1 ? (k - 1) * refTime * 0.3 : 0);
    if (Math.abs(recipe.targetTimeSec - refTime) > tol) {
      reasons.push(
        `total time ${recipe.targetTimeSec}s vs published ${refTime}s (±${Math.round(tol)}s allowed)`,
      );
    }
  }

  // Grind — window is the published range, shifted by the dose-scaling
  // adjustment, padded ±15° for normal brew-to-brew variation.
  const range = refGrindRange(ref);
  const cg = parseGrindDegrees(recipe.grindSize);
  if (range && cg != null) {
    const adj = 20 * (doseRatio - 1);
    const lo = range[0] + adj - 15;
    const hi = range[1] + adj + 15;
    if (cg < lo || cg > hi) {
      reasons.push(
        `grind ${cg}° vs published ${range[0]}–${range[1]}° (window ${Math.round(lo)}–${Math.round(hi)}°)`,
      );
    }
  }

  // Temperature — chemistry knob, shouldn't move much from the published value.
  const rt = refTemp(ref);
  if (rt != null && typeof recipe.waterTempC === "number" && Math.abs(recipe.waterTempC - rt) > 6) {
    reasons.push(`temp ${recipe.waterTempC}° vs published ${rt}°`);
  }

  return reasons;
}

/**
 * If the candidate claims to be based on a verified reference recipe but its
 * grind / total time / temperature has drifted too far from that recipe scaled
 * to the candidate's batch, snap its mechanical signature back to the faithful
 * scaled reference. Otherwise return the recipe untouched.
 */
export function reconcileToReference(recipe: BrewRecipe, basedOn: string | undefined): FidelityResult {
  const ref = resolveReference(basedOn);
  if (!ref || !ref.verified) return { recipe, changed: false, reasons: [] };

  // Iced / bypass references mix water bases (hot vs hot+ice / concentrate) —
  // naive milestone scaling would mis-map. Leave those to the prompt rule.
  if (hasIceOrBypass(ref) || (recipe.iceGrams != null && recipe.iceGrams > 0)) {
    return { recipe, changed: false, reasons: [] };
  }

  const refWater = ref.water?.grams ?? 0;
  const refDose = ref.dose?.grams ?? 0;
  const water = recipe.waterGrams;
  const dose = recipe.doseGrams;
  if (!(refWater > 0) || !(water > 0)) return { recipe, changed: false, reasons: [] };

  const k = water / refWater;
  // Only reconcile a genuine "same recipe, scaled" case.
  if (k < 0.5 || k > 2.5) return { recipe, changed: false, reasons: [] };
  const doseRatio = dose > 0 && refDose > 0 ? dose / refDose : k;

  const reasons = driftReasons(recipe, ref, k, doseRatio);
  if (reasons.length === 0) return { recipe, changed: false, reasons: [] };

  const steps = scalePourSteps(ref, k);
  const fixed: BrewRecipe = {
    ...recipe,
    waterTempC: refTemp(ref) ?? recipe.waterTempC,
    grindSize: refGrindString(ref, doseRatio),
    targetTimeSec: ref.totalTimeSec,
    pourSteps: steps,
    pourSequence: cumulativeGramsString(steps) || recipe.pourSequence,
  };
  return { recipe: fixed, changed: true, reasons, reference: ref.name };
}
