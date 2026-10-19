/**
 * How long a percolation brew drains after its last pour — the one part of the
 * clock the recipe cannot dictate, because it is the BED that decides it: the
 * grind, the bean, the brewer's geometry, the water temperature.
 *
 * WHY THIS EXISTS (Oct 2026, Vanilla Gorilla on the Origami wave). The model
 * wrote a 4:00 clock for pours that ended at 2:40; the old timing calibration
 * then added the median (actual − target) of three past Origami brews — +35 s —
 * and promised 4:35. The cup was through at 3:44. Two mistakes in one: the
 * model's clock was a guess, and the correction compared TOTAL times of brews
 * whose pour phases were different. What carries over from one brew to the next
 * on the same brewer is not the total, it is the DRAWDOWN — actual finish minus
 * the moment the last pour ended. That brew: 224 s − 162 s = 62 s.
 *
 * So the clock is now:   end of the pour phase + the drawdown for this setup,
 * where the drawdown is, in order:
 *   1. MEASURED — the median of the owner's own drawdowns on the same EXACT
 *      brewer (exactBrewerKey: each Orea bottom on its own, Origami wave vs
 *      cone, the Drip Assist its own bucket) at a similar volume (±20 % /
 *      ±60 g), at least 2 brews. The end of the pour phase is read off the
 *      Acaia curve when there is one (`flowAnalysis.perPour`), else the
 *      timeline the brew was composed with, else rendered from the recipe.
 *   2. DISC — with the Drip Assist and no disc history: the bare drawdown kept
 *      at DRIP_ASSIST_DRAWDOWN_KEEP (an estimate; direction owner-confirmed).
 *   3. CORPUS — the median rendered drawdown of the published recipes for this
 *      brewer within ±20 % of the water, unscaled (no source gives a slope);
 *      with fewer than 3 such recipes, the brewer at any size, then its
 *      geometry group (flat-bed: Kalita, Origami wave, Orea; cone: V60, …).
 *
 * What is NOT modelled, deliberately: no slope from grind, temperature, water
 * hardness or bean age to drain time exists in any source this repo cites, and
 * inventing one would violate the never-fabricate rule. Those effects reach the
 * clock the honest way — through the owner's measured drawdowns, which already
 * contain his grinder, his water and his beans.
 */
import { ALL_RECIPES } from "@/lib/knowledge/recipes";
import { batchWithinWindow } from "@/lib/recipe/batchWindow";
import { daysSinceRoast, freshnessBucket } from "@/lib/coffee/freshness";
import type { BrewRecipe, Session } from "@/lib/types/session";
import { brewMethodKey, exactBrewerKey } from "@/lib/utils/brewMethodKey";
import { isDripAssistMethod } from "@/lib/utils/dripAssist";
import {
  MAX_DRAWDOWN_ABS_SEC,
  MIN_DRAWDOWN_SEC,
  hasImmersionShape,
  pourScheduleFor,
} from "@/lib/utils/pourSequence";
import { resolveBrewedRecipe } from "@/lib/utils/resolveRecipe";

/** The Drip Assist distributes water across the whole bed, so it drains almost
 * as fast as it is poured. Estimate — direction owner-confirmed, magnitude to be
 * replaced by his own disc measurements as soon as there are two. */
export const DRIP_ASSIST_DRAWDOWN_KEEP = 0.21;
export const DRIP_ASSIST_DRAWDOWN_FLOOR_SEC = 10;

/** Fewer measured brews than this and the corpus/disc estimate is used. Same
 * floor as the timing and grind calibrations (owner decision, Oct 2026). */
export const MIN_MEASURED_DRAWDOWNS = 2;

/** Sessions before the cadence-first renderer (#579) were brewed against a
 * schedule that no longer exists; without a scale curve their pour-phase end
 * can't be reconstructed, so they are not used. */
const CADENCE_FIRST_SINCE_MS = Date.parse("2026-09-29T00:00:00Z");

