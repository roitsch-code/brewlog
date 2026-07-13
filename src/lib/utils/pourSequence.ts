/**
 * Pour-over timing math — pure, deterministic, unit-tested.
 *
 * The goal is that the last pour lands at exactly:
 *     (targetTimeSec - drawdownReserve)
 *
 * We reserve 33% of the total brew time for the final drawdown
 * (~89s at 270s total, ~69s at 210s total), subtract the bloom, and
 * evenly space the (n - 2) intervals between the first pour after
 * bloom and the final pour. That guarantees the clock milestone above.
 *
 * Two renderers consume this module:
 *  - Percolation (V60/Orea/Kalita/Chemex) → cumulative-grams `PourStep[]`,
 *    timed by the drawdown-reserve formula (`parsePourSteps`).
 *  - Immersion / AeroPress / staged routines → `GuideStep[]` with authored
 *    per-step durations and explicit actions (`buildGuideSteps`), so steep,
 *    flip and press become discrete, timed cues.
 *
 * NOTE — the 33% multiplier was originally sized for the Drip Assist
 * disc bottleneck. The disc has since been retired from daily use; a
 * standard V60 drawdown sits closer to 15–20% of total time, so the
 * reserve is currently larger than the physics demand and total
 * recipe times come out conservatively padded. Re-calibrating the
 * multiplier is a behavioral change touching every brew and needs an
 * empirical drawdown measurement on the current setup — leave the
 * 0.33 in place until that's done. See the BTTS audit plan file.
 */

import type { BrewRecipe, BrewPourStep, BrewStepAction } from "@/lib/types/session";

/**
 * Pour rate (grams/second) at which the user pours from the kettle — the rate
 * of the POUR itself, NOT the drip-through flow rate. Used to place an agitation
 * step at the moment a pour FINISHES: a pour of `g` grams takes `g / POUR_RATE`
 * seconds, so a swirl/stir/tap called for "after the pour" lands at
 * `pourStart + g / POUR_RATE`.
 *
 * Owner-set 2026-06-15: ~4 g/s (a gentle, controlled gooseneck pour on the
 * Fellow Stagg EKG — matches the silky/floral house style). This is the ONE
 * place to change it; re-measure (pour 100 g, time it) and update here.
 */
export const POUR_RATE_GPS = 4;

/** Seconds to physically pour `grams` at POUR_RATE_GPS (≥1s, rounded). */
export function pourDurationSec(grams: number): number {
  return Math.max(1, Math.round(grams / POUR_RATE_GPS));
}

/** Discrete agitation actions that now get their OWN timed step in the
 * percolation timeline (instead of being folded onto a pour as an attribute). */
export type AgitationAction = "swirl" | "stir" | "tap";

export interface PourStep {
  index: number;
  label: string;
  cumulativeGrams: number;
  pourGrams: number;
  startTimeSec: number;
  /** Water-bearing actions (bloom/pour/final) plus discrete agitation actions
   * (swirl/stir/tap) — agitation is now a real step, timed to land right after
   * the pour it follows finishes pouring. */
  action: "bloom" | "pour" | "final" | AgitationAction;
  /** Per-pour temperature for staged-temperature recipes (Hsu, Peng). */
  temperatureC?: number;
  /** Free-text hint shown alongside the active pour. */
  notes?: string;
}

/** True for the discrete agitation step actions (swirl/stir/tap). */
export function isAgitationPourAction(a: PourStep["action"]): a is AgitationAction {
  return a === "swirl" || a === "stir" || a === "tap";
}

/**
 * Elapsed second at which all pours are complete and the brew enters drawdown —
 * i.e. when the live pour card should stop showing the last step and switch to
 * "draining". The grace after the last step MUST cover the time to physically
 * pour its water (`grams ÷ POUR_RATE_GPS`): a flat 20 s cap used to cut big
 * final pours short (a 120 g final pour needs ~30 s at 4 g/s but the card
 * flipped to "draining" after 20 s while you were still pouring). A trailing
 * swirl/stir/tap is quick (~10 s). Otherwise keep the prior ≤20 s /
 * 35 %-of-drawdown grace. Pure so it's unit-tested alongside the pour math.
 */
