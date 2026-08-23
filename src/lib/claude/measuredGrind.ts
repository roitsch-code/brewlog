/**
 * The owner's OWN measured grind, per brewer and batch size.
 *
 * Why this exists: every per-method grind default in `grindSettings.ts` except
 * the V60 row is marked `confidence: "estimate"` — carried over from an older
 * baseline and re-based, never measured. Meanwhile the app has logged the real
 * thing on every brew since the flow shipped: `brew.grindSettingUsed`, the
 * setting actually ground at, alongside the rating the cup earned. Timing
 * already learns this way (`measuredTimeDelta`); grind did not, so the model
 * kept being handed an estimate for the exact brewer the user owns and has
 * brewed on dozens of times.
 *
 * This is deliberately NOT a deterministic override, unlike the timing
 * calibration. Grind is bean-dependent — a 6-week-old natural and a fresh
 * washed Kenyan legitimately want different settings on the same brewer at the
 * same volume — so forcing a number would flatten exactly the variation the
 * recipe is supposed to express. That is the mistake the fidelity guard made
 * before it went per-field. It reports what the user has actually done and
 * lets the bean decide inside that range.
 *
 * No invented slope (Hard Rule): every number here is a median or an extreme of
 * the user's own logged settings. Where nothing was logged, the block is absent
 * rather than estimated.
 */

import type { Session } from "@/lib/types/session";
import { brewMethodKey } from "@/lib/utils/brewMethodKey";
import { LOOKS_LIKE_CLICKS, clicksToNiche, nicheToClicks, isComandante } from "@/lib/utils/grindUnit";

/** Below this many logged brews the spread is one bean's opinion, not a habit. */
const MIN_SAMPLES = 3;
/** A cup worth reproducing — same bar the own-reference recipes use. */
const GOOD_RATING = 4;
/** Keep the block a few lines: the brewers they actually use, not a census. */
const MAX_BREWERS = 4;

export interface MeasuredGrind {
  /** Canonical brewer family the samples were pooled under. */
  methodKey: string;
  /** The user's own most-used wording for this brewer — what they will recognise. */
  label: string;
  count: number;
  medianDeg: number;
  minDeg: number;
  maxDeg: number;
  /** The ≥4★ subset — the actual preference signal. Null under MIN_SAMPLES. */
  good: { count: number; medianDeg: number; minDeg: number; maxDeg: number } | null;
}

/** A logged grind string ("388°", "24 clicks", "medium-coarse") → Niche degrees.
 *  Mirrors `recipeFidelity.parseGrindDegrees`: the two scales cannot overlap by
 *  magnitude, so a bare number is unambiguous. Unparseable prose → null. */
export function grindStringToDegrees(grind: string | undefined): number | null {
  if (!grind) return null;
  const m = /(\d{1,3}(?:\.\d+)?)/.exec(grind);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return n <= LOOKS_LIKE_CLICKS ? clicksToNiche(n) : n;
}