export interface DrawdownEstimate {
  sec: number;
  source: "measured" | "disc" | "corpus";
  /** Samples behind the number (measured brews or corpus recipes). */
  count: number;
  /** One-line provenance for the log. */
  detail: string;
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const clampDrawdown = (sec: number) =>
  Math.max(MIN_DRAWDOWN_SEC, Math.min(MAX_DRAWDOWN_ABS_SEC, Math.round(sec)));

/** When the last pour of a logged brew actually ended, or null if unknowable. */
export function pourPhaseEndOf(s: Session, recipe: BrewRecipe | undefined, method: string): number | null {
  const createdMs = Date.parse(s.createdAt);
  // The timeline the brew was actually run against (snapshotted at save since
  // 2026-10-19) beats any re-render: a renderer change can never move the
  // owner's historical drawdowns again.
  const snap = s.brew?.timeline ?? recipe?.timeline;
  const schedule =
    recipe && !hasImmersionShape(recipe)
      ? pourScheduleFor(recipe, s.coffee?.roastDate, Number.isFinite(createdMs) ? createdMs : Date.now(), method)
      : null;

  const perPour = s.brew?.flowAnalysis?.perPour;
  const lastReach = perPour && perPour.length ? perPour[perPour.length - 1].actualSec : null;
  if (typeof lastReach === "number" && lastReach > 0) {
    // The scale saw the last gram land. Anything the recipe does AFTER the last
    // pour before the drawdown (a final swirl) is pour phase, not drainage.
    let trailing = 0;
    if (snap && snap.shape === "percolation") {
      const water = snap.steps.filter((p) => (p.pourGrams ?? 0) > 0);
      const last = water[water.length - 1];
      if (last) trailing = Math.max(0, snap.pourPhaseEndSec - (last.startSec + last.pourSec));
    } else if (schedule) {
      const water = schedule.steps.filter((p) => p.pourGrams > 0);
      const last = water[water.length - 1];
      if (last) trailing = Math.max(0, schedule.pourPhaseEndSec - (last.startTimeSec + last.timingDurationSec));
    }
    return lastReach + trailing;
  }
  if (snap && snap.shape === "percolation") return snap.pourPhaseEndSec;
  if (schedule && Number.isFinite(createdMs) && createdMs >= CADENCE_FIRST_SINCE_MS) {
    return schedule.pourPhaseEndSec;
  }
  return null;
}

/** One measured drawdown of the owner's, with the roast-age bucket of that brew. */
export interface MeasuredDrawdownSample {
  drawdownSec: number;
  ageBucket: "fresh" | "peak" | "older" | "unknown";
  sessionId: string;
}

function ageBucketAt(roastDate: string | undefined, atMs: number): MeasuredDrawdownSample["ageBucket"] {
  const b = freshnessBucket(daysSinceRoast(roastDate, atMs));
  if (b === "unknown") return "unknown";
  if (b === "too-fresh" || b === "very-fresh") return "fresh";
  if (b === "peak") return "peak";
  return "older";
}

/**
 * The owner's own measured drawdowns on this EXACT brewer (exactBrewerKey —
 * an Orea Fast is not an Orea Classic, 2026-10-19) at ±20 % water, each with
 * the roast-age bucket of that brew. The pour-phase end is the Acaia's last
 * reach when there is one, else the timeline the brew was composed with
 * (`brew.timeline`, snapshotted at save since 2026-10-19), else the legacy
 * renderer for sessions since the cadence-first schedule.
 */
export function measuredDrawdownSamples(
  pastSessions: Session[],
  method: string | undefined,
  waterGrams: number | undefined,
): MeasuredDrawdownSample[] {
  if (!method || typeof waterGrams !== "number" || !(waterGrams > 0)) return [];
  const key = exactBrewerKey(method);
  const tol = Math.max(60, waterGrams * 0.2);
  const out: MeasuredDrawdownSample[] = [];
  for (const s of pastSessions) {
    const actual = s.brew?.actualTimeSec;
    if (typeof actual !== "number" || !(actual > 0)) continue;
    const resolved = resolveBrewedRecipe(s);
    const m = s.brew?.methodUsed || resolved.method;
    if (exactBrewerKey(m) !== key) continue;
    const water = resolved.recipe?.waterGrams;
    if (typeof water !== "number" || Math.abs(water - waterGrams) > tol) continue;
    if (resolved.recipe && (resolved.recipe.iceGrams ?? 0) > 0) continue;
    const end = pourPhaseEndOf(s, resolved.recipe, m);
    if (end == null) continue;
    const dd = actual - end;
    // A drawdown past the absolute ceiling is a timer left running, not a bed.
    if (dd > 0 && dd <= MAX_DRAWDOWN_ABS_SEC) {
      const createdMs = Date.parse(s.createdAt);
      out.push({ drawdownSec: dd, ageBucket: ageBucketAt(s.coffee?.roastDate, Number.isFinite(createdMs) ? createdMs : Date.now()), sessionId: s.id });
    }
  }
  return out;
}

/** The owner's own measured drawdowns for this exact brewer at this volume (numbers only). */
export function measuredDrawdowns(
  pastSessions: Session[],
  method: string | undefined,
  waterGrams: number | undefined,
): number[] {
  return measuredDrawdownSamples(pastSessions, method, waterGrams).map((x) => x.drawdownSec);
}

// ── Corpus defaults ──────────────────────────────────────────────────────────

const FLAT_BED = new Set(["kalita", "origami-wave", "orea"]);
const CONE = new Set(["v60", "origami-cone", "origami", "cafec-flower", "solo-dripper", "conical-paper"]);

function geometryOf(family: string): "flat" | "cone" | string {
  if (FLAT_BED.has(family)) return "flat";
  if (CONE.has(family)) return "cone";
  return family;
}

const SPLIT_BUILD = /iced|bypass|flash|japanese/i;

interface CorpusSample {
  family: string;
  drawdownSec: number;
  waterGrams: number;
}

let corpusCache: CorpusSample[] | null = null;

/** Every published percolation recipe rendered through the real schedule, at a
 * fixed peak-window roast so the bloom shift is neutral. Built once. */
export function corpusDrawdownSamples(): CorpusSample[] {
  if (corpusCache) return corpusCache;
  const now = Date.parse("2026-09-29T08:00:00Z");
  const peakRoast = "2026-09-15";
  const out: CorpusSample[] = [];
  for (const r of ALL_RECIPES) {
    if (!Array.isArray(r.pourSequence) || (r.totalTimeSec ?? 0) >= 3600) continue;
    if (SPLIT_BUILD.test(r.id) || (r.bestFor?.occasions ?? []).includes("summer-time")) continue;
    if (r.pourSequence.some((s) => s.action === "bypass")) continue;
    const recipe: BrewRecipe = {
      doseGrams: r.dose.grams,
      waterGrams: r.water.grams,
      waterTempC: r.temperature?.celsius ?? 93,
      grindSize: "",
      targetTimeSec: r.totalTimeSec,
      pourSteps: r.pourSequence.map((s) => ({
        label: s.label,
        action: s.action,
        ...(typeof s.waterGramsAtEnd === "number" ? { waterGramsAtEnd: s.waterGramsAtEnd } : {}),
        ...(typeof s.durationSec === "number" ? { durationSec: s.durationSec } : {}),
      })),
    };
    if (hasImmersionShape(recipe)) continue;
    const schedule = pourScheduleFor(recipe, peakRoast, now, r.brewer);
    if (!schedule) continue;
    out.push({
      family: brewMethodKey(r.brewer.replace(/-/g, " ")),
      drawdownSec: schedule.drawdownSec,
      waterGrams: r.water.grams,
    });
  }
  corpusCache = out;
  return out;
}

/**
 * The published-recipe drawdown for this brewer at about this volume: the
 * median of the brewer's recipes within ±20 % water, UNSCALED (2026-10-19 —
 * no source publishes a drawdown-vs-volume slope, so none is applied); with
 * fewer than 3 such recipes the brewer at any volume, then its geometry group.
 */
export function corpusDrawdownSec(
  method: string | undefined,
  waterGrams: number,
): { sec: number; count: number; basis: string } | null {
  const family = brewMethodKey(method).replace(/\+drip-assist$/, "");
  const all = corpusDrawdownSamples();
  const near = (s: CorpusSample) => batchWithinWindow(s.waterGrams, waterGrams);
  let pool = all.filter((s) => s.family === family && near(s));
  let basis = `${family} at ~${Math.round(waterGrams)} g`;
  if (pool.length < 3) {
    pool = all.filter((s) => s.family === family);
    basis = `${family} at any size`;
  }
  if (pool.length < 3) {
    const g = geometryOf(family);
    pool = all.filter((s) => geometryOf(s.family) === g);
    basis = `${g} geometry`;
  }
  if (pool.length === 0) return null;
  return { sec: median(pool.map((s) => s.drawdownSec)), count: pool.length, basis };
}

/**
 * The drawdown to promise for this brew. Null only when nothing at all is known
 * (an unknown brewer with no history) — the caller then leaves the clock alone.
 */
export function drawdownFor(
  pastSessions: Session[],
  method: string | undefined,
  waterGrams: number,
): DrawdownEstimate | null {
  const measured = measuredDrawdowns(pastSessions, method, waterGrams);
  if (measured.length >= MIN_MEASURED_DRAWDOWNS) {
    return {
      sec: clampDrawdown(median(measured)),
      source: "measured",
      count: measured.length,
      detail: `median of ${measured.length} measured ${exactBrewerKey(method)} drawdowns at ~${waterGrams}g`,
    };
  }

  if (isDripAssistMethod(method)) {
    const bareMethod = (method ?? "").replace(/\+?\s*drip[\s-]?assist/i, "").trim();
    const bare = drawdownFor(pastSessions, bareMethod, waterGrams);
    if (!bare) return null;
    const sec = Math.max(DRIP_ASSIST_DRAWDOWN_FLOOR_SEC, Math.round(bare.sec * DRIP_ASSIST_DRAWDOWN_KEEP));
    return {
      sec: clampDrawdown(sec),
      source: "disc",
      count: bare.count,
      detail: `disc keeps ${DRIP_ASSIST_DRAWDOWN_KEEP} of the bare ${bare.sec}s (${bare.detail})`,
    };
  }

  const corpus = corpusDrawdownSec(method, waterGrams);
  if (!corpus) return null;
  return {
    sec: clampDrawdown(corpus.sec),
    source: "corpus",
    count: corpus.count,
    detail: `published-recipe median for ${corpus.basis} (${corpus.count} recipes)`,
  };
}
