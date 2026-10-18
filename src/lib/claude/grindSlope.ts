/**
 * The owner's OWN grind slope — seconds of total brew time per Niche degree —
 * computed from his measured brews (2026-10-18).
 *
 * WHY THIS EXISTS: no source publishes how far a grind change moves the
 * drawdown (researched 2026-10-18), so the only honest slope is the owner's
 * own. Owner, 2026-10-18: from now on he taps Done only when the bed is dry —
 * `brew.doneAtDryBed` marks exactly those brews, so ONLY they count as a
 * measurement; older brews are never reinterpreted.
 *
 * A pair = the same coffee, the same brewer family, a batch within ±20 %, two
 * different grinds (≥3° apart), both measured. Slope = Δ total time / Δ degree.
 * Fewer than MIN_PAIRS pairs for a brewer × batch → no number at all.
 */
import type { Session } from "../types/session";
import { resolveBrewedRecipe } from "../utils/resolveRecipe";
import { brewMethodKey } from "../utils/brewMethodKey";
import { batchWithinWindow } from "../recipe/batchWindow";
import { grindStringToDegrees } from "./measuredGrind";

export const MIN_PAIRS = 2;
export const MIN_GRIND_DIFF_DEG = 3;

export interface MeasuredBrew {
  date: string;
  coffeeKey: string;
  coffeeLabel: string;
  methodKey: string;
  waterGrams: number;
  deg: number;
  totalSec: number;
}

export interface SlopePair {
  a: MeasuredBrew;
  b: MeasuredBrew;
  /** Seconds of total time per degree (negative: coarser = faster). */
  secPerDeg: number;
}

function coffeeKeyOf(s: Session): string {
  return s.coffee?.coffeeId || `${(s.coffee?.roaster ?? "").toLowerCase()}__${(s.coffee?.name ?? "").toLowerCase()}`;
}

/** The brews that are a drawdown measurement (Done tapped at a dry bed). */
export function measuredBrews(sessions: Session[]): MeasuredBrew[] {
  const out: MeasuredBrew[] = [];
  for (const s of sessions) {
    if (s.brew?.doneAtDryBed !== true) continue;
    const total = s.brew?.actualTimeSec;
    if (!(typeof total === "number" && total > 0)) continue;
    const resolved = resolveBrewedRecipe(s);
    const water = resolved.recipe?.waterGrams;
    if (!(typeof water === "number" && water > 0)) continue;
    const deg = grindStringToDegrees(s.brew?.grindSettingUsed ?? resolved.recipe?.grindSize);
    if (deg === null) continue;
    out.push({
      date: (s.createdAt ?? "").slice(0, 10),
      coffeeKey: coffeeKeyOf(s),
      coffeeLabel: s.coffee?.name ?? "?",
      methodKey: brewMethodKey(s.brew?.methodUsed || resolved.method),
      waterGrams: water,
      deg,
      totalSec: total,
    });
  }
  return out;
}

export function slopePairs(brews: MeasuredBrew[]): SlopePair[] {
  const pairs: SlopePair[] = [];
  for (let i = 0; i < brews.length; i++) {
    for (let j = i + 1; j < brews.length; j++) {
      const a = brews[i];
      const b = brews[j];
      if (a.coffeeKey !== b.coffeeKey || a.methodKey !== b.methodKey) continue;
      if (!batchWithinWindow(a.waterGrams, b.waterGrams)) continue;
      const dDeg = b.deg - a.deg;
      if (Math.abs(dDeg) < MIN_GRIND_DIFF_DEG) continue;
      pairs.push({ a, b, secPerDeg: (b.totalSec - a.totalSec) / dDeg });
    }
  }
  return pairs;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export interface GrindSlope {
  methodKey: string;
  secPerDeg: number;
  pairs: SlopePair[];
}

/** The owner's slope for this brewer family near this batch, or null. */
export function grindSlopeFor(sessions: Session[], method: string, waterGrams: number): GrindSlope | null {
  const key = brewMethodKey(method);
  const brews = measuredBrews(sessions).filter((b) => b.methodKey === key && batchWithinWindow(b.waterGrams, waterGrams));
  const pairs = slopePairs(brews);
  if (pairs.length < MIN_PAIRS) return null;
  return { methodKey: key, secPerDeg: median(pairs.map((p) => p.secPerDeg)), pairs };
}

/**
 * The grind that lands `targetSec`, by the owner's slope, from his newest
 * measured brew on this brewer × batch. Null without a slope or a brew.
 */
export function interpolateGrind(
  sessions: Session[],
  method: string,
  waterGrams: number,
  targetSec: number,
): { deg: number; from: MeasuredBrew; slope: GrindSlope } | null {
  const slope = grindSlopeFor(sessions, method, waterGrams);
  if (!slope || slope.secPerDeg === 0) return null;
  const key = brewMethodKey(method);
  const latest = measuredBrews(sessions)
    .filter((b) => b.methodKey === key && batchWithinWindow(b.waterGrams, waterGrams))
    .sort((x, y) => y.date.localeCompare(x.date))[0];
  if (!latest) return null;
  return { deg: Math.round(latest.deg + (targetSec - latest.totalSec) / slope.secPerDeg), from: latest, slope };
}

/** YOUR MEASURED GRIND SLOPE — "" when no brewer × batch has ≥ MIN_PAIRS pairs. */
export function formatGrindSlopeBlock(sessions: Session[], waterGrams: number | undefined): string {
  if (!waterGrams) return "";
  const brews = measuredBrews(sessions).filter((b) => batchWithinWindow(b.waterGrams, waterGrams));
  const keys = Array.from(new Set(brews.map((b) => b.methodKey)));
  const lines: string[] = [];
  for (const key of keys) {
    const pairs = slopePairs(brews.filter((b) => b.methodKey === key));
    if (pairs.length < MIN_PAIRS) continue;
    const m = median(pairs.map((p) => p.secPerDeg));
    lines.push(
      `- ${key} at ~${waterGrams} g: ${m.toFixed(1)} s per degree (median of ${pairs.length} pairs: ${pairs
        .slice(0, 4)
        .map((p) => `${p.a.coffeeLabel} ${Math.round(p.a.deg)}°→${Math.round(p.a.totalSec)} s vs ${Math.round(p.b.deg)}°→${Math.round(p.b.totalSec)} s`)
        .join("; ")})`,
    );
  }
  if (!lines.length) return "";
  return `\n\nYOUR MEASURED GRIND SLOPE — computed from the owner's own brews where he tapped Done at a dry bed (same coffee, same brewer, same batch, two grinds). A grind move on these brewers is planned with this slope, not guessed; state the arithmetic in whyChosen.\n${lines.join("\n")}`;
}