/** The user's own most-used wording for a brewer, so the block reads in their terms. */
function mostCommon(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = values[0];
  let bestN = 0;
  counts.forEach((n, v) => {
    if (n > bestN) { best = v; bestN = n; }
  });
  return best;
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * What the user actually grinds at, per brewer, at roughly this batch size.
 *
 * Pools THEIR OWN sessions rather than mapping the corpus's brewer ids onto
 * method labels: the sessions already carry the user's own wording, and
 * `brewMethodKey` is the same canonicaliser the timing calibration pools by
 * (so "Orea Classic" from the flow and "Orea V4 Classic" from the chat land in
 * one bucket, while the Drip Assist stays its own — the disc changes flow).
 *
 * Volume-bucketed on the same tolerance as the timing calibration (±20% or
 * ±60g, whichever is wider) because grind scales with dose — pooling a 250ml
 * single cup with a 600ml batch would produce a median that fits neither.
 *
 * `lockedMethod`, when the user has locked a brewer in the flow, narrows the
 * table to that one. Otherwise every brewer they have enough brews on is
 * reported, most-brewed first, capped so the block stays a few lines.
 */
export function buildMeasuredGrind(
  pastSessions: Session[],
  waterGrams: number | undefined,
  lockedMethod?: string,
): MeasuredGrind[] {
  if (typeof waterGrams !== "number" || !(waterGrams > 0)) return [];
  const tol = Math.max(60, waterGrams * 0.2);
  const lockedKey = lockedMethod ? brewMethodKey(lockedMethod) : null;

  interface Bucket { all: number[]; good: number[]; labels: string[] }
  const buckets = new Map<string, Bucket>();
  for (const s of pastSessions) {
    const deg = grindStringToDegrees(s.brew?.grindSettingUsed);
    if (deg == null) continue;
    const raw = s.brew?.methodUsed || s.recommendation?.primaryMethod;
    if (!raw) continue;
    const key = brewMethodKey(raw);
    if (lockedKey && key !== lockedKey) continue;
    // Water actually used, else the recipe's — a followed-recipe brew logs no
    // water of its own.
    const water = s.brew?.waterGrams ?? s.recommendation?.primaryRecipe?.waterGrams;
    if (typeof water !== "number" || Math.abs(water - waterGrams) > tol) continue;

    let b = buckets.get(key);
    if (!b) {
      b = { all: [], good: [], labels: [] };
      buckets.set(key, b);
    }
    b.all.push(deg);
    b.labels.push(raw);
    const rating = s.result?.rating;
    if (typeof rating === "number" && rating >= GOOD_RATING) b.good.push(deg);
  }

  const out: MeasuredGrind[] = [];
  buckets.forEach((b, methodKey) => {
    if (b.all.length < MIN_SAMPLES) return;
    b.all.sort((x, y) => x - y);
    b.good.sort((x, y) => x - y);
    out.push({
      methodKey,
      label: mostCommon(b.labels),
      count: b.all.length,
      medianDeg: median(b.all),
      minDeg: b.all[0],
      maxDeg: b.all[b.all.length - 1],
      good:
        b.good.length >= MIN_SAMPLES
          ? {
              count: b.good.length,
              medianDeg: median(b.good),
              minDeg: b.good[0],
              maxDeg: b.good[b.good.length - 1],
            }
          : null,
    });
  });
  return out.sort((a, z) => z.count - a.count).slice(0, MAX_BREWERS);
}

/** Render in the unit the user's grinder speaks — a Comandante has no degrees. */
function inUnit(deg: number, grinder: string | undefined): string {
  return isComandante(grinder) ? `${nicheToClicks(deg)} clicks` : `${Math.round(deg)}°`;
}

/**
 * The MEASURED GRIND block. Empty string when nothing is measured — the model
 * then falls back to the general reference table, as it always has.
 */
export function formatMeasuredGrindForPrompt(
  table: MeasuredGrind[],
  grinder?: string,
): string {
  if (table.length === 0) return "";
  const lines = [
    `\nMEASURED GRIND — what this user actually grinds at, from their own logged brews at about this batch size:`,
  ];
  for (const g of table) {
    let line =
      `  ${g.label}: median ${inUnit(g.medianDeg, grinder)}, ` +
      `range ${inUnit(g.minDeg, grinder)}–${inUnit(g.maxDeg, grinder)} over ${g.count} brews`;
    if (g.good) {
      line +=
        `; their 4★+ cups sit at ${inUnit(g.good.medianDeg, grinder)} ` +
        `(${inUnit(g.good.minDeg, grinder)}–${inUnit(g.good.maxDeg, grinder)}, ${g.good.count} brews)`;
    }
    lines.push(line + ".");
  }
  lines.push(
    `  For these brewers this beats the general grind reference table: it is measured on their kit, water and technique, at this batch size.`,
    `  It is a centre of gravity, not a target — the bean still decides where inside it lands, or outside it for a reason you state.`,
  );
  return lines.join("\n") + "\n";
}
