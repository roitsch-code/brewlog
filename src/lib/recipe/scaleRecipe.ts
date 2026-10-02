/**
 * Scale a published recipe to the batch the user actually wants to brew.
 *
 * Until Sep 2026 there was no scaling model at all. Reference recipes were
 * printed to the model at their published numbers (Hoffmann's 15 g : 250 g) with
 * a prose instruction to "scale the gram amounts"; the deterministic guard then
 * scaled the milestones linearly, copied every step DURATION verbatim (so a
 * 50 g pulse over 10 s became an 80 g pulse over 10 s = 8 g/s) and snapped the
 * clock back to the single-cup total. The owner's complaint — "nicht einfach die
 * Zeiten verlängern, sondern alle Parameter checken" — is the other half of the
 * same gap.
 *
 * WHAT THE EXPERTS ACTUALLY CHANGE (researched Sep 2026, primary sources):
 *
 *  - Hoffmann publishes the same V60 at two sizes. 15 g : 250 g → 30 g : 500 g:
 *    bloom 50 g → 60 g, FOUR 50 g pulses → TWO big pours, pour phase ends
 *    EARLIER (2:00 → 1:45), total 3:00 → 3:30 (+17 % for 2× water), drawdown
 *    60 s → 105 s. (hario-usa.com, both technique pages.)
 *  - Kasuya's 4:6 scales by pour SIZE, not pour count: 20 g : 300 g is five 60 g
 *    pours; 30 g : 450 g is five 90 g pours, same 45 s intervals. (philocoffea.com)
 *  - Rao pours twice whatever the batch, and caps the V60 dose at 20–25 g
 *    because a deeper bed forces a coarser grind. (scottrao.com, bed depth.)
 *  - Wendelboe, on his own brew guide: "for less volumes grind finer than if you
 *    are brewing more volume." (timwendelboe.no)
 *  - Gagné measures the bed directly: resistance rises with depth, so you
 *    "either grind coarser or accept longer brew times" — his own cheat sheet
 *    moves 17 mm → 23 mm of bed from ~3:50 to ~4:50 (+26 % time) AND coarser.
 *    (coffeeadastra.com, bed depth.)
 *  - The owner's own measured anchor: 15 g / 250 ml = 380° on the Niche,
 *    30 g / 500 ml = 400°, i.e. +20° per DOUBLING (docs/grind-settings.md).
 *
 * So: the ratio holds, the pour COUNT holds, the rests hold, the temperature
 * holds. What moves is the dose, the pour SIZE (and therefore how long each pour
 * takes), the grind, and the drawdown — and the total time is the SUM of those,
 * never a multiple of the original.
 */
import type { Recipe, PourStep as RefPourStep } from "@/lib/knowledge/recipes/types";
import type { BrewPourStep } from "@/lib/types/session";
import { DRIP_ASSIST_GRIND_OFFSET_DEG, isDripAssistMethod } from "@/lib/utils/dripAssist";
import { MAX_POUR_RATE_GPS, MIN_POUR_RATE_GPS, POUR_RATE_GPS } from "@/lib/utils/pourSequence";

/**
 * How the drawdown grows with the batch. ESTIMATE, and flagged as one: the only
 * verified pair of the same recipe at two sizes (Hoffmann's two V60 techniques)
 * moves 60 s → 105 s for 2× water, which is an exponent of ~0.8, while the
 * corpus's own big-batch entries are flat (Wendelboe 50→80 s, the Orea "Dara"
 * pair 30→30 s) and are `verified:false`. The square root sits between "flat"
 * and "linear" and under Hoffmann's measured pair, so it never over-promises the
 * clock. The owner's OWN measured brew times override it entirely once there are
 * two brews in the volume bucket (`drawdownFor`, src/lib/brew/drawdown.ts).
 */
export const DRAWDOWN_SCALE_EXP = 0.5;

/** Owner-measured: +20° on the Niche per DOUBLING of dose, and the same amount
 * finer when halving (docs/grind-settings.md). Applied as log2, not linearly —
 * the old guard used `20 × (ratio − 1)`, which is only right at exactly 2×. */
export const GRIND_DEG_PER_DOUBLING = 20;

export interface ScaledGrind {
  /** Scaled Niche range, when the reference publishes one. */
  nicheRange: [number, number] | null;
  /** Degrees added (or removed) for this batch, disc offset included. */
  deltaDeg: number;
  /** What to put in a recipe's `grindSize`, or to show beside a published prose
   * grind that carries no number. */
  text: string;
  /** True when the reference has no Niche number and the text is its own prose. */
  prose: boolean;
}

