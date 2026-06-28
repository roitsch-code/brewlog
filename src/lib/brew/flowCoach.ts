/**
 * Live pour-flow coach — compares the Acaia weight stream to the recipe's
 * intended flow and emits a single teaching cue ("Pour slower", "Keep the
 * flow", "Ease off"…). Pure + deterministic; the brew screen renders whatever
 * this returns. No BLE here — it takes a weight + a short sample window.
 *
 * Grounded in the research (docs/plan): the scale (under the whole brewer)
 * measures water ADDED, so the live signal is your POUR RATE (slope of weight
 * over time) and your progress toward each pour's target. The intended pour
 * rate is ~POUR_RATE_GPS (4 g/s — within the practical 3–5 g/s band); we coach
 * toward it with a tolerance band, sanity-capped. Drawdown rate is NOT visible
 * to the scale (mass is conserved when you're not pouring) → that's a post-brew
 * judgment from total time, handled elsewhere.
 *
 * Bands are STARTING DEFAULTS, tunable on-device — exact g/s is practical
 * guidance, never presented as hard law.
 */
import { activeStepAt, expectedGramsAt, type BrewTimeline } from "@/lib/brew/timeline";
import { pourDurationSec, weightedActiveIdx } from "@/lib/utils/pourSequence";

export interface WeightSample {
  /** Wall-clock ms when the sample was read. */
  atMs: number;
  grams: number;
}

export type FlowCue =
  | "none"
  | "bloom"
  | "pour-slower"
  | "pour-faster"
  | "keep-flow"
  | "ease-off"
  | "steady"
  | "overshot"
  | "hold"
  | "agitate";

export interface FlowComparison {
  cue: FlowCue;
  /** Short imperative coach line (BTTS voice). Empty when cue is "none". */
  message: string;
  /** Secondary line, e.g. "16g to go · 6.2 g/s". */
  detail?: string;
  liveGrams: number | null;
  /** Where you should be right now (interpolated). */
  targetGramsNow: number | null;
  /** The active step's cumulative target. */
  currentStepTargetG: number | null;
  /** target − live (positive = more to pour). */
  remainingToTargetG: number | null;
  liveRateGPS: number | null;
  targetRateGPS: number | null;
  /** For colour: pouring too fast = "ahead", too slow/stalled = "behind". */
  state: "ahead" | "behind" | "on-track" | "no-data";
}

// ── Tuning bands (starting defaults; refine on-device) ───────────────────────
const TOL_G = 3; // within this of a pour's target = "reached"
const EASE_OFF_G = 15; // start easing off this many grams before target
const STALL_RATE = 0.4; // g/s — below this mid-pour = stalled
const FAST_ABS = 6; // g/s — hard "too fast" cap
const SLOW_ABS = 1.5; // g/s — hard "too slow" floor (while pouring)
const FAST_MULT = 1.4; // or this × the intended rate
const SLOW_MULT = 0.6;

const NO_DATA: FlowComparison = {
  cue: "none",
  message: "",
  liveGrams: null,
  targetGramsNow: null,
  currentStepTargetG: null,
  remainingToTargetG: null,
  liveRateGPS: null,
  targetRateGPS: null,
  state: "no-data",
};

/**
 * Pour rate (g/s) = least-squares slope of weight over the trailing `windowMs`.
 * Least-squares (not a 2-point diff) so BLE jitter doesn't make the number jump.
 * Null until there are ≥2 samples spanning the window.
 */
export function flowRateGPS(samples: WeightSample[], windowMs = 1500): number | null {
  if (samples.length < 2) return null;
  const latest = samples[samples.length - 1].atMs;
  const win = samples.filter((s) => latest - s.atMs <= windowMs);
  if (win.length < 2) return null;

  const t0 = win[0].atMs;
  let n = 0;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (const s of win) {
    const x = (s.atMs - t0) / 1000;
    const y = s.grams;
    n += 1;
    sx += x;
    sy += y;
    sxx += x * x;
    sxy += x * y;
  }
  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-9) return null;
  return (n * sxy - sx * sy) / denom;
}

/**
 * Spike-/dip-robust "settled" weight = the MEDIAN of the samples in the trailing
 * `windowMs`. This — not the raw instantaneous weight — is what the brew screen's
 * running peak is built from.
 *
 * Why: a swirl/stir, and especially a TAP on the brewer, make the scale read a
 * brief FORCE spike (the impact, not water). The raw running-max captured that
 * spike and froze it forever, so the coach was permanently stuck on
 * "Overshot +Xg" (the bug the owner hit). A spike lasts a fraction of the window,
 * so the median outvotes it — only real, sustained water passes through — while a
 * brief dip (shifting thumb/cup pressure) is outvoted the same way. Returns null
 * until there's at least one sample inside the window.
 */
