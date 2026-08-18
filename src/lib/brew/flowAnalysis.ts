/**
 * Post-brew flow analysis — turns the captured weight curve into objective
 * numbers that teach: did each pour land on time, was the pour steady or jerky
 * (channeling risk), did you overshoot, and was the whole brew too fast / too
 * slow. The total-time judgment is the classic grind signal (the scale can't
 * see drawdown rate directly — mass is conserved when you're not pouring — so
 * total time vs target is how "drawdown too slow/fast" is diagnosed).
 *
 * Pure + deterministic. Consumes the canonical BrewTimeline + a {tSec,grams}
 * curve sampled across the whole brew. `derivedFlow` populates the existing
 * BrewLog.flow field so /recommend, /api/brew-insight and brewSignature pick up
 * the MEASURED grade automatically — no self-report needed.
 */
import { expectedGramsAt, type BrewTimeline } from "@/lib/brew/timeline";
import { pourDurationSec } from "@/lib/utils/pourSequence";

export interface FlowCurvePoint {
  /** Seconds since brew start. */
  tSec: number;
  grams: number;
}

export interface PourTiming {
  index: number;
  label: string;
  /** Cumulative target for this pour. */
  targetGrams: number;
  /** When the pour SHOULD have finished (start + pour duration at the intended rate). */
  targetSec: number;
  /** How long this pour was meant to take. Drift is only meaningful relative to
   *  it: 4s off a 10s bloom is a different thing from 4s off a 40s final pour. */
  intendedPourSec: number;
  /** When the curve actually reached the target, or null if never. */
  actualSec: number | null;
  /** actualSec − targetSec; positive = late. Null if never reached. */
  errorSec: number | null;
}

export interface FlowAnalysis {
  totalTimeSec: number;
  targetTimeSec: number;
  finalGrams: number | null;
  perPour: PourTiming[];
  /** Mean of the per-pour observed pour rates (g/s). */
  avgFlowRateGPS: number | null;
  peakFlowRateGPS: number | null;
  /** Coefficient of variation of per-pour rates — lower = steadier (channeling risk when high). */
  pourSteadiness: number | null;
  /** Max amount the actual curve ran ahead of the intended curve (g). */
  overshootG: number | null;
  /** Measured total-time grade, replacing the self-reported flow. */
  derivedFlow: "too-fast" | "perfect" | "too-slow";
  /** Downsampled curve for storage / a sparkline. Capped. */
  samples: FlowCurvePoint[];
}

const REACH_TOL_G = 1.5; // treat the target as "reached" within this many grams
const MAX_STORED_POINTS = 80;

/**
 * Max plausible POURING rate between two samples. A kettle pours ≤~10 g/s (the
 * app's own schedule plans 4 g/s — pourSequence.POUR_RATE_GPS); anything far
 * above that between two adjacent samples is not water, it's a MASS EVENT: a
 * carafe/dripper set onto the scale mid-brew, a vessel lifted off, a mid-brew
 * Tare. Those must move the baseline, never count as poured water.
 */
export const MAX_POUR_GPS = 15;
const JUMP_MARGIN_G = 4;

/** True when `deltaGrams` over `dtSec` could plausibly be water being poured. */
function plausiblePour(deltaGrams: number, dtSec: number): boolean {
  const dt = Math.min(Math.max(dtSec, 0.05), 8);
  return Math.abs(deltaGrams) <= MAX_POUR_GPS * dt + JUMP_MARGIN_G;
}

/** True when a grams delta over dtSec cannot be pouring (see MAX_POUR_GPS).
 * Only judges CLOSELY-SPACED samples (dt ≤ 3s — the live stream is 10–20 Hz,
 * the stored curve 2 Hz): across a sparse gap (BLE dropout, a downsampled
 * legacy curve) pouring and a mass event are indistinguishable, so nothing is
 * folded and the start-offset min-baseline remains the only correction.
 * Shared with the live capture path so the coach and the stored curve agree. */
export function isNonPourJump(deltaGrams: number, dtSec: number): boolean {
  return dtSec <= 3 && !plausiblePour(deltaGrams, dtSec);
}

