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
 * bare V60 drawdown sits closer to 15–20% of total time, so the
 * reserve is currently larger than the physics demand and total
 * recipe times come out conservatively padded. Re-calibrating the
 * multiplier is a behavioral change touching every brew and needs an
 * empirical drawdown measurement on the current setup — leave the
 * 0.33 in place until that's done. See the BTTS audit plan file.
 */

import type { BrewRecipe, BrewPourStep, BrewStepAction } from "@/lib/types/session";

export interface PourStep {
  index: number;
  label: string;
  cumulativeGrams: number;
  pourGrams: number;
  startTimeSec: number;
  action: "bloom" | "pour" | "final";
  /** Per-pour temperature for staged-temperature recipes (Hsu, Peng). */
  temperatureC?: number;
  /** Free-text hint shown alongside the active pour. */
  notes?: string;
  /** Agitation the recipe calls for AT this pour. Explicit `"stir"`/`"swirl"`
   * shows the button; explicit `null` suppresses it (minimal-agitation recipe);
   * `undefined` = unknown (legacy grams string) → renderer applies its default. */
  agitation?: "stir" | "swirl" | null;
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

/** One cumulative-grams milestone, with optional per-pour temperature/note. */
interface Milestone {
  grams: number;
  temperatureC?: number;
  notes?: string;
  agitation?: "stir" | "swirl" | null;
}

/**
 * Time a set of cumulative-grams milestones with the drawdown-reserve formula:
 * reserve 33% of total for drawdown, subtract the bloom, evenly space the
 * (n − 2) intervals so the final pour lands at (target − reserve). Shared by the
 * string parser and the structured-percolation builder so both produce an
 * identical schedule.
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
  const interval = n > 2 ? remaining / (n - 2) : 0;

  return milestones.map((m, i) => ({
    index: i,
    label: i === 0 ? "Bloom" : i === n - 1 ? "Final pour" : `Pour ${i + 1}`,
    cumulativeGrams: m.grams,
    pourGrams: i === 0 ? m.grams : m.grams - milestones[i - 1].grams,
    startTimeSec: i === 0 ? 0 : Math.round(bloomDur + (i - 1) * interval),
    action: (i === 0 ? "bloom" : i === n - 1 ? "final" : "pour") as PourStep["action"],
    temperatureC: m.temperatureC,
    notes: m.notes,
    agitation: m.agitation,
  }));
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
        agitation: null,
      });
      last = milestones.length - 1;
    } else if (isAgitationStep(s.action) && last >= 0) {
      // Attach this agitation to the pour it follows (bloom-stir, post-pour swirl).
      milestones[last].agitation = s.action === "swirl" ? "swirl" : "stir";
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
 * grams pour-over renderer (steep-dominated, or with flip/press/invert/bypass). */
export function hasImmersionShape(recipe: BrewRecipe): boolean {
  const src = recipe.pourSteps;
  if (!src || src.length === 0) return false;
  return src.some(
    (s) =>
      s.action === "invert" ||
      s.action === "flip" ||
      s.action === "press" ||
      s.action === "bypass" ||
      (s.action === "wait" && (s.durationSec ?? 0) >= 45),
  );
}
