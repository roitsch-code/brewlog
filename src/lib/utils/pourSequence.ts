/**
 * Pour-over timing math — pure, deterministic, unit-tested.
 *
 * The goal is that the last pour lands at exactly:
 *     (targetTimeSec - drawdownReserve)
 *
 * We reserve a method-aware fraction of the total brew time for the final
 * drawdown (33% bare, 7% with the Drip Assist — see drawdownReserveFrac),
 * subtract the bloom, and size the (n - 2) intervals between the first pour
 * after bloom and the final pour PROPORTIONALLY to each pour's grams (time
 * follows water, #438). That guarantees the clock milestone above.
 *
 * Two renderers consume this module:
 *  - Percolation (V60/Orea/Kalita/Chemex) → cumulative-grams `PourStep[]`,
 *    timed by the drawdown-reserve formula (`parsePourSteps`).
 *  - Immersion / AeroPress / staged routines → `GuideStep[]` with authored
 *    per-step durations and explicit actions (`buildGuideSteps`), so steep,
 *    flip and press become discrete, timed cues.
 *
 * NOTE — the 33% reserve is the DEFAULT for a bare percolation brew. A standard
 * V60 drawdown probably sits closer to 15–20% of total time, so the default is
 * still conservatively padded pending an empirical measurement — leave it until
 * that's done. The one calibrated case is the Drip Assist disc: it distributes
 * water evenly across the whole bed, so the bed drains almost as fast as it's
 * poured and the long drawdown tail simply doesn't happen (owner-observed, Aug
 * 2026 — the "recipe finishes a minute early" report). For a disc brew the
 * reserve collapses to a thin drainage margin (see drawdownReserveFrac), so the
 * timer's finish lands when the cup is actually through instead of ~a minute
 * later. The disc case is method-driven; every other brewer keeps the 33%.
 */

import { daysSinceRoast, freshnessBucket } from "../coffee/freshness";
import type { BrewRecipe, BrewPourStep, BrewStepAction } from "@/lib/types/session";
import { isDripAssistMethod } from "@/lib/utils/dripAssist";

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

/** Slowest rate we'll believe is a real POUR time. A step whose authored
 * `durationSec` implies less than this (e.g. a 45 g "bloom" tagged 45 s = 1 g/s)
 * is a rest/steep window folded into the step, NOT the pour itself — so we don't
 * coach to it. Above it, the authored time is treated as the intended pour time. */
export const MIN_POUR_RATE_GPS = 2;

/**
 * The intended pour TIME (seconds) for a pour of `grams`: the recipe's authored
 * value when it reads as a plausible pour time (≥ MIN_POUR_RATE_GPS), otherwise
 * the ~POUR_RATE_GPS house estimate. This is the single source both the expected-
 * grams curve and the live flow coach use to know how fast a pour is INTENDED to
 * go — so a 6 g/s Kasuya pour is coached at 6, not the house 4, while a rest
 * folded into a bloom step (or a missing duration) falls back to the estimate.
 */
export function intendedPourDurationSec(grams: number, authoredSec?: number): number {
  const g = Math.max(1, grams);
  if (authoredSec && authoredSec > 0 && g / authoredSec >= MIN_POUR_RATE_GPS) return authoredSec;
  return pourDurationSec(g);
}

/** The intended pour rate is clamped to this sane pour band for BOTH display and
 * coaching, so a mis-authored `durationSec` (a 1 s "pour 200 g" = 200 g/s) can't
 * set an absurd target. Wide by design — the corpus spans ~3–10 g/s on pour-overs
 * (median 5.2). Shared with the live flow coach so the shown and coached targets
 * never drift. */
export const PACE_RATE_MIN_GPS = 2;
export const PACE_RATE_MAX_GPS = 11;

/**
 * The recipe's intended pour RATE (g/s) for a pour of `grams`, clamped to the
 * sane pour band. This is the SINGLE source of truth for "how fast this pour
 * should go" — used by the live flow coach (what it grades your pour against)
 * AND by the brew screen (what it displays), so the target you're shown and the
 * target you're coached to are always the same number.
 */
export function pourTargetRateGPS(grams: number, authoredSec?: number): number {
  const g = Math.max(1, grams);
  const raw = g / intendedPourDurationSec(g, authoredSec);
  return Math.min(PACE_RATE_MAX_GPS, Math.max(PACE_RATE_MIN_GPS, raw));
}

