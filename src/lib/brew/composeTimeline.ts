/**
 * ONE timeline per recipe, composed once on the server, shown verbatim.
 *
 * Until 2026-10-19 the clock the owner brewed against had no single author:
 * the server stamped pour seconds (applyPourDurations), set a clock
 * (enforceRecipePhysics), overwrote it (calibrateDrawdownClock), and the
 * client then rebuilt the whole schedule with its own render time and roast
 * date (buildPourSchedule), shifting the first rest by roast age and treating
 * the drawdown as "whatever the clock has left". Kasuya's 10 s pours became
 * 11 s, his 35 s drawdown 38 s, his first 40 % pour a "Bloom" whose rest moved
 * with the roast date, and a recipe with no wait steps got rests back-derived
 * from a clock the server had already replaced. Owner: "Timings stimmen nicht."
 *
 * The rules now, in order:
 *
 *  (a) A VERIFIED reference on this brewer within ±20 % of its published water
 *      keeps the AUTHOR'S CADENCE: every pour starts when the author starts it;
 *      a pour's seconds are its grams at the author's own pour rate (no √k);
 *      the rests absorb the difference so the starts hold; the drawdown is the
 *      author's published one, unscaled — "published".
 *  (b) Any other recipe is the model's own: its steps verbatim. A pour with
 *      plausible seconds (2–8 g/s) keeps them; one over 8 g/s is stretched to
 *      8 (nobody pours faster); one with none or under 2 g/s (a rest folded
 *      into the step) pours at the owner's MEASURED pace for that brewer, 4 g/s
 *      when nothing is measured. Waits are kept exactly. A recipe with no waits
 *      at all gets HOUSE_REST_SEC between its pours, said so.
 *  (c) The drawdown without a reference is the owner's MEASURED median on this
 *      EXACT brewer (an Orea Fast is not an Orea Classic) at ±20 % water,
 *      preferring the same roast-age bucket when he has three brews there —
 *      "measured", with the basis stated; else the corpus median of the
 *      brewer's published recipes within ±20 % water, unscaled — "estimate".
 *  (d) NO roast-age shift. The roast age goes to the model as information and
 *      the bloom is the model's to choose; the timeline shows what it chose.
 *  (e) Whole seconds. No 5-second rounding.
 *  (f) The only physics: milestones monotonic (else the recipe is unbrewable),
 *      pour rate ≤ MAX_POUR_RATE_GPS. The vessel cap is checked by the caller.
 *
 * Immersion (Clever / AeroPress / cold steep): the steps ARE the clock. Pure.
 */
import { brewerMatchesReference, referenceAppliesAtBatch, resolveReference } from "@/lib/claude/recipeFidelity";
import { daysSinceRoast, freshnessBucket } from "@/lib/coffee/freshness";
import type { Recipe } from "@/lib/knowledge/recipes/types";
import type { BrewPourStep, BrewRecipe, RecipeTimeline, RecipeTimelineStep, Session } from "@/lib/types/session";
import { brewMethodKey, exactBrewerKey } from "@/lib/utils/brewMethodKey";
import { isDripAssistMethod } from "@/lib/utils/dripAssist";
import {
  MAX_POUR_RATE_GPS,
  MIN_POUR_RATE_GPS,
  POUR_RATE_GPS,
  buildGuideSteps,
  hasImmersionShape,
} from "@/lib/utils/pourSequence";
import { corpusDrawdownSec, measuredDrawdownSamples } from "./drawdown";
import { measuredPourPace } from "./pourPace";

/** The rest between pours when a recipe authored none at all — stated, never hidden. */
export const HOUSE_REST_SEC = 30;
/** When nothing at all is known about a brewer's drain, the clock still has to end somewhere. */
export const UNKNOWN_DRAWDOWN_SEC = 60;
/** Measured drawdowns in the SAME roast-age bucket outrank the pooled ones from this many. */
export const MIN_SAME_AGE_SAMPLES = 3;
/** Fewer measured drawdowns than this and the corpus estimate is used. */
export const MIN_MEASURED_SAMPLES = 2;

const WATER = new Set(["bloom", "pour", "final", "melodrip"]);
const AGITATION = new Set(["stir", "swirl", "agitate-bed"]);