export interface ScaledRecipe {
  /** Water factor. */
  k: number;
  doseRatio: number;
  doseGrams: number;
  waterGrams: number;
  pourSteps: BrewPourStep[];
  /** Cumulative-grams string, for the legacy `pourSequence` field. */
  pourSequence: string;
  /** The bloom's own block (pour + agitation + rest) at the new size. */
  bloomSec: number;
  pourPhaseEndSec: number;
  drawdownSec: number;
  totalTimeSec: number;
  grind: ScaledGrind;
  waterTempC: number | null;
  /** Percolation recipes scale their cadence; immersion scales grams only and
   * keeps its steep; a split build (iced/bypass) and a machine drip are left
   * alone beyond the grams. */
  shape: "percolation" | "immersion" | "split-build" | "other";
}

const WATER_ACTIONS = new Set(["pour", "melodrip"]);
const AGITATION_ACTIONS = new Set(["stir", "swirl", "agitate-bed"]);
const IMMERSION_BREWERS = new Set([
  "clever",
  "aeropress",
  "aeropress-prismo",
  "cold-brew-jar",
  "moccamaster",
]);

/**
 * A published label often restates the milestone it belongs to — "Pour to 200 g",
 * "Bloom (→ 50 g)". Left alone, a scaled step would read "Pour to 200 g → 273g"
 * and the user would follow the wrong number. Rewrites the embedded figure to
 * the scaled one; leaves a label with no figure untouched.
 */
function rescaleLabel(label: string, refGramsAtEnd: number, scaledGramsAtEnd: number): string {
  if (!label || refGramsAtEnd <= 0) return label;
  const pattern = new RegExp(`\\b${refGramsAtEnd}\\s*g\\b`, "g");
  return label.replace(pattern, `${scaledGramsAtEnd}g`);
}

/** The rate the reference pours at, when it authored a plausible one. */
function referenceRateGPS(grams: number, authoredSec?: number): number {
  if (!authoredSec || authoredSec <= 0 || grams <= 0) return POUR_RATE_GPS;
  const rate = grams / authoredSec;
  // Below MIN_POUR_RATE_GPS the authored time is a rest folded into the step
  // (the Orea Wide / Christensen convention), not a pour time.
  if (rate < MIN_POUR_RATE_GPS) return POUR_RATE_GPS;
  return Math.min(rate, MAX_POUR_RATE_GPS);
}

/**
 * A bigger batch is poured FASTER, not only for longer.
 *
 * Hoffmann's own pair is the evidence, and it is the reason this exists: his
 * 15 g : 250 g pours its pulses at 3.3–5 g/s, his 30 g : 500 g pours at
 * 6.7–8 g/s. Holding the reference's rate through a doubling put the scaled
 * 1-Cup at 4:16 — 46 s LONGER than the 3:30 Hoffmann himself publishes for that
 * exact batch, which is the "you just stretched the clock" failure in miniature.
 * Gagné says the same thing mechanically: a bigger dose wants "more agitation
 * and more water column".
 *
 * Moves by sqrt(k), roughly HALF of what Hoffmann does (he ~doubles the rate for
 * a doubled batch), so a scaled recipe errs on the gentle side; and never past
 * MAX_POUR_RATE_GPS, his 8 g/s being the fastest pour anyone in this corpus
 * publishes. Scaling DOWN keeps the reference's rate: nothing published says a
 * smaller batch should be poured more slowly, and slowing it would be a real
 * change in agitation dressed up as arithmetic.
 */
export const BATCH_RATE_EXP = 0.5;

function batchPourRateGPS(refRate: number, doseRatio: number): number {
  if (!(doseRatio > 1)) return refRate;
  return Math.min(MAX_POUR_RATE_GPS, refRate * Math.pow(doseRatio, BATCH_RATE_EXP));
}

function refTempC(ref: Recipe): number | null {
  const t = ref.temperature;
  if (!t) return null;
  if (typeof t.celsius === "number") return t.celsius;
  if (Array.isArray(t.rangeC)) return t.rangeC[1];
  return null;
}

function nicheRangeOf(ref: Recipe): [number, number] | null {
  const n = ref.grind?.nicheZeroDegrees;
  if (typeof n === "number") return [n, n];
  if (Array.isArray(n) && n.length === 2) return [n[0], n[1]];
  return null;
}

function shapeOf(ref: Recipe): ScaledRecipe["shape"] {
  if ((ref.totalTimeSec ?? 0) >= 3600) return "other";
  const seq = ref.pourSequence ?? [];
  if (seq.some((s) => s.action === "bypass")) return "split-build";
  if ((ref.bestFor?.occasions ?? []).includes("summer-time")) return "split-build";
  if (IMMERSION_BREWERS.has(ref.brewer)) return "immersion";
  if (!seq.some((s) => typeof s.waterGramsAtEnd === "number")) return "other";
  return "percolation";
}

