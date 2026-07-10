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
 * Fold physically-impossible jumps that HOLD into a running baseline so the
 * curve reads WATER POURED even when a vessel lands on (or leaves) the scale
 * mid-brew — the "+296.7g overshoot / 66 g/s / hit 300g 106s early" report
 * that a carafe placed on the scale after brew start produced. The
 * min-baseline in analyzeFlow can only remove an offset present from the
 * START; a mid-capture step change needs this.
 *
 * A jump whose NEXT sample returns to the old trend (the pair nets to a
 * plausible pour) is a transient force spike — a tap, a bump, a swirl — and is
 * left alone: the reach/overshoot spike guards downstream already ignore lone
 * outliers, and folding a spike would eat the real water poured around it.
 */
export function rejectNonPourJumps(curve: FlowCurvePoint[]): FlowCurvePoint[] {
  if (curve.length < 2) return curve.slice();
  const out: FlowCurvePoint[] = [curve[0]];
  let offset = 0;
  let skipNext = false; // second leg of a recognized transient spike
  for (let i = 1; i < curve.length; i++) {
    if (!skipNext) {
      const delta = curve[i].grams - curve[i - 1].grams;
      const dt = curve[i].tSec - curve[i - 1].tSec;
      if (isNonPourJump(delta, dt)) {
        const next = curve[i + 1];
        const isTransient =
          next != null &&
          plausiblePour(next.grams - curve[i - 1].grams, next.tSec - curve[i - 1].tSec);
        if (isTransient) {
          skipNext = true; // the return leg belongs to the spike, don't fold it
        } else {
          offset += delta; // sustained level change = mass event, not water
        }
      }
    } else {
      skipNext = false;
    }
    out.push({ tSec: curve[i].tSec, grams: curve[i].grams - offset });
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
    const targetSec = step.startSec + pourDurationSec(Math.max(1, pourGrams));
    const actualSec = timeToReach(curve, target);
    perPour.push({
      index: step.index,
      label: step.label,
      targetGrams: target,
      targetSec,
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