export interface ComposeContext {
  method?: string;
  basedOn?: string;
  pastSessions?: Session[];
  /** This bag's roast date — only for the drawdown's age bucket, never for a shift. */
  roastDate?: string;
  now?: number;
}

export type ComposeResult = { ok: true; timeline: RecipeTimeline } | { ok: false; reason: string };

export type AgeBucket = "fresh" | "peak" | "older" | "unknown";
export function ageBucketOf(roastDate: string | undefined, atMs: number): AgeBucket {
  const b = freshnessBucket(daysSinceRoast(roastDate, atMs));
  if (b === "unknown") return "unknown";
  if (b === "too-fresh" || b === "very-fresh") return "fresh";
  if (b === "peak") return "peak";
  return "older";
}

const isWater = (s: BrewPourStep) => WATER.has(s.action) && typeof s.waterGramsAtEnd === "number";

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** The author's own pour rate for a published step, UNCAPPED — a verified
 * author who pours 130 g in 15 s (Rao) is not falsified to 8 g/s; the cap is
 * for the model's own recipes. A folded rest (<2 g/s, the Orea Wide /
 * Christensen convention) or a missing time reads as "at the owner's pace". */
function authorRate(grams: number, authoredSec: number | undefined, pace: number): number {
  if (!authoredSec || authoredSec <= 0 || grams <= 0) return pace;
  const r = grams / authoredSec;
  if (r < MIN_POUR_RATE_GPS) return pace;
  return r;
}

/**
 * The author's cadence: the published start of every water step, its grams,
 * and the author's own pour-phase end — the last pour's end (its authored
 * seconds when they are a pour, the owner's pace when they are a folded rest
 * or missing) plus any agitation that follows it directly. What the author
 * publishes AFTER that (a drain, a wait, a swirl during the drain) is his
 * drawdown: `totalTimeSec - pourEnd`.
 */
function publishedCadence(
  ref: Recipe,
  pace: number,
): { starts: number[]; refGrams: number[]; refPourSec: number[]; pourEnd: number } | null {
  const seq = ref.pourSequence ?? [];
  const starts: number[] = [];
  const refGrams: number[] = [];
  const refPourSec: number[] = [];
  let clock = 0;
  let prev = 0;
  let lastWaterIdx = -1;
  for (let i = 0; i < seq.length; i++) if (typeof seq[i].waterGramsAtEnd === "number" && WATER.has(seq[i].action)) lastWaterIdx = i;
  if (lastWaterIdx < 0) return null;
  let pourEnd = 0;
  for (let i = 0; i <= lastWaterIdx; i++) {
    const s = seq[i];
    if (typeof s.waterGramsAtEnd === "number" && WATER.has(s.action)) {
      const g = s.waterGramsAtEnd - prev;
      prev = s.waterGramsAtEnd;
      starts.push(clock);
      refGrams.push(g);
      const sec = g / authorRate(g, s.durationSec, pace);
      refPourSec.push(sec);
      // An untimed pour occupies its pace-time on the author's clock; a timed
      // one its authored block (pour, or pour + folded rest).
      clock += s.durationSec && s.durationSec > 0 ? s.durationSec : sec;
      pourEnd = starts[starts.length - 1] + sec;
      continue;
    }
    clock += Math.max(0, s.durationSec ?? 0);
  }
  for (let i = lastWaterIdx + 1; i < seq.length; i++) {
    const s = seq[i];
    if (!AGITATION.has(s.action)) break;
    pourEnd += Math.max(0, s.durationSec ?? 0);
  }
  if (refGrams.some((g) => !(g > 0))) return null;
  return { starts, refGrams, refPourSec, pourEnd };
}

/** A published drawdown shorter than this is "the author gives no drain" — his total ends with the pour. */
const MIN_PUBLISHED_DRAWDOWN_SEC = 5;

/**
 * The drawdown for this brew, with its provenance. Measured first (exact
 * brewer, ±20 % water, same age bucket when there are enough), the disc
 * estimate for a locked Drip Assist with no disc history, then the corpus.
 */