export function poursCompleteAtSec(steps: PourStep[], targetTimeSec: number): number {
  if (steps.length === 0) return 0;
  const last = steps[steps.length - 1];
  const lastWork = isAgitationPourAction(last.action)
    ? 10
    : pourDurationSec(last.pourGrams);
  const grace = Math.max(
    lastWork,
    Math.min(20, Math.round((targetTimeSec - last.startTimeSec) * 0.35)),
  );
  return last.startTimeSec + grace;
}

/** A timed, action-aware step for non-percolation methods (immersion,
 * AeroPress, inverted, iced). Setup steps (invert / load / assemble) carry
 * `isSetup` and live outside the timeline. */
export interface GuideStep {
  index: number;
  label: string;
  action: BrewStepAction;
  /** Seconds since brew start at which this step begins (0 for setup steps). */
  startTimeSec: number;
  /** Authored or action-defaulted duration. */
  durationSec: number;
  temperatureC?: number;
  notes?: string;
  /** Cumulative water in the brewer after this step, when known. */
  cumulativeGrams?: number;
  /** True for pre-brew handling (invert, load, assemble) — shown in a Setup
   * card, never auto-advanced by the timer. */
  isSetup: boolean;
}

/**
 * Hoffmann/Rao consensus: 45s peak. Very fresh beans still off-gassing CO2
 * get +5s, past-peak beans with minimal CO2 get cut to 30s.
 *
 * @param roastDate ISO date string. Defaults to peak window (45s) if omitted.
 * @param now injected clock for deterministic testing
 */
export function getBloomDuration(roastDate?: string, now: number = Date.now()): number {
  if (roastDate) {
    const daysOld = Math.floor((now - new Date(roastDate).getTime()) / 86_400_000);
    if (daysOld < 7) return 50;
    if (daysOld < 22) return 45;
    return 30;
  }
  return 45;
}

/** Pull the leading cumulative-grams integer out of a milestone token. Returns
 * null when the token doesn't start with a number (so a genuine prose sequence
 * — "bloom then pour" — is rejected and routed to the immersion guide). */
