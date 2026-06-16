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

/** First time the curve reaches `grams` (within tolerance), or null. */
function timeToReach(curve: FlowCurvePoint[], grams: number): number | null {
  for (const p of curve) {
    if (p.grams >= grams - REACH_TOL_G) return p.tSec;
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
  curve: FlowCurvePoint[],
  actualTimeSec: number,
): FlowAnalysis | null {
  if (!timeline || !timeline.hasGramsCurve || curve.length < 3) return null;

  const pours = timeline.steps.filter((s) => !s.isAgitation && s.targetCumulativeGrams != null);
  if (pours.length === 0) return null;

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

  // Max amount the actual curve ran ahead of the intended curve.
  let overshootG: number | null = null;
  for (const p of curve) {
    const expected = expectedGramsAt(timeline, p.tSec);
    if (expected == null) continue;
    const ahead = p.grams - expected;
    if (overshootG == null || ahead > overshootG) overshootG = ahead;
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