export function drawdownWithSource(
  method: string | undefined,
  waterGrams: number,
  ctx: { pastSessions?: Session[]; roastDate?: string; now?: number },
): { sec: number; source: RecipeTimeline["drawdownSource"]; basis: string } {
  const now = ctx.now ?? Date.now();
  const samples = measuredDrawdownSamples(ctx.pastSessions ?? [], method, waterGrams);
  if (samples.length >= MIN_MEASURED_SAMPLES) {
    const bucket = ageBucketOf(ctx.roastDate, now);
    const same = bucket === "unknown" ? [] : samples.filter((s) => s.ageBucket === bucket);
    if (same.length >= MIN_SAME_AGE_SAMPLES) {
      return {
        sec: Math.round(median(same.map((s) => s.drawdownSec))),
        source: "measured",
        basis: `your ${same.length} ${exactBrewerKey(method)} brews at ~${Math.round(waterGrams)} g, ${bucket} roast age`,
      };
    }
    return {
      sec: Math.round(median(samples.map((s) => s.drawdownSec))),
      source: "measured",
      basis: `your ${samples.length} ${exactBrewerKey(method)} brews at ~${Math.round(waterGrams)} g`,
    };
  }
  if (isDripAssistMethod(method)) {
    const bare = (method ?? "").replace(/\+?\s*drip[\s-]?assist/i, "").trim();
    const base = drawdownWithSource(bare, waterGrams, ctx);
    // The disc distributes water across the whole bed, so it drains almost as
    // fast as it is poured — an estimate (direction owner-confirmed) until he
    // has two measured disc brews.
    return { sec: Math.max(10, Math.round(base.sec * 0.21)), source: "estimate", basis: `disc estimate: about a fifth of the bare ${base.sec} s (${base.basis})` };
  }
  const corpus = corpusDrawdownSec(method, waterGrams);
  if (corpus) {
    return { sec: Math.round(corpus.sec), source: "estimate", basis: `published-recipe median for ${corpus.basis} (${corpus.count} recipes) — not measured on your kit yet` };
  }
  return { sec: UNKNOWN_DRAWDOWN_SEC, source: "estimate", basis: "nothing measured or published for this brewer — a placeholder until you have brewed it" };
}