/**
 * The grind this batch wants: the reference's own setting moved by the owner's
 * measured +20°-per-doubling law, plus the Drip Assist's offset when the disc is
 * on. A reference that publishes no Niche number keeps its prose and carries the
 * delta as a note, because converting prose to a number would invent one.
 */
export function scaleGrind(
  ref: Recipe,
  doseRatio: number,
  method?: string,
): ScaledGrind {
  const disc = isDripAssistMethod(method) ? DRIP_ASSIST_GRIND_OFFSET_DEG : 0;
  const batch =
    doseRatio > 0 ? Math.round(GRIND_DEG_PER_DOUBLING * Math.log2(doseRatio)) : 0;
  const deltaDeg = batch + disc;
  const range = nicheRangeOf(ref);

  if (!range) {
    const published = ref.grind?.referenceSetting ?? ref.grind?.description ?? "as published";
    const note =
      deltaDeg === 0
        ? published
        : `${published} (≈${deltaDeg > 0 ? "+" : ""}${deltaDeg}° ${deltaDeg > 0 ? "coarser" : "finer"} than the published single-cup setting)`;
    return { nicheRange: null, deltaDeg, text: note, prose: true };
  }

  const scaled: [number, number] = [range[0] + deltaDeg, range[1] + deltaDeg];
  const text =
    scaled[0] === scaled[1] ? `${scaled[0]}°` : `${scaled[0]}–${scaled[1]}°`;
  return { nicheRange: scaled, deltaDeg, text, prose: false };
}

/**
 * Scale `ref` to `targetWaterGrams`. Pure; never throws. Returns null when the
 * reference carries nothing to scale (no water, no pour plan).
 */