/**
 * How long a disturbance may last and still count as a transient rather than a
 * real change in what is sitting on the scale. A swirl, a tap, a hand steadying
 * the brewer: the reading leaves the trend and comes BACK. Setting a carafe
 * down does not come back.
 *
 * This has to be a WINDOW, not a single sample. The stored curve is ~2 Hz and
 * the earlier version only forgave a spike whose very next sample returned to
 * trend — so anything lasting longer than half a second (which is every real
 * swirl) defeated it, got folded into the baseline as a "mass event", and
 * dragged the rest of the curve with it. That is the "touching the scale still
 * reacts violently" report.
 */
const TRANSIENT_RETURN_SEC = 8;

/**
 * How much of the disturbance must be gone before it counts as "returned".
 * Plausibility alone is too weak a test over a long window: an 8s window
 * tolerates ~124g of pouring, so a mid-size PERMANENT change (a +60g something
 * set down) would qualify as a return and get smoothed away instead of folded
 * into the baseline. Requiring the level to come most of the way back keeps the
 * two cases apart no matter how wide the window is.
 */
const TRANSIENT_DECAY = 0.5;

/**
 * Remove disturbances that RETURN, fold the ones that HOLD.
 *
 * Two physically different things produce an impossible jump:
 *   - a transient (swirl, tap, bump, hand on the brewer): the reading spikes
 *     and comes back to where the trend left off. It is not data — the samples
 *     inside it say nothing about poured water — so they are replaced by a
 *     straight line across the gap. Interpolating rather than merely "not
 *     folding" is what keeps the spike out of the reach times and the overshoot
 *     as well, instead of each of those needing its own spike guard.
 *   - a mass event (carafe set on the scale mid-brew, vessel lifted off, a
 *     mid-brew tare): the level changes and STAYS changed. That shifts the
 *     baseline for everything after it, which is the "+296.7g overshoot"
 *     report.
 *
 * The only reliable way to tell them apart is to look ahead and see whether the
 * reading comes back — which is why this runs post-brew and never live (a live
 * stream cannot see the return yet; see the live-tare note in LightStepBrew).
 */
export function rejectNonPourJumps(curve: FlowCurvePoint[]): FlowCurvePoint[] {
  if (curve.length < 2) return curve.slice();
  const out: FlowCurvePoint[] = curve.map((p) => ({ ...p }));
  let offset = 0;

  for (let i = 1; i < out.length; i++) {
    const prev = out[i - 1];
    const delta = curve[i].grams - offset - prev.grams;
    const dt = curve[i].tSec - prev.tSec;
    if (!isNonPourJump(delta, dt)) {
      out[i] = { tSec: curve[i].tSec, grams: curve[i].grams - offset };
      continue;
    }

    // Look ahead for a return to the pre-disturbance trend.
    let returnIdx = -1;
    for (let j = i + 1; j < curve.length; j++) {
      const ahead = curve[j].tSec - prev.tSec;
      if (ahead > TRANSIENT_RETURN_SEC) break;
      const residual = curve[j].grams - offset - prev.grams;
      if (plausiblePour(residual, ahead) && Math.abs(residual) < Math.abs(delta) * TRANSIENT_DECAY) {
        returnIdx = j;
        break;
      }
    }

    if (returnIdx === -1) {
      // Never came back inside the window → the level really changed.
      offset += delta;
      out[i] = { tSec: curve[i].tSec, grams: curve[i].grams - offset };
      continue;
    }

    // Came back: straight-line across the disturbance so it contributes nothing.
    const endGrams = curve[returnIdx].grams - offset;
    const span = curve[returnIdx].tSec - prev.tSec;
    for (let k = i; k <= returnIdx; k++) {
      const frac = span > 0 ? (curve[k].tSec - prev.tSec) / span : 1;
      out[k] = {
        tSec: curve[k].tSec,
        grams: prev.grams + (endGrams - prev.grams) * frac,
      };
    }
    i = returnIdx;
  }

  return out;
}

/** Whether `curve[i]` is at/above the target AND holds there (the next point is
 * too, or it's the last point). A SINGLE-sample spike over the target — a bump,
 * a lift, a BLE glitch — fails this, so it isn't mistaken for actually reaching
 * the pour target. A real pour that arrives and stays passes. */