export interface PourPace {
  /** Grams added by this pour. */
  grams: number;
  /** Seconds to pour it at the intended rate (kept consistent with `rateGPS`). */
  seconds: number;
  /** Intended pour rate (g/s), clamped to the sane pour band. */
  rateGPS: number;
  /** Plain pace word mapped from the rate. Owner-calibrated to the house pour:
   * the ~4 g/s gentle gooseneck reads "slow", Kasuya's ~6 "steady", a Hoffmann
   * swing "fast". Turns a recipe's vague "slow"/"gentle" into a word AND a number
   * the user can hold against the live g/s the scale shows. */
  descriptor: "very slow" | "slow" | "steady" | "brisk" | "fast";
}

/**
 * Concrete pour-pace for a single pour — how fast (g/s), how long (s), and a
 * plain descriptor — derived from the recipe's OWN timing (the same intended-rate
 * model the flow coach uses). Lets the brew screen replace a vague "slow pouring"
 * with "Slow pour · ~4 g/s over ~45s". Returns null for a zero-gram step
 * (agitation / steep / press), which has no pour to pace.
 */
export function pourPace(grams: number, authoredSec?: number): PourPace | null {
  if (!grams || grams <= 0) return null;
  const rateGPS = pourTargetRateGPS(grams, authoredSec);
  const rawSeconds = intendedPourDurationSec(grams, authoredSec);
  // If the raw rate got clamped, re-derive seconds from the clamped rate so the
  // displayed pair "~18s · ~11 g/s" is never internally impossible.
  const seconds =
    Math.abs(grams / rawSeconds - rateGPS) < 1e-6
      ? rawSeconds
      : Math.max(1, Math.round(grams / rateGPS));
  const descriptor: PourPace["descriptor"] =
    rateGPS < 3
      ? "very slow"
      : rateGPS < 4.5
        ? "slow"
        : rateGPS < 6
          ? "steady"
          : rateGPS < 8
            ? "brisk"
            : "fast";
  return { grams, seconds, rateGPS, descriptor };
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
  /** The recipe's OWN intended pour time for this pour (seconds), when authored.
   * `pourGrams / pourDurationSec` is the recipe's intended pour RATE — Kasuya
   * pours 60 g in 10 s = 6 g/s, not the house 4 g/s. Used by the flow coach to
   * coach against the recipe's own rate instead of a global constant. Undefined
   * for string-parsed recipes → the coach falls back to the ~4 g/s house rate. */
  pourDurationSec?: number;
  /** How long this step OCCUPIES on the rendered timeline — the pour's own
   * corrected time (see pourTimingDurationSec), or an agitation step's duration.
   * `startTimeSec + timingDurationSec` is when the step is done, which is what
   * the drawdown, the dead-gap check and the drain card all measure from. */
  timingDurationSec: number;
}

/** True for the discrete agitation step actions (swirl/stir/tap). */
export function isAgitationPourAction(a: PourStep["action"]): a is AgitationAction {
  return a === "swirl" || a === "stir" || a === "tap";
}

/**
 * Elapsed second at which all pours are complete and the brew enters drawdown —
 * i.e. when the live pour card should stop showing the last step and switch to
 * "draining". Cadence-first, this is simply the end of the pour phase: the last
 * step's start plus the time that step occupies. No grace is invented, because
 * the schedule already gives every pour the seconds it needs (before Sep 2026 it
 * did not, and this function had to guess one).
 */