/** Compose the timeline. Never throws; an unbrewable recipe comes back `ok: false`. */
export function composeTimeline(recipe: BrewRecipe, ctx: ComposeContext = {}): ComposeResult {
  const steps = Array.isArray(recipe.pourSteps) ? recipe.pourSteps : [];
  if (steps.length === 0) return { ok: false, reason: "no structured steps" };
  const now = ctx.now ?? Date.now();
  const composedAt = new Date(now).toISOString();

  // Milestones must rise — a plan that removes water has no honest repair.
  let prev = 0;
  for (const s of steps) {
    if (!isWater(s)) continue;
    const g = s.waterGramsAtEnd as number;
    if (g <= prev) return { ok: false, reason: `milestone ${g} g does not increase on the previous ${prev} g` };
    prev = g;
  }

  // ── Immersion / cold steep: the steps are the clock ──────────────────────
  const isCold = recipe.targetTimeSec >= 3600;
  if (isCold || hasImmersionShape(recipe)) {
    const guide = buildGuideSteps(recipe);
    if (!guide) return { ok: false, reason: "no guide steps" };
    let prevCum = 0;
    const out: RecipeTimelineStep[] = guide.map((g) => {
      const grams = typeof g.cumulativeGrams === "number" ? g.cumulativeGrams : undefined;
      const pourGrams = grams !== undefined && WATER.has(g.action) ? Math.max(0, grams - prevCum) : undefined;
      if (grams !== undefined) prevCum = grams;
      return {
        label: g.label,
        action: g.action,
        startSec: g.startTimeSec,
        pourSec: g.isSetup ? 0 : g.durationSec,
        restSec: 0,
        ...(grams !== undefined ? { gramsAtEnd: grams } : {}),
        ...(pourGrams !== undefined ? { pourGrams } : {}),
        ...(typeof g.temperatureC === "number" ? { temperatureC: g.temperatureC } : {}),
        ...(g.notes ? { notes: g.notes } : {}),
        ...(g.isSetup ? { isSetup: true } : {}),
      };
    });
    const end = out.reduce((m, s) => (s.isSetup ? m : Math.max(m, s.startSec + s.pourSec)), 0);
    const finishSec = isCold ? Math.max(recipe.targetTimeSec, end) : Math.max(end, 1);
    return {
      ok: true,
      timeline: {
        shape: "immersion",
        steps: out,
        pourPhaseEndSec: end,
        drawdownSec: Math.max(0, finishSec - end),
        drawdownSource: "published",
        drawdownBasis: isCold ? "cold steep — the clock is the steep" : "immersion — the steps are the clock",
        cadenceSource: "author",
        finishSec,
        composedAt,
      },
    };
  }

  // ── Percolation ──────────────────────────────────────────────────────────
  const waterIdx = steps.map((s, i) => (isWater(s) ? i : -1)).filter((i) => i >= 0);
  if (waterIdx.length < 1) return { ok: false, reason: "no water step" };
  const pace = measuredPourPace(ctx.pastSessions ?? [], ctx.method);
  const paceGps = pace.source === "house" ? POUR_RATE_GPS : pace.gps;

  // The author's cadence, when a verified reference applies on this brewer at this batch.
  const ref = resolveReference(ctx.basedOn);
  const refApplies =
    !!ref &&
    ref.verified &&
    brewerMatchesReference(ctx.method, ref) &&
    referenceAppliesAtBatch(ref, recipe.waterGrams);
  const cadence = refApplies && ref ? publishedCadence(ref, paceGps) : null;
  const authorCadence = !!cadence && cadence.starts.length === waterIdx.length;

  // Grams and pour seconds per water step.
  const grams: number[] = [];
  const pourSec: number[] = [];
  let usedPace = false;
  let cum = 0;
  waterIdx.forEach((idx, n) => {
    const s = steps[idx];
    const g = Math.max(0, (s.waterGramsAtEnd as number) - cum);
    cum = s.waterGramsAtEnd as number;
    grams.push(g);
    let sec: number;
    if (authorCadence && cadence) {
      // The author's own rate at this batch's grams: at his water exactly his
      // seconds, at ±20 % the same rate for the scaled pour.
      sec = cadence.refPourSec[n] * (g / cadence.refGrams[n]);
    } else {
      const authored = s.durationSec;
      const r = authored && authored > 0 ? g / authored : 0;
      if (authored && r >= MIN_POUR_RATE_GPS && r <= MAX_POUR_RATE_GPS) sec = authored;
      else if (authored && r > MAX_POUR_RATE_GPS) sec = g / MAX_POUR_RATE_GPS;
      else {
        sec = g / paceGps;
        usedPace = true;
      }
    }
    pourSec.push(Math.max(1, Math.round(sec)));
  });

  // Agitation and rests between water steps, from the recipe's own steps.
  // After the LAST pour: agitation that follows it directly is pour phase; a
  // wait or drain and THEN agitation (Crema's Chemex "final swirl" during the
  // drain) is a step inside the drawdown — kept, placed there, never counted
  // as pouring.
  type Agit = { action: BrewPourStep["action"]; label: string; sec: number; notes?: string };
  const agitationAfter: Agit[][] = waterIdx.map(() => []);
  const restAfter: number[] = waterIdx.map(() => 0);
  const inDrawdown: { afterSec: number; step: Agit }[] = [];
  let anyWait = false;
  waterIdx.forEach((idx, n) => {
    const last = n === waterIdx.length - 1;
    const stop = last ? steps.length : waterIdx[n + 1];
    let drainSec = 0;
    let pastDrain = false;
    for (let j = idx + 1; j < stop; j++) {
      const s = steps[j];
      const agit: Agit | null = AGITATION.has(s.action)
        ? { action: s.action, label: s.label, sec: Math.max(1, Math.round(s.durationSec ?? 5)), ...(s.notes ? { notes: s.notes } : {}) }
        : null;
      if (agit && !pastDrain) agitationAfter[n].push(agit);
      else if (agit && pastDrain) inDrawdown.push({ afterSec: drainSec, step: agit });
      else if (s.action === "wait" && !last) {
        anyWait = true;
        restAfter[n] += Math.max(0, s.durationSec ?? 0);
      } else if ((s.action === "wait" || s.action === "drain") && last) {
        pastDrain = true;
        drainSec += Math.max(0, s.durationSec ?? 0);
      }
    }
  });
  const houseRests = !anyWait && !authorCadence && waterIdx.length > 1;
  if (houseRests) for (let n = 0; n < waterIdx.length - 1; n++) restAfter[n] = HOUSE_REST_SEC;

  // Lay the steps out. Author cadence: the next pour starts where the author
  // starts it, shifted only when this batch's pour cannot finish in time.
  const out: RecipeTimelineStep[] = [];
  let clock = 0;
  let drift = 0;
  let pourPhaseEnd = 0;
  waterIdx.forEach((idx, n) => {
    const s = steps[idx];
    const start = clock;
    out.push({
      label: s.label,
      action: s.action,
      startSec: start,
      pourSec: pourSec[n],
      restSec: 0,
      gramsAtEnd: s.waterGramsAtEnd as number,
      pourGrams: grams[n],
      ...(typeof s.durationSec === "number" ? { authoredPourSec: s.durationSec } : {}),
      ...(typeof s.temperatureC === "number" ? { temperatureC: s.temperatureC } : {}),
      ...(s.notes ? { notes: s.notes } : {}),
    });
    let t = start + pourSec[n];
    pourPhaseEnd = t;
    for (const a of agitationAfter[n]) {
      out.push({ label: a.label, action: a.action, startSec: t, pourSec: a.sec, restSec: 0, ...(a.notes ? { notes: a.notes } : {}) });
      t += a.sec;
      pourPhaseEnd = t;
    }
    if (n < waterIdx.length - 1) {
      let next: number;
      if (authorCadence && cadence) {
        next = Math.max(cadence.starts[n + 1] + drift, t);
        drift = next - cadence.starts[n + 1];
      } else {
        next = t + restAfter[n];
      }
      // The rest lives on the last active step before the next pour.
      out[out.length - 1].restSec = Math.max(0, next - t);
      clock = next;
    }
  });

  const published =
    authorCadence && ref && cadence ? Math.round((ref.totalTimeSec ?? 0) - cadence.pourEnd) : 0;
  const dd =
    authorCadence && ref && published >= MIN_PUBLISHED_DRAWDOWN_SEC
      ? { sec: published, source: "published" as const, basis: `${ref.shortName || ref.name} publishes it` }
      : drawdownWithSource(ctx.method, recipe.waterGrams, { pastSessions: ctx.pastSessions, roastDate: ctx.roastDate, now });
  if (authorCadence && ref && published < MIN_PUBLISHED_DRAWDOWN_SEC) {
    dd.basis = `${ref.shortName || ref.name} publishes no drain — ${dd.basis}`;
  }
  let drawdownSec = Math.max(1, Math.round(dd.sec));
  let finishSec = pourPhaseEnd + drawdownSec;
  // Steps the recipe places inside the drawdown (a swirl during the drain).
  if (inDrawdown.length) {
    let t = pourPhaseEnd;
    for (const { afterSec, step } of inDrawdown) {
      const start = t + afterSec;
      out[out.length - 1].restSec = Math.max(0, start - t);
      out.push({ label: step.label, action: step.action, startSec: start, pourSec: step.sec, restSec: 0, ...(step.notes ? { notes: step.notes } : {}) });
      t = start + step.sec;
    }
    finishSec = Math.max(finishSec, t);
    drawdownSec = finishSec - pourPhaseEnd;
    out[out.length - 1].restSec = Math.max(0, finishSec - t);
  } else {
    out[out.length - 1].restSec = drawdownSec;
  }

  return {
    ok: true,
    timeline: {
      shape: "percolation",
      steps: out,
      pourPhaseEndSec: pourPhaseEnd,
      drawdownSec,
      drawdownSource: dd.source,
      drawdownBasis: dd.basis,
      cadenceSource: authorCadence ? "author" : houseRests ? "house" : usedPace && pace.source !== "house" ? "measured" : "model",
      finishSec,
      composedAt,
    },
  };
}

/** The brewer family the measured pace pools on — exported for the prompt's provenance line. */
export function paceFamilyOf(method?: string): string {
  return brewMethodKey(method);
}