function heldAt(curve: FlowCurvePoint[], i: number, grams: number): boolean {
  if (curve[i].grams < grams - REACH_TOL_G) return false;
  const next = curve[i + 1];
  return next == null || next.grams >= grams - REACH_TOL_G;
}

/** First time the curve reaches `grams` and HOLDS there (within tolerance), or
 * null. Ignoring a lone spike is the whole point — those single movements were
 * what produced the phantom "hit 180g 50s early". */
function timeToReach(curve: FlowCurvePoint[], grams: number): number | null {
  for (let i = 0; i < curve.length; i++) {
    if (heldAt(curve, i, grams)) return curve[i].tSec;
  }
  return null;
}

/** Evenly downsample a curve to at most `max` points (keeps first + last). */
function downsample(curve: FlowCurvePoint[], max = MAX_STORED_POINTS): FlowCurvePoint[] {
  if (curve.length <= max) return curve.slice();
  const step = (curve.length - 1) / (max - 1);
  const out: FlowCurvePoint[] = [];
  for (let i = 0; i < max; i++) out.push(curve[Math.round(i * step)]);
  return out;
}

function gradeFromTime(totalSec: number, targetSec: number): FlowAnalysis["derivedFlow"] {
  if (targetSec <= 0) return "perfect";
  const ratio = totalSec / targetSec;
  if (ratio < 0.85) return "too-fast";
  if (ratio > 1.15) return "too-slow";
  return "perfect";
}

/**
 * Analyze a completed brew. `curve` is the whole-brew {tSec,grams} capture;
 * `actualTimeSec` is the timer's final elapsed. Returns null when there's no
 * usable grams curve (immersion / no scale / too few points).
 */
export function analyzeFlow(
  timeline: BrewTimeline | null,
  rawCurve: FlowCurvePoint[],
  actualTimeSec: number,
): FlowAnalysis | null {
  if (!timeline || !timeline.hasGramsCurve || rawCurve.length < 3) return null;

  const pours = timeline.steps.filter((s) => !s.isAgitation && s.targetCumulativeGrams != null);
  if (pours.length === 0) return null;

  // Two-stage baseline correction so the curve measures WATER POURED:
  //  1. rejectNonPourJumps folds MID-CAPTURE mass events (a carafe set on the
  //     scale after brew start, a vessel lifted off, a mid-brew Tare) into a
  //     running baseline — the min-subtraction below can't see those.
  //  2. Subtract the minimum reading — the least mass ever on the scale — so a
  //     curve that STARTED offset (un-tared vessel on from the first sample)
  //     also reads poured water. On a clean tared curve both are no-ops.
  // Without these, targets are "reached" at t≈0 → absurd flow rates (56–66 g/s)
  // and a huge phantom overshoot (+296.7g / +583g). The capture layer nets too;
  // this is a second guard that also fixes any raw/legacy curve reaching here.
  const dejumped = rejectNonPourJumps(rawCurve);
  const baseline = dejumped.reduce((m, p) => Math.min(m, p.grams), Infinity);
  const curve =
    Number.isFinite(baseline) && baseline > 0
      ? dejumped.map((p) => ({ tSec: p.tSec, grams: p.grams - baseline }))
      : dejumped;

  const finalGrams = curve.reduce((m, p) => Math.max(m, p.grams), 0);

  // Per-pour timing + observed rate.
  const perPour: PourTiming[] = [];
  const rates: number[] = [];
  let prevTarget = 0;
  let prevReachSec = 0;
  for (const step of pours) {
    const target = step.targetCumulativeGrams as number;
    const pourGrams = step.pourGrams != null && step.pourGrams > 0 ? step.pourGrams : target - prevTarget;
    const intendedPourSec = pourDurationSec(Math.max(1, pourGrams));
    const targetSec = step.startSec + intendedPourSec;
    const actualSec = timeToReach(curve, target);
    perPour.push({
      index: step.index,
      label: step.label,
      targetGrams: target,
      targetSec,
      intendedPourSec: Math.round(intendedPourSec * 10) / 10,
      actualSec,
      errorSec: actualSec != null ? Math.round((actualSec - targetSec) * 10) / 10 : null,
    });
    if (actualSec != null && actualSec > prevReachSec && pourGrams > 0) {
      const rate = pourGrams / (actualSec - prevReachSec);
      if (Number.isFinite(rate) && rate > 0) rates.push(rate);
      prevReachSec = actualSec;
    }
    prevTarget = target;
  }

  const avgFlowRateGPS = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
  const peakFlowRateGPS = rates.length ? Math.max(...rates) : null;
  let pourSteadiness: number | null = null;
  if (rates.length >= 2 && avgFlowRateGPS) {
    const variance = rates.reduce((a, r) => a + (r - avgFlowRateGPS) ** 2, 0) / rates.length;
    pourSteadiness = Math.sqrt(variance) / avgFlowRateGPS; // coefficient of variation
  }

  // Max amount the actual curve ran ahead of the intended curve — but a point
  // only counts if an adjacent sample corroborates it, so a lone spike (a bump,
  // a BLE glitch) can't manufacture a phantom overshoot. `ahead[i]` is credited
  // as min(ahead[i], best neighbour) → a one-sample outlier collapses to its
  // (much lower) neighbour; a sustained run keeps its full height.
  const ahead: (number | null)[] = curve.map((p) => {
    const expected = expectedGramsAt(timeline, p.tSec);
    return expected == null ? null : p.grams - expected;
  });
  let overshootG: number | null = null;
  for (let i = 0; i < ahead.length; i++) {
    const a = ahead[i];
    if (a == null) continue;
    const neighbour = Math.max(ahead[i - 1] ?? -Infinity, ahead[i + 1] ?? -Infinity);
    const corroborated = Number.isFinite(neighbour) ? Math.min(a, neighbour) : a;
    if (overshootG == null || corroborated > overshootG) overshootG = corroborated;
  }
  if (overshootG != null) overshootG = Math.round(overshootG * 10) / 10;

  return {
    totalTimeSec: actualTimeSec,
    targetTimeSec: timeline.targetTimeSec,
    finalGrams: Math.round(finalGrams),
    perPour,
    avgFlowRateGPS: avgFlowRateGPS != null ? Math.round(avgFlowRateGPS * 10) / 10 : null,
    peakFlowRateGPS: peakFlowRateGPS != null ? Math.round(peakFlowRateGPS * 10) / 10 : null,
    pourSteadiness: pourSteadiness != null ? Math.round(pourSteadiness * 100) / 100 : null,
    overshootG,
    derivedFlow: gradeFromTime(actualTimeSec, timeline.targetTimeSec),
    samples: downsample(curve),
  };
}