export function settledGrams(samples: WeightSample[], windowMs = 1500): number | null {
  if (samples.length === 0) return null;
  const latest = samples[samples.length - 1].atMs;
  const win: number[] = [];
  for (const s of samples) if (latest - s.atMs <= windowMs) win.push(s.grams);
  if (win.length === 0) return null;
  win.sort((a, b) => a - b);
  const mid = win.length >> 1;
  return win.length % 2 ? win[mid] : (win[mid - 1] + win[mid]) / 2;
}

function fmtDetail(remaining: number, rate: number | null): string {
  const left = `${Math.max(0, Math.round(remaining))}g to go`;
  return rate != null ? `${left} · ${rate.toFixed(1)} g/s` : left;
}

/**
 * Compare the live pour to the intended flow at this instant. Returns a single
 * cue + the numbers behind it. Coaches the water-pour steps of BOTH percolation
 * AND immersion/AeroPress brews — any step that carries a cumulative-grams
 * target. Steps with no grams target (a steep/press/drain on an immersion brew)
 * fall through to "no-data" below, so those stay purely time-driven. Degrades to
 * "no-data" before there's a weight reading or the brew has started.
 */
export function coachFlow(
  timeline: BrewTimeline | null,
  elapsed: number,
  started: boolean,
  liveGrams: number | null,
  samples: WeightSample[],
): FlowComparison {
  if (!timeline || !started || liveGrams == null) {
    return { ...NO_DATA, liveGrams };
  }

  const targetGramsNow = expectedGramsAt(timeline, elapsed);
  const rate = flowRateGPS(samples);
  // Pick the SAME active step the brew screen displays: on a grams curve
  // (percolation) the step is weight-/pour-aware (held on an unfinished pour),
  // so the cue + numbers never drift from the card. `timeline.steps` and
  // `timeline.pourSteps` share indices for percolation. Immersion/prose keep the
  // time-based pick. (liveGrams is non-null here — guarded by the early return.)
  const idx =
    timeline.hasGramsCurve && timeline.pourSteps
      ? weightedActiveIdx(timeline.pourSteps, elapsed, liveGrams)
      : activeStepAt(timeline, elapsed, started);
  const step = idx >= 0 ? timeline.steps[idx] : null;
  if (!step) {
    return { ...NO_DATA, liveGrams, targetGramsNow, liveRateGPS: rate };
  }

  // Agitation step → cue the swirl/stir, no flow coaching (no water added).
  if (step.isAgitation) {
    return {
      cue: "agitate",
      message: step.label,
      liveGrams,
      targetGramsNow,
      currentStepTargetG: step.targetCumulativeGrams ?? null,
      remainingToTargetG: null,
      liveRateGPS: rate,
      targetRateGPS: null,
      state: "on-track",
    };
  }

  const stepTarget = step.targetCumulativeGrams ?? null;
  if (stepTarget == null) {
    return { ...NO_DATA, liveGrams, targetGramsNow, liveRateGPS: rate };
  }

  const remaining = stepTarget - liveGrams;
  const isBloom = step.action === "bloom";
  const pourGrams = step.pourGrams != null && step.pourGrams > 0 ? step.pourGrams : stepTarget;
  const targetRate = pourGrams / pourDurationSec(Math.max(1, pourGrams)); // ≈ 4 g/s

  const partial: Omit<FlowComparison, "cue" | "message" | "detail" | "state"> = {
    liveGrams,
    targetGramsNow,
    currentStepTargetG: stepTarget,
    remainingToTargetG: remaining,
    liveRateGPS: rate,
    targetRateGPS: targetRate,
  };

  // Past the target → overshot.
  if (remaining < -TOL_G) {
    return {
      ...partial,
      cue: "overshot",
      message: "Overshot",
      detail: `+${Math.round(-remaining)}g`,
      state: "ahead",
    };
  }
  // Reached the target (within tolerance) → hold for the next pour.
  if (remaining <= TOL_G) {
    return {
      ...partial,
      cue: "hold",
      message: isBloom ? "Swirl" : "Hold",
      state: "on-track",
    };
  }

  // Still pouring toward the target — coach the rate.
  const r = rate ?? 0;
  let cue: FlowCue = isBloom ? "bloom" : "steady";
  let message = isBloom ? "Gentle" : "Steady";
  let state: FlowComparison["state"] = "on-track";

  if (r < STALL_RATE) {
    cue = "keep-flow";
    message = "Keep going";
    state = "behind";
  } else if (r > Math.max(targetRate * FAST_MULT, FAST_ABS)) {
    cue = "pour-slower";
    message = "Slower";
    state = "ahead";
  } else if (r < Math.min(targetRate * SLOW_MULT, SLOW_ABS) && remaining > EASE_OFF_G) {
    cue = "pour-faster";
    message = "Faster";
    state = "behind";
  } else if (remaining <= EASE_OFF_G) {
    cue = "ease-off";
    message = "Ease off";
    state = "on-track";
  }

  return { ...partial, cue, message, detail: fmtDetail(remaining, rate), state };
}
