/**
 * Canonical brew timeline — the SINGLE "intended flow" for a recipe.
 *
 * Before this module the intended flow was split in two: percolation
 * (`PourStep[]`, cumulative-grams) vs immersion (`GuideStep[]`, action-driven),
 * derived inline in LightStepBrew with the active-step logic duplicated. That
 * made "compare the live pour to the plan" impossible — there was no one thing
 * to compare against.
 *
 * `buildBrewTimeline` is a NORMALIZE LAYER over the existing, tested builders in
 * `pourSequence.ts` (`buildGuideSteps` / `pourStepsFromStructured` / `parsePourSteps`).
 * It does NOT re-implement any timing math — it calls them and lowers their
 * output into one shape. It returns BOTH:
 *   - the renderer-ready `pourSteps`/`guideSteps`/`proseSequence` (the existing
 *     types, byte-identical to what the two brew renderers always consumed), and
 *   - a normalized `steps: TimelineStep[]` + `expectedGramsAt` + `activeStepAt`,
 *     the canonical model the flow coach (live pour comparison) builds on.
 *
 * The selection logic mirrors LightStepBrew's old inline block exactly; the
 * golden-equivalence test (tests/dataflow/brew-timeline.test.mjs) locks that the
 * renderer arrays and the cue boundaries are unchanged across the recipe corpus.
 */
import type { BrewRecipe, BrewStepAction } from "@/lib/types/session";
import {
  buildGuideSteps,
  hasImmersionShape,
  isAgitationPourAction,
  parsePourSteps,
  pourDurationSec,
  pourStepsFromStructured,
  type AgitationAction,
  type GuideStep,
  type PourStep,
} from "@/lib/utils/pourSequence";

export type BrewMethodShape = "percolation" | "immersion" | "prose";

/** One normalized step on the canonical timeline. Carries everything the flow
 * coach needs without caring which renderer the brew uses. */
export interface TimelineStep {
  index: number;
  label: string;
  action: BrewStepAction | AgitationAction;
  /** Seconds since brew start when this step begins. */
  startSec: number;
  /** Seconds since brew start when this step ends (next step's start, or
   * targetTimeSec for the last percolation step; start+duration for immersion). */
  endSec: number;
  /** Cumulative water in the brewer at the end of this step, when known. */
  targetCumulativeGrams?: number;
  /** Water added by THIS step (percolation pours only). */
  pourGrams?: number;
  /** Pre-brew handling (immersion invert/load/assemble) — excluded from `steps`. */
  isSetup: boolean;
  /** Swirl / stir / tap / agitate-bed. */
  isAgitation: boolean;
  temperatureC?: number;
  notes?: string;
}

export interface BrewTimeline {
  shape: BrewMethodShape;
  // ── Renderer-ready arrays (existing types, unchanged) ──
  pourSteps: PourStep[] | null;
  guideSteps: GuideStep[] | null;
  proseSequence: string | null;
  // ── Canonical normalized model ──
  /** Timeline-ordered steps with setup excluded. The single "intended flow". */
  steps: TimelineStep[];
  /** Immersion pre-brew steps (invert/load); empty for percolation. */
  setupSteps: TimelineStep[];
  targetTimeSec: number;
  /** True when grams-over-time comparison is meaningful (percolation). Immersion
   * only has sparse checkpoints, so live grams-comparison degrades to timing. */
  hasGramsCurve: boolean;
}

const isAgitationGuideAction = (a: BrewStepAction): boolean =>
  a === "stir" || a === "swirl" || a === "agitate-bed";

function fromGuideStep(g: GuideStep): TimelineStep {
  return {
    index: g.index,
    label: g.label,
    action: g.action,
    startSec: g.startTimeSec,
    endSec: g.startTimeSec + g.durationSec,
    targetCumulativeGrams: g.cumulativeGrams,
    isSetup: g.isSetup,
    isAgitation: isAgitationGuideAction(g.action),
    temperatureC: g.temperatureC,
    notes: g.notes,
  };
}