function leadingGrams(token: string): number | null {
  const m = token.match(/^\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

/** Optional per-token temperature annotation. The grams milestone is the
 * leading number; a temperature is a SECOND number flagged by "@" or wrapped in
 * parentheses — "70 (@70°C)", "180 @94C". */
function tokenTemperature(token: string): number | undefined {
  const temp = token.match(/[@(]\s*@?\s*(\d{2,3})\s*°?\s*[cC]?/);
  return temp ? Number(temp[1]) : undefined;
}

/** Trailing free-text note on a milestone token, parentheses/temperature stripped. */
function tokenNote(token: string): string | undefined {
  const stripped = token
    .replace(/^\s*\d+\s*/, "") // leading grams
    .replace(/[@(]\s*@?\s*\d{2,3}\s*°?\s*[cC]?\s*\)?/g, "") // temp annotation
    .replace(/[()]/g, "")
    .trim();
  return stripped.length > 0 ? stripped : undefined;
}

/** One cumulative-grams milestone, with optional per-pour temperature/note and
 * an agitation the recipe calls for AFTER this pour (becomes its own step). */
interface Milestone {
  grams: number;
  temperatureC?: number;
  notes?: string;
  /** Agitation to perform right after this pour finishes — emitted as a
   * discrete, flow-rate-timed step. `undefined`/absent = none. */
  agitationAfter?: AgitationAction;
  /** Optional note carried onto the agitation step. */
  agitationNote?: string;
}

const AGITATION_LABEL: Record<AgitationAction, string> = {
  swirl: "Swirl",
  stir: "Stir",
  tap: "Tap to level",
};

/**
 * Time a set of cumulative-grams milestones with the drawdown-reserve formula:
 * reserve 33% of total for drawdown, subtract the bloom, evenly space the
 * (n − 2) intervals so the final pour lands at (target − reserve). Shared by the
 * string parser and the structured-percolation builder so both produce an
 * identical schedule.
 *
 * Agitation is now a DISCRETE step: when a milestone carries `agitationAfter`,
 * a swirl/stir/tap step is inserted at `pourStart + pourDurationSec(pourGrams)`
 * — i.e. the instant that pour finishes pouring at the user's pour rate —
 * clamped to land before the next pour (or, for the final pour, before target).
 * So "swirl after the pour" is timed by physics, not guessed.
 */
function buildPourOver(
  milestones: Milestone[],
  targetTimeSec: number,
  roastDate?: string,
  now: number = Date.now(),
): PourStep[] | null {
  const n = milestones.length;
  if (n < 2) return null;

  const bloomDur = getBloomDuration(roastDate, now);
  const drawdownReserve = Math.round(targetTimeSec * 0.33);
  const remaining = targetTimeSec - bloomDur - drawdownReserve;

  // Each pour's water increment (milestone 0 = bloom). The time GAP after a pour
  // (before the next) is sized PROPORTIONALLY to that pour's grams — time follows
  // water, so a big pour gets the seconds it physically needs (≈ grams ÷ POUR_RATE)
  // instead of an equal slice that flips the step before you've finished pouring
  // (the "200 ml pour disappears after 15 s" bug). Post-bloom pours are indices
  // 1..n-1; the (n-2) gaps cover pours 1..n-2 (the final pour is poured during the
  // drawdown reserve). The gaps sum to `remaining`, so the final pour still lands
  // exactly at target − reserve, and EQUAL-size pours reproduce the old uniform
  // schedule byte-for-byte (uniformInterval is the fallback when total weight is 0).
  const increments = milestones.map((m, i) =>
    i === 0 ? m.grams : m.grams - milestones[i - 1].grams,
  );
  const uniformInterval = n > 2 ? remaining / (n - 2) : 0;
  let gapWeightTotal = 0;
  for (let i = 1; i <= n - 2; i++) gapWeightTotal += Math.max(0, increments[i]);

  // Cumulative start time per pour index (0 = bloom@0), rounded per step but
  // accumulated as a float so rounding never compounds and the final start is exact.
  const starts: number[] = new Array(n);
  starts[0] = 0;
  let acc = bloomDur;
  for (let i = 1; i < n; i++) {
    starts[i] = Math.round(acc);
    if (i < n - 1) {
      acc +=
        gapWeightTotal > 0
          ? (remaining * Math.max(0, increments[i])) / gapWeightTotal
          : uniformInterval;
    }
  }
  const pourStartSec = (i: number) => starts[i];

  const out: PourStep[] = [];
  milestones.forEach((m, i) => {
    const pourGrams = i === 0 ? m.grams : m.grams - milestones[i - 1].grams;
    const start = pourStartSec(i);
    out.push({
      index: 0, // re-indexed after interleaving
      label: i === 0 ? "Bloom" : i === n - 1 ? "Final pour" : `Pour ${i + 1}`,
      cumulativeGrams: m.grams,
      pourGrams,
      startTimeSec: start,
      action: i === 0 ? "bloom" : i === n - 1 ? "final" : "pour",
      temperatureC: m.temperatureC,
      notes: m.notes,
    });

    if (m.agitationAfter) {
      // The pour finishes pouring `pourGrams` after `pourDurationSec` seconds.
      // Clamp so the agitation always lands before the next pour starts (or,
      // on the final pour, before the target finish) — never overlapping.
      const ceiling = (i < n - 1 ? pourStartSec(i + 1) : targetTimeSec) - 1;
      const agStart = Math.min(start + pourDurationSec(pourGrams), Math.max(start + 1, ceiling));
      out.push({
        index: 0,
        label: AGITATION_LABEL[m.agitationAfter],
        cumulativeGrams: m.grams,
        pourGrams: 0,
        startTimeSec: agStart,
        action: m.agitationAfter,
        notes: m.agitationNote,
      });
    }
  });

  // Stable-sort by start time (agitation already lands inside its pour's gap,
  // but the explicit sort keeps getActiveIdx / StepDots strictly monotonic) and
  // re-index in timeline order.
  out.sort((a, b) => a.startTimeSec - b.startTimeSec);
  out.forEach((s, i) => (s.index = i));
  return out;
}

/**
 * Parse a " – "-separated cumulative-grams milestone string (e.g. "50 – 180 –
 * 320 – 500") into a timed pour schedule. Tolerant of per-token annotations —
 * "70 (@70°C) – 220 – 370" parses to grams [70, 220, 370] and carries the 70°C
 * onto the first pour. Returns null only when the sequence isn't grams-based
 * (genuine prose), so it can be routed to the immersion step guide instead.
 */
export function parsePourSteps(
  sequence: string,
  targetTimeSec: number,
  roastDate?: string,
  now: number = Date.now(),
): PourStep[] | null {
  const parts = sequence.split(/\s*[–—\-]\s*/).map((s) => s.trim());
  const grams = parts.map(leadingGrams);
  if (parts.length < 2 || grams.some((g) => g === null)) return null;

  const milestones: Milestone[] = parts.map((part, i) => ({
    grams: grams[i] as number,
    temperatureC: tokenTemperature(part),
    notes: tokenNote(part),
  }));
  return buildPourOver(milestones, targetTimeSec, roastDate, now);
}

const isAgitationStep = (a: BrewStepAction) =>
  a === "swirl" || a === "stir" || a === "agitate-bed";

/**
 * Build a pour-over schedule from a recipe's STRUCTURED steps (the percolation
 * case). Milestones are the steps that add water (carry `waterGramsAtEnd`);
 * rests and drawdown are handled by the drawdown-reserve formula, exactly as
 * for a grams string — so a structured V60 times identically to its string
 * form, but now carries per-pour temperature and notes.
 *
 * Agitation is RECIPE-DRIVEN, not assumed: each milestone gets an explicit
 * `agitation` of `"stir"`/`"swirl"` only when an agitation step sits next to it
 * in the sequence, otherwise `null`. So a reduced-/minimal-agitation recipe
 * (no swirl/stir steps) shows no agitation affordance — fixing the bug where a
 * Swirl button appeared on a recipe that explicitly wanted none. Returns null
 * when there aren't at least two water-bearing steps.
 */
export function pourStepsFromStructured(
  recipe: BrewRecipe,
  roastDate?: string,
  now: number = Date.now(),
): PourStep[] | null {
  const src = recipe.pourSteps;
  if (!src || src.length === 0) return null;
  const milestones: Milestone[] = [];
  let last = -1;
  for (const s of src) {
    if (s.waterGramsAtEnd != null) {
      milestones.push({
        grams: s.waterGramsAtEnd,
        temperatureC: s.temperatureC,
        notes: s.notes,
      });
      last = milestones.length - 1;
    } else if (isAgitationStep(s.action) && last >= 0) {
      // Attach this agitation to the pour it follows (bloom-stir, post-pour
      // swirl, tap-to-level) — it becomes its own flow-rate-timed step.
      milestones[last].agitationAfter =
        s.action === "swirl" ? "swirl" : s.action === "agitate-bed" ? "tap" : "stir";
      milestones[last].agitationNote = s.notes;
    }
  }
  return buildPourOver(milestones, recipe.targetTimeSec, roastDate, now);
}

export function getActiveIdx(elapsed: number, steps: { startTimeSec: number }[]): number {
  let idx = 0;
  for (let i = 0; i < steps.length; i++) {
    if (elapsed >= steps[i].startTimeSec) idx = i;
  }
  return idx;
}


// ── Immersion / AeroPress / staged guide ─────────────────────────────────────

/** Pre-brew handling that happens before the timer runs. */
function isSetupAction(action: BrewStepAction, label: string): boolean {
  if (action === "invert") return true;
  return /^\s*(assemble|position|set.?up|load|rinse|place)\b/i.test(label);
}

/** Sensible duration when a structured step omits one. */
function defaultDuration(action: BrewStepAction): number {
  switch (action) {
    case "press":
      return 25;
    case "wait":
      return 60;
    case "stir":
    case "swirl":
    case "agitate-bed":
      return 10;
    case "drain":
      return 30;
    case "bypass":
      return 5;
    case "invert":
    case "flip":
      return 0;
    default:
      return 10; // pour, melodrip
  }
}

/**
 * Build a timed, action-aware guide from a recipe's structured `pourSteps`.
 * Setup steps are flagged and excluded from the timeline; every other step is
 * laid out by its authored (or action-defaulted) duration so the timer can
 * advance through pour → stir → steep → flip/press → bypass with the right cue
 * at each transition. Returns null when there are no structured steps.
 */
export function buildGuideSteps(recipe: BrewRecipe): GuideStep[] | null {
  const src = recipe.pourSteps;
  if (!src || src.length === 0) return null;

  let clock = 0;
  return src.map((step: BrewPourStep, i): GuideStep => {
    const action = step.action;
    const isSetup = isSetupAction(action, step.label);
    const durationSec = step.durationSec ?? defaultDuration(action);
    const startTimeSec = isSetup ? 0 : clock;
    if (!isSetup) clock += durationSec;
    return {
      index: i,
      label: step.label,
      action,
      startTimeSec,
      durationSec,
      temperatureC: step.temperatureC,
      notes: step.notes,
      cumulativeGrams: step.waterGramsAtEnd,
      isSetup,
    };
  });
}

/** True when a recipe's structured steps describe an immersion / AeroPress /
 * staged routine that belongs in the step guide rather than the cumulative-
 * grams pour-over renderer (steep-dominated, or with flip/press/invert/bypass).
 *
 * A long `wait` only signals immersion when it's a MID-BREW steep — i.e. some
 * later step adds water (`waterGramsAtEnd`) or drains/presses/flips/inverts/
 * bypasses. A long `wait` with nothing of those after it is just a pour-over's
 * terminal DRAWDOWN, NOT a steep, and must stay percolation (so it keeps the
 * cumulative-grams renderer + the live flow coach). This came up because the
 * Home chat's `start_brew` encodes a V60's ~2:00 drawdown as a trailing `wait`,
 * which used to misroute the whole pour-over to the immersion guide and drop the
 * flow coach. Order-robust: a trailing "Final swirl" after the drawdown wait
 * still doesn't qualify (swirl neither adds water nor drains/presses). */
export function hasImmersionShape(recipe: BrewRecipe): boolean {
  const src = recipe.pourSteps;
  if (!src || src.length === 0) return false;
  const isExtractionEnd = (a: BrewStepAction): boolean =>
    a === "drain" || a === "press" || a === "flip" || a === "invert" || a === "bypass";
  const isWaterPour = (a: BrewStepAction): boolean =>
    a === "bloom" || a === "pour" || a === "final" || a === "melodrip";
  return src.some((s, i) => {
    if (s.action === "invert" || s.action === "flip" || s.action === "press" || s.action === "bypass") {
      return true;
    }
    if (s.action === "wait" && (s.durationSec ?? 0) >= 45) {
      // A real mid-brew STEEP ends in extraction (drain/press/flip/invert/bypass)
      // with NO further pouring after it. A wait FOLLOWED BY MORE WATER is a
      // BLOOM REST / pause between pulse pours — percolation, NOT a steep. That
      // false positive is what misrouted an Origami-wave whose long bloom was
      // encoded as an explicit "Bloom Rest" wait step to the immersion guide,
      // which then trusted a physically-impossible authored pour duration
      // (235 g in ~30 s → ~8 g/s, double a gentle pour). Order-robust: a genuine
      // two-stage immersion still trips on its LAST steep — the wait that has
      // only a drain/press after it and no more pouring.
      const rest = src.slice(i + 1);
      const morePouring = rest.some(
        (l) => isWaterPour(l.action) && l.waterGramsAtEnd != null,
      );
      return !morePouring && rest.some((l) => isExtractionEnd(l.action));
    }
    return false;
  });
}