// Display heuristics for reading the pour-steadiness CV — NOT brewing
// parameters. pourSteadiness is the coefficient of variation of the per-pour
// rates (lower = steadier). A CV at/below EVEN_CV reads as an even pour, at/above
// UNEVEN_CV as an uneven one (a direct channeling signal); in between is left
// unlabelled so a borderline pour isn't over-claimed. Overshoot is only worth
// naming above OVERSHOOT_REPORT_G — below that it's within normal pour variance.
export const EVEN_POUR_CV = 0.15;
export const UNEVEN_POUR_CV = 0.35;
export const OVERSHOOT_REPORT_G = 15;

/**
 * Compact core summary of the MEASURED pour from a connected Acaia scale, for
 * the coach + recommend prompts. Until now this objective curve — steadiness
 * (channeling signal) and overshoot — was captured, stored, and read by NO
 * prompt: only the coarse three-way `derivedFlow` reached the model. This turns
 * the real measurement into a phrase the model can reason on ("was that
 * thinness channeling, or the bean?"). Returns "" when no curve was captured;
 * the caller adds its own label/wrapping.
 */
export function formatMeasuredPour(fa: FlowAnalysis | undefined | null): string {
  if (!fa) return "";
  const bits: string[] = [];
  if (fa.pourSteadiness != null) {
    const word =
      fa.pourSteadiness <= EVEN_POUR_CV
        ? " (even)"
        : fa.pourSteadiness >= UNEVEN_POUR_CV
          ? " (uneven — channeling risk)"
          : "";
    bits.push(`steadiness CV ${fa.pourSteadiness}${word}`);
  }
  if (fa.overshootG != null && fa.overshootG > OVERSHOOT_REPORT_G) {
    bits.push(`ran ${fa.overshootG}g ahead of plan`);
  }
  return bits.join(", ");
}