export function scaleRecipe(
  ref: Recipe,
  targetWaterGrams: number,
  opts: { method?: string } = {},
): ScaledRecipe | null {
  const refWater = ref.water?.grams;
  const refDose = ref.dose?.grams;
  if (!refWater || !refDose || !(targetWaterGrams > 0)) return null;

  const k = targetWaterGrams / refWater;
  // The brew ratio is the recipe's, so the dose follows the water. Every expert
  // pair holds the ratio: Hoffmann 1:16.7 at both sizes, Kasuya 1:15 at both,
  // Mardan's Chemex "1:16 linearly 31g/500g up to 78g/1250g".
  const doseRatio = k;
  const doseGrams = Math.round(refDose * k * 2) / 2; // half-gram, as the scale reads
  const shape = shapeOf(ref);
  const grind = scaleGrind(ref, doseRatio, opts.method);
  const waterTempC = refTempC(ref);

  const seq = ref.pourSequence ?? [];
  // A PARTIAL pour plan can't be scaled: when some pours carry a cumulative
  // milestone and others don't (a report that gives the total but not the
  // split — McCarthy's 2013 Kalita), every per-pour number below would be
  // guessed. Return nothing rather than a confident, wrong schedule; the model
  // then sees the published recipe as it is. A plan with NO milestones at all
  // (machine drip) is a different shape and is left as before.
  const pourSteps = seq.filter((s) => s.action === "pour" || s.action === "melodrip");
  const withMilestone = pourSteps.filter((s) => typeof s.waterGramsAtEnd === "number").length;
  if (withMilestone > 0 && withMilestone < pourSteps.length) return null;

  const steps: BrewPourStep[] = [];
  let lastWaterIdx = -1;
  for (let i = 0; i < seq.length; i++) if (typeof seq[i].waterGramsAtEnd === "number") lastWaterIdx = i;

  let prevRefCum = 0;
  let prevScaledCum = 0;
  let pourPhaseEnd = 0;
  let clock = 0;
  let bloomSec = 0;
  let seenWater = false;

  for (let i = 0; i < seq.length; i++) {
    const s = seq[i];
    const isWater = typeof s.waterGramsAtEnd === "number";

    if (isWater) {
      const refCum = s.waterGramsAtEnd as number;
      const refGrams = refCum - prevRefCum;
      prevRefCum = refCum;
      // Round the CUMULATIVE milestone, not each increment: rounding increments
      // accumulates error, so a 450g brew came out at 451g.
      const scaledCum = i === lastWaterIdx ? Math.round(targetWaterGrams) : Math.round(refCum * k);
      const scaledGrams = Math.max(0, scaledCum - prevScaledCum);
      prevScaledCum = scaledCum;
      // The pour scales by RATE, never by the reference's seconds — keeping the
      // seconds is what turned a 50g pulse into an 8 g/s firehose. The rate
      // itself rises with the batch (see batchPourRateGPS), so a doubled brew
      // pours bigger AND faster the way the published pairs do. Rounded UP, so
      // the rounding can never push the pour past the rate it was given.
      const rate = batchPourRateGPS(referenceRateGPS(refGrams, s.durationSec), doseRatio);
      const durationSec = Math.max(1, Math.ceil(scaledGrams / rate));
      steps.push({
        label: rescaleLabel(s.label, s.waterGramsAtEnd as number, scaledCum),
        action: s.action as BrewPourStep["action"],
        waterGramsAtEnd: scaledCum,
        durationSec,
        ...(s.notes ? { notes: s.notes } : {}),
      });
      clock += durationSec;
      pourPhaseEnd = clock;
      seenWater = true;
      continue;
    }

    // On a POUR-OVER a wait or drain after the last pour is the drawdown, and
    // the clock already holds it. On an immersion brew that same wait IS the
    // steep — the whole brew — so it stays a step.
    if (shape === "percolation" && i > lastWaterIdx && (s.action === "wait" || s.action === "drain")) {
      continue;
    }

    // Rests and agitation are the recipe's cadence: unchanged by batch size.
    const durationSec = Math.max(0, s.durationSec ?? 0);
    steps.push({
      label: s.label,
      action: s.action as BrewPourStep["action"],
      ...(durationSec ? { durationSec } : {}),
      ...(s.notes ? { notes: s.notes } : {}),
    });
    clock += durationSec;
    if (AGITATION_ACTIONS.has(s.action)) pourPhaseEnd = clock;
    if (!seenWater || (steps.length && prevScaledCum && bloomSec === 0 && i <= 2)) {
      /* bloom block accumulates below */
    }
  }

  // The bloom block: everything up to and including the rest that follows the
  // first pour. Reported so a caller can show "bloom 80 g / 45 s".
  bloomSec = (() => {
    let acc = 0;
    let past = false;
    for (const s of steps) {
      const d = s.durationSec ?? 0;
      if (typeof s.waterGramsAtEnd === "number") {
        if (past) break;
        past = true;
        acc += d;
        continue;
      }
      if (!past) continue;
      if (s.action === "wait" || AGITATION_ACTIONS.has(s.action)) acc += d;
      else break;
    }
    return acc;
  })();

  const refPourPhaseEnd = (() => {
    let acc = 0;
    let end = 0;
    for (let i = 0; i < seq.length; i++) {
      const s = seq[i];
      if (shape === "percolation" && i > lastWaterIdx && (s.action === "wait" || s.action === "drain")) {
        continue;
      }
      acc += Math.max(0, s.durationSec ?? 0);
      if (typeof s.waterGramsAtEnd === "number" || AGITATION_ACTIONS.has(s.action)) end = acc;
    }
    return end;
  })();

  const refDrawdown = Math.max(0, (ref.totalTimeSec ?? 0) - refPourPhaseEnd);
  const drawdownSec =
    shape === "immersion" || shape === "other"
      ? refDrawdown
      : Math.round(refDrawdown * Math.pow(Math.max(k, 0.01), DRAWDOWN_SCALE_EXP));

  const totalTimeSec =
    shape === "immersion"
      ? clock + drawdownSec
      : Math.max(pourPhaseEnd + drawdownSec, clock);

  const milestones = steps
    .filter((s) => typeof s.waterGramsAtEnd === "number")
    .map((s) => s.waterGramsAtEnd as number);

  return {
    k,
    doseRatio,
    doseGrams,
    waterGrams: milestones.length ? milestones[milestones.length - 1] : Math.round(targetWaterGrams),
    pourSteps: steps,
    pourSequence: milestones.join(" – "),
    bloomSec,
    pourPhaseEndSec: pourPhaseEnd,
    drawdownSec,
    totalTimeSec,
    grind,
    waterTempC,
    shape,
  };
}

const clock = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;

/**
 * One line the model can copy instead of doing the arithmetic itself: the
 * reference, already scaled to this brew, with every step's grams and seconds.
 */
export function formatScaledForPrompt(scaled: ScaledRecipe): string {
  const steps = scaled.pourSteps
    .map((s) => {
      const bits: string[] = [s.label ?? s.action];
      if (typeof s.waterGramsAtEnd === "number") bits.push(`→ ${s.waterGramsAtEnd}g`);
      if (s.durationSec) bits.push(`${s.durationSec}s`);
      return bits.join(" ");
    })
    .join(" · ");
  return (
    `${scaled.doseGrams}g : ${scaled.waterGrams}g | grind ${scaled.grind.text} | ` +
    `${steps} · drawdown ~${scaled.drawdownSec}s · total ${clock(scaled.totalTimeSec)}`
  );
}