export function poursCompleteAtSec(steps: PourStep[], _targetTimeSec?: number): number {
  if (steps.length === 0) return 0;
  return pourPhaseEndSec(steps);
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
export const PEAK_BLOOM_SEC = 45;
/** However short a recipe's own bloom, a past-peak shift can't erase it. */
export const MIN_BLOOM_SEC = 15;

export function getBloomDuration(roastDate?: string, now: number = Date.now()): number {
  // Edges from the shared freshness table (src/lib/coffee/freshness.ts):
  // too-fresh / very-fresh (< 7 days) 50s, peak (7–21) 45s, older 30s.
  switch (freshnessBucket(daysSinceRoast(roastDate, now))) {
    case "unknown":
    case "peak":
      return PEAK_BLOOM_SEC;
    case "too-fresh":
    case "very-fresh":
      return 50;
    default:
      return 30;
  }
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
  /** Authored duration of that agitation step (seconds), when the recipe gave one. */
  agitationDurationSec?: number;
  /** The recipe's authored pour time for this pour (seconds), when known — the
   * intended-rate source (grams ÷ this). Undefined for string-parsed recipes. */
  pourDurationSec?: number;
  /**
   * Σ of the authored `wait` durations the recipe places between this pour (or
   * its agitation) and the next water step — the recipe's OWN rest.
   *
   *  - `undefined` on EVERY milestone = the recipe authored no rests anywhere,
   *    so the fallback distributes them (see buildPourSchedule).
   *  - `0` = rests exist elsewhere in this recipe but not here, i.e. the pours
   *    are deliberately back-to-back (Hoffmann's big-batch 30 g : 500 g).
   */
  restAfterSec?: number;
}

const AGITATION_LABEL: Record<AgitationAction, string> = {
  swirl: "Swirl",
  stir: "Stir",
  tap: "Tap to level",
};

/** Default seconds for an agitation step the recipe didn't time itself. */
const DEFAULT_AGITATION_SEC = 5;

/**
 * The drawdown floor — the dead air AFTER the last pour, before the cup is
 * through. A FLOOR, not a reserve: the drawdown is whatever the recipe's clock
 * has left once its own cadence has played out, and this only stops a clock from
 * ending while the bed is still full.
 *
 * MEASURED, not chosen (Sep 2026, over the 93 percolation recipes in the corpus):
 * drawdowns run from 5 s to 225 s, median 70 s. The 5 s is Wölfl's WBrC-winning
 * Orea Fast — a verified championship recipe — so any larger floor would rewrite
 * a published recipe, which is exactly what the old fixed 33 % reserve did. A
 * bare V60 wanting 60–90 s of drawdown gets it from the recipe, not from here.
 */
export const MIN_DRAWDOWN_SEC = 5;

/** The drawdown floor for a brew method. One number today; kept as a function
 * because the Drip Assist's tail is calibrated separately (see recommend.ts). */
export function minDrawdownSec(_method?: string): number {
  return MIN_DRAWDOWN_SEC;
}

/**
 * The fastest a pour is ever SCHEDULED at. Hoffmann's Ultimate V60 — the fastest
 * pour anyone in the corpus publishes — moves 240 g in 30 s = 8 g/s. An authored
 * duration implying more than this is not a pour anyone makes, so the schedule
 * stretches the slot to `grams / 8` instead of promising the impossible (the
 * "225 g with 15 s left" report). Distinct from PACE_RATE_MAX_GPS (11), which
 * only clamps what the live coach DISPLAYS.
 */
export const MAX_POUR_RATE_GPS = 8;

/** Rest bounds used only when a recipe authored no rests of its own: 10 s is
 * Hoffmann's own inter-pulse pause (the shortest real one), 45 s is Kasuya's 4:6
 * interval (the longest normal one). Anything past 45 s is a designed steep and
 * has to be authored as a `wait`. */
export const FALLBACK_REST_MIN_SEC = 10;
export const FALLBACK_REST_MAX_SEC = 45;

/**
 * The share of the clock a recipe that authored NO rests should leave as
 * drawdown. MEASURED: the median drawdown across the 93 percolation recipes in
 * the corpus is 36 % of the clock. (The old renderer imposed a fixed 33 % on
 * EVERY recipe, which is why it re-timed published ones — but as a default for a
 * recipe that states no cadence of its own, that number turns out to be about
 * right.) Only a floor-and-ceiling guide: the rest clamp wins, and what is left
 * over is the drawdown.
 */
export const FALLBACK_DRAWDOWN_SHARE = 0.36;

/**
 * The most drawdown a clock may promise before it is padding rather than
 * draining. MEASURED: the longest verified tail in the corpus is Hoffmann's
 * Chemex at 225 s = 60 % of its clock, and the longest of any recipe is 65 %, so
 * this admits every published recipe and still rejects a model that inflated
 * `targetTimeSec` ("a 500 ml V60 is an 8-minute brew") rather than adding pours.
 */
export const MAX_DRAWDOWN_SHARE = 0.65;
export const MAX_DRAWDOWN_FLOOR_SEC = 240;

export function maxDrawdownSec(targetTimeSec: number): number {
  return Math.max(MAX_DRAWDOWN_FLOOR_SEC, Math.round(targetTimeSec * MAX_DRAWDOWN_SHARE));
}

/**
 * The longest clock a pour phase ending at `pourPhaseEndSec` may claim before
 * its drawdown breaches `maxDrawdownSec`. Solved for the clock rather than
 * clamped against it, because the cap is a share OF the clock — trimming by the
 * cap alone would not converge.
 */
export function maxTargetTimeSec(pourPhaseEndSec: number): number {
  return Math.max(
    pourPhaseEndSec + MAX_DRAWDOWN_FLOOR_SEC,
    Math.round(pourPhaseEndSec / (1 - MAX_DRAWDOWN_SHARE)),
  );
}

/**
 * How long this pour OCCUPIES on the timeline.
 *
 *  - Authored rate in [MIN_POUR_RATE_GPS, MAX_POUR_RATE_GPS] → the recipe's own
 *    time, verbatim. This is the whole point: Kasuya pours 60 g in 10 s and the
 *    timer must say 10 s.
 *  - Faster than MAX_POUR_RATE_GPS → stretched to `grams / MAX_POUR_RATE_GPS`;
 *    nobody pours faster, so the promise is corrected rather than shown.
 *  - Slower than MIN_POUR_RATE_GPS (or missing) → the authored value is a rest
 *    folded into the step (the Orea-Wide / Christensen convention), so the POUR
 *    is the ~4 g/s house estimate and the remainder becomes rest.
 */
export function pourTimingDurationSec(grams: number, authoredSec?: number): number {
  const g = Math.max(1, grams);
  if (authoredSec && authoredSec > 0) {
    const rate = g / authoredSec;
    if (rate > MAX_POUR_RATE_GPS) return Math.max(1, Math.ceil(g / MAX_POUR_RATE_GPS));
    if (rate >= MIN_POUR_RATE_GPS) return Math.round(authoredSec);
  }
  return pourDurationSec(g);
}

/** A rendered pour schedule plus the clock facts derived from it. */
export interface PourSchedule {
  steps: PourStep[];
  /** Elapsed second at which the last pour (and any trailing agitation) is done. */
  pourPhaseEndSec: number;
  /** Seconds of drawdown the clock actually leaves after the pour phase. */
  drawdownSec: number;
  /** When the brew is really finished: `targetTimeSec`, or the pour phase plus
   * the drawdown floor when the recipe's own cadence needs more than the clock. */
  finishSec: number;
  /** True when `finishSec > targetTimeSec` — the recipe under-promised its clock. */
  extended: boolean;
}

/**
 * Time a set of cumulative-grams milestones CADENCE-FIRST: every step occupies
 * the time the recipe gave it, and the drawdown is whatever the clock has left.
 *
 * Until Sep 2026 this worked the other way round — a fixed fraction of
 * `targetTimeSec` was reserved for the drawdown and the pours were spread across
 * the remainder in proportion to their grams. That inverted the physics. It
 * produced dead air wherever a recipe had fewer pours than the clock had room
 * for (a bloom + 2 pours on a 5-minute clock left a 105 s hole), squeezed the
 * final pour into the reserve regardless of its size (225 g in 15 s = 15 g/s),
 * and re-timed every published recipe: Kasuya's 45 s intervals rendered as 32 s,
 * Rao's designed 58 s rest as a 106 s gap. Hoffmann's own 1-cup technique now
 * renders at exactly his published 0:45 / 1:10 / 1:30 / 1:50.
 *
 * The bloom is the one step the roast date gets a say in, because CO2
 * off-gassing depends on the bean and not on the recipe. It is a DELTA, though,
 * not a replacement: a recipe that times its own bloom block (pour + swirl +
 * rest) keeps it, shifted by how far this bean is from the peak window
 * (+5 s very fresh, 0 at peak, −15 s past peak). Replacing the block outright
 * would overwrite Rao's designed 60 s bloom with 45 s and push Kurasu's fast
 * 30 s Origami past its own clock. A recipe that authors no bloom block (a
 * grams string) falls back to the roast-age duration alone.
 *
 * Agitation is a DISCRETE step placed the instant its pour finishes, occupying
 * its own authored duration, so "swirl after the pour" is timed by the recipe
 * rather than guessed.
 */
function buildPourSchedule(
  milestones: Milestone[],
  targetTimeSec: number,
  roastDate?: string,
  now: number = Date.now(),
  method?: string,
): PourSchedule | null {
  const n = milestones.length;
  if (n < 2) return null;

  const minDrawdown = minDrawdownSec(method);

  const increments = milestones.map((m, i) =>
    i === 0 ? m.grams : m.grams - milestones[i - 1].grams,
  );
  const timing = milestones.map((m, i) => pourTimingDurationSec(increments[i], m.pourDurationSec));
  const agitation = milestones.map((m) =>
    m.agitationAfter ? Math.max(1, Math.round(m.agitationDurationSec ?? DEFAULT_AGITATION_SEC)) : 0,
  );

  // The bloom's slot: the recipe's own block (pour + agitation + rest) shifted by
  // the roast-age delta, or the roast-age duration outright when it authored none.
  const roastShift = getBloomDuration(roastDate, now) - PEAK_BLOOM_SEC;
  // The block is measured from the AUTHORED pour time, so correcting an
  // impossible bloom rate borrows from the bloom's own rest instead of pushing
  // every later pour back — the same rule the post-bloom pours follow. Hoffmann
  // authors his bloom as 5 s + 5 s swirl + 35 s rest; the pour renders longer
  // (50 g in 5 s is 10 g/s), and pour 2 still lands at his published 0:45.
  const authoredBloom =
    milestones[0].restAfterSec != null
      ? (milestones[0].pourDurationSec ?? timing[0]) + agitation[0] + milestones[0].restAfterSec
      : 0;
  const bloomDur =
    authoredBloom > 0
      ? Math.max(MIN_BLOOM_SEC, timing[0] + agitation[0], Math.round(authoredBloom + roastShift))
      : getBloomDuration(roastDate, now);

  // Does the recipe time its own rests? A recipe with `wait` steps between its
  // pours (every corpus entry) is followed verbatim. One without any (today's
  // /recommend output, every persisted session, a string `pourSequence`) gets
  // rests distributed across whatever the clock has spare.
  const authoredRests = milestones.some((m) => m.restAfterSec != null);

  let fallbackRest = 0;
  if (!authoredRests && n > 2) {
    // Post-bloom pours are 1..n-1, so the gaps between them number n-2. Aim to
    // leave a drawdown of the corpus-median share rather than filling the clock
    // with rests — a bare cone still has to drain after the last pour.
    let pourTimeAfterBloom = 0;
    for (let i = 1; i < n; i++) pourTimeAfterBloom += timing[i] + agitation[i];
    const wantDrawdown = Math.max(
      minDrawdown,
      Math.round(targetTimeSec * FALLBACK_DRAWDOWN_SHARE),
    );
    const spare = targetTimeSec - bloomDur - wantDrawdown - pourTimeAfterBloom;
    fallbackRest = Math.min(
      FALLBACK_REST_MAX_SEC,
      Math.max(FALLBACK_REST_MIN_SEC, Math.round(spare / (n - 2))),
    );
  }

  // Start times: the bloom owns its roast-age slot (its own pour, agitation and
  // rest all live inside it); after that each pour starts when the previous
  // one's pour + agitation + rest is done.
  const starts: number[] = new Array(n);
  starts[0] = 0;
  let acc = bloomDur;
  for (let i = 1; i < n; i++) {
    starts[i] = Math.round(acc);
    if (i < n - 1) {
      let rest: number;
      if (authoredRests) {
        // A pour stretched off an impossible authored rate borrows that time from
        // its own rest, so the recipe's overall cadence is preserved.
        const stretch = Math.max(0, timing[i] - (milestones[i].pourDurationSec ?? timing[i]));
        rest = Math.max(0, (milestones[i].restAfterSec ?? 0) - stretch);
      } else {
        rest = fallbackRest;
      }
      acc += timing[i] + agitation[i] + rest;
    }
  }

  const out: PourStep[] = [];
  milestones.forEach((m, i) => {
    const start = starts[i];
    out.push({
      index: 0, // re-indexed after interleaving
      label: i === 0 ? "Bloom" : i === n - 1 ? "Final pour" : `Pour ${i + 1}`,
      cumulativeGrams: m.grams,
      pourGrams: increments[i],
      startTimeSec: start,
      action: i === 0 ? "bloom" : i === n - 1 ? "final" : "pour",
      temperatureC: m.temperatureC,
      notes: m.notes,
      pourDurationSec: m.pourDurationSec,
      timingDurationSec: timing[i],
    });

    if (m.agitationAfter) {
      // Lands the instant the pour finishes at its rendered rate. The clamp is a
      // belt-and-braces guard: cadence-first already leaves room for it.
      const ceiling = (i < n - 1 ? starts[i + 1] : Math.max(targetTimeSec, starts[i] + timing[i] + agitation[i])) - 1;
      const agStart = Math.min(start + timing[i], Math.max(start + 1, ceiling));
      out.push({
        index: 0,
        label: AGITATION_LABEL[m.agitationAfter],
        cumulativeGrams: m.grams,
        pourGrams: 0,
        startTimeSec: agStart,
        action: m.agitationAfter,
        notes: m.agitationNote,
        timingDurationSec: agitation[i],
      });
    }
  });

  // Stable-sort by start time (agitation already lands inside its pour's gap,
  // but the explicit sort keeps getActiveIdx / StepDots strictly monotonic) and
  // re-index in timeline order.
  out.sort((a, b) => a.startTimeSec - b.startTimeSec);
  out.forEach((s, i) => (s.index = i));

  const phaseEnd = pourPhaseEndSec(out);
  const finishSec = Math.max(targetTimeSec, phaseEnd + minDrawdown);
  return {
    steps: out,
    pourPhaseEndSec: phaseEnd,
    drawdownSec: finishSec - phaseEnd,
    finishSec,
    extended: finishSec > targetTimeSec,
  };
}

/** Elapsed second at which the pour phase is over — the last step's start plus
 * the time that step occupies. The drawdown begins here. */
export function pourPhaseEndSec(steps: PourStep[]): number {
  let end = 0;
  for (const s of steps) {
    // `timingDurationSec` is always set by the builder; the fallback covers a
    // hand-built or pre-Sep-2026 persisted step that predates the field.
    const occupies = Number.isFinite(s.timingDurationSec)
      ? Math.max(1, s.timingDurationSec)
      : isAgitationPourAction(s.action)
        ? DEFAULT_AGITATION_SEC
        : pourDurationSec(s.pourGrams);
    end = Math.max(end, s.startTimeSec + occupies);
  }
  return end;
}

/** Cadence-first pour schedule (steps only). See buildPourSchedule. */
function buildPourOver(
  milestones: Milestone[],
  targetTimeSec: number,
  roastDate?: string,
  now: number = Date.now(),
  method?: string,
): PourStep[] | null {
  return buildPourSchedule(milestones, targetTimeSec, roastDate, now, method)?.steps ?? null;
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
  method?: string,
): PourStep[] | null {
  const parts = sequence.split(/\s*[–—\-]\s*/).map((s) => s.trim());
  const grams = parts.map(leadingGrams);
  if (parts.length < 2 || grams.some((g) => g === null)) return null;

  const milestones: Milestone[] = parts.map((part, i) => ({
    grams: grams[i] as number,
    temperatureC: tokenTemperature(part),
    notes: tokenNote(part),
  }));
  return buildPourOver(milestones, targetTimeSec, roastDate, now, method);
}

/**
 * The rendered schedule for a recipe, whichever form it carries — structured
 * steps first, then a cumulative-grams string. The ONE place the brew screen,
 * the timeline and every guard ask "what will the user actually be asked to do
 * and when is this brew over". Null for immersion or genuine prose.
 */
export function pourScheduleFor(
  recipe: BrewRecipe,
  roastDate?: string,
  now: number = Date.now(),
  method?: string,
): PourSchedule | null {
  if (hasImmersionShape(recipe)) return null;
  const structured = structuredPourSchedule(recipe, roastDate, now, method);
  if (structured) return structured;
  if (!recipe.pourSequence || !recipe.targetTimeSec) return null;
  const parts = recipe.pourSequence.split(/\s*[–—\-]\s*/).map((t) => t.trim());
  const grams = parts.map(leadingGrams);
  if (parts.length < 2 || grams.some((g) => g === null)) return null;
  const milestones: Milestone[] = parts.map((part, i) => ({
    grams: grams[i] as number,
    temperatureC: tokenTemperature(part),
    notes: tokenNote(part),
  }));
  return buildPourSchedule(milestones, recipe.targetTimeSec, roastDate, now, method);
}

const isAgitationStep = (a: BrewStepAction) =>
  a === "swirl" || a === "stir" || a === "agitate-bed";

/**
 * Build a pour-over schedule from a recipe's STRUCTURED steps (the percolation
 * case). Milestones are the steps that add water (carry `waterGramsAtEnd`); the
 * `wait` steps BETWEEN them are the recipe's own rests and are carried through
 * verbatim, which is what makes a published recipe render at its published
 * times. A trailing `wait`/`drain` after the last water step is the drawdown,
 * not cadence, so it is deliberately not counted (the clock already holds it).
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
  method?: string,
): PourStep[] | null {
  return structuredPourSchedule(recipe, roastDate, now, method)?.steps ?? null;
}

/** The full schedule (steps + clock facts) for a structured percolation recipe. */
export function structuredPourSchedule(
  recipe: BrewRecipe,
  roastDate?: string,
  now: number = Date.now(),
  method?: string,
): PourSchedule | null {
  const src = recipe.pourSteps;
  if (!src || src.length === 0) return null;

  // Index of the last water-bearing step: everything after it is drawdown.
  let lastWaterIdx = -1;
  for (let i = 0; i < src.length; i++) if (src[i].waterGramsAtEnd != null) lastWaterIdx = i;
  if (lastWaterIdx < 0) return null;

  const milestones: Milestone[] = [];
  let last = -1;
  for (let i = 0; i < src.length; i++) {
    const s = src[i];
    if (s.waterGramsAtEnd != null) {
      milestones.push({
        grams: s.waterGramsAtEnd,
        temperatureC: s.temperatureC,
        notes: s.notes,
        pourDurationSec: s.durationSec,
      });
      last = milestones.length - 1;
    } else if (isAgitationStep(s.action) && last >= 0) {
      // Attach this agitation to the pour it follows (bloom-stir, post-pour
      // swirl, tap-to-level) — it becomes its own timed step.
      milestones[last].agitationAfter =
        s.action === "swirl" ? "swirl" : s.action === "agitate-bed" ? "tap" : "stir";
      milestones[last].agitationNote = s.notes;
      if (typeof s.durationSec === "number" && s.durationSec > 0) {
        milestones[last].agitationDurationSec = s.durationSec;
      }
    } else if (s.action === "wait" && last >= 0 && i < lastWaterIdx) {
      // The recipe's own rest between two pours. Kept verbatim — this is the
      // cadence (Kasuya's 35 s, Hoffmann's 10 s). Waits AFTER the last pour are
      // the drawdown and are excluded by the `i < lastWaterIdx` guard.
      milestones[last].restAfterSec =
        (milestones[last].restAfterSec ?? 0) + Math.max(0, s.durationSec ?? 0);
    }
  }
  return buildPourSchedule(milestones, recipe.targetTimeSec, roastDate, now, method);
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
export function isSetupAction(action: BrewStepAction, label: string): boolean {
  if (action === "invert") return true;
  return /^\s*(assemble|position|set.?up|load|rinse|place)\b/i.test(label);
}

/** Sensible duration when a structured step omits one. */
export function defaultDuration(action: BrewStepAction): number {
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

/**
 * The longest gap between consecutive pours on the RENDERED percolation timeline
 * — the derived dead time the timer actually SHOWS, not the recipe's authored
 * numbers. `buildPourOver` spreads a recipe's pours across its `targetTimeSec`
 * and reserves the drawdown tail, so a recipe with FEW pours over a LONG clock
 * renders a big hole even though every authored pour is short: bloom + 2 pours
 * at 5:00 collapses to ONE ~2.5-minute gap. That is exactly the "3–4 pours and
 * pour 2 was somehow 2 minutes" the owner reported — a stalled brew that
 * over-extracts and tastes bad. `hasLongDesignedWait` cannot see it (it reads
 * authored durations); this reads the schedule the user brews from.
 *
 * Returns 0 for immersion-shaped recipes (a steep is intentional there) and when
 * no percolation schedule can be built (prose-only / <2 water pours).
 */
export function maxRenderedPourGapSec(
  recipe: BrewRecipe,
  roastDate?: string,
  now: number = Date.now(),
  method?: string,
): number {
  const schedule = pourScheduleFor(recipe, roastDate, now, method);
  if (!schedule) return 0;
  const water = schedule.steps.filter((s) => s.pourGrams > 0);
  let max = 0;
  for (let i = 0; i < water.length - 1; i++) {
    const pour = water[i];
    // When this pour finishes, at its RENDERED rate — mirrors validateRecipe's
    // dead-gap check so the two surfaces agree on what a hole is.
    const poursUntil = pour.startTimeSec + pour.timingDurationSec;
    const gap = water[i + 1].startTimeSec - poursUntil;
    if (gap > max) max = gap;
  }
  return max;
}