function fromPourStep(p: PourStep, all: PourStep[], i: number, targetTimeSec: number): TimelineStep {
  const endSec = i < all.length - 1 ? all[i + 1].startTimeSec : targetTimeSec;
  return {
    index: p.index,
    label: p.label,
    action: p.action,
    startSec: p.startTimeSec,
    endSec,
    targetCumulativeGrams: p.cumulativeGrams,
    pourGrams: p.pourGrams,
    isSetup: false,
    isAgitation: isAgitationPourAction(p.action),
    temperatureC: p.temperatureC,
    notes: p.notes,
  };
}

/**
 * Build the canonical timeline for a recipe. Mirrors LightStepBrew's old inline
 * derivation exactly: immersion shape → guide steps; else structured/percolation
 * pour steps; else a genuine prose sequence; else nothing.
 */
export function buildBrewTimeline(
  recipe: BrewRecipe,
  roastDate?: string,
  now: number = Date.now(),
): BrewTimeline {
  const targetTimeSec = recipe.targetTimeSec;

  const guideSteps = hasImmersionShape(recipe) ? buildGuideSteps(recipe) : null;
  if (guideSteps) {
    const normalized = guideSteps.map(fromGuideStep);
    return {
      shape: "immersion",
      pourSteps: null,
      guideSteps,
      proseSequence: null,
      steps: normalized.filter((s) => !s.isSetup),
      setupSteps: normalized.filter((s) => s.isSetup),
      targetTimeSec,
      hasGramsCurve: false,
    };
  }

  const pourSteps =
    pourStepsFromStructured(recipe, roastDate, now) ??
    (recipe.pourSequence && recipe.targetTimeSec
      ? parsePourSteps(recipe.pourSequence, recipe.targetTimeSec, roastDate, now)
      : null);
  if (pourSteps) {
    return {
      shape: "percolation",
      pourSteps,
      guideSteps: null,
      proseSequence: null,
      steps: pourSteps.map((p, i) => fromPourStep(p, pourSteps, i, targetTimeSec)),
      setupSteps: [],
      targetTimeSec,
      hasGramsCurve: true,
    };
  }

  const proseSequence = recipe.pourSequence ? recipe.pourSequence : null;
  return {
    shape: "prose",
    pourSteps: null,
    guideSteps: null,
    proseSequence,
    steps: [],
    setupSteps: [],
    targetTimeSec,
    hasGramsCurve: false,
  };
}

/**
 * Expected cumulative water (grams) at time `tSec`, interpolated from the
 * intended flow. Percolation: water rises linearly from the previous cumulative
 * to each pour's target over the pour's physical duration (`pourDurationSec` at
 * `POUR_RATE_GPS`), then holds flat until the next pour — so the "expected" curve
 * matches the same pour-rate model the timeline is built on. Returns null when
 * there's no meaningful grams curve (immersion / prose).
 */
export function expectedGramsAt(timeline: BrewTimeline, tSec: number): number | null {
  if (!timeline.hasGramsCurve) return null;
  const pours = timeline.steps.filter(
    (s) => !s.isAgitation && s.targetCumulativeGrams != null,
  );
  if (pours.length === 0) return null;

  let prevC = 0;
  for (const s of pours) {
    const c = s.targetCumulativeGrams as number;
    const pourGrams = s.pourGrams ?? c - prevC;
    const dur = pourDurationSec(Math.max(1, pourGrams));
    const pourEnd = s.startSec + dur;
    if (tSec < s.startSec) {
      return prevC; // resting between the previous pour's end and this pour
    }
    if (tSec < pourEnd) {
      const frac = (tSec - s.startSec) / Math.max(1, dur);
      return prevC + (c - prevC) * frac;
    }
    prevC = c; // this pour is fully complete
  }
  return prevC; // past the last pour
}

/**
 * The active step index on the canonical timeline at `elapsed` seconds, or -1
 * before the brew starts. The ONE active-step selector — wraps the existing
 * `getActiveIdx` so the duplicated inline scans in the two renderers can converge
 * on it (and the flow coach reads the same notion of "current step").
 */
export function activeStepAt(timeline: BrewTimeline, elapsed: number, started: boolean): number {
  if (!started || timeline.steps.length === 0) return -1;
  // Same scan as getActiveIdx, over the normalized `startSec` field — the most
  // recent step that has started by `elapsed`.
  let idx = 0;
  for (let i = 0; i < timeline.steps.length; i++) {
    if (elapsed >= timeline.steps[i].startSec) idx = i;
  }
  return idx;
}
