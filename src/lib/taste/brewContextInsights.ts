import type { Session } from "@/lib/types/session";
import { resolveBrewedRecipe } from "@/lib/utils/resolveRecipe";

/**
 * "What works for you" — conditional on the KIND of coffee, in sentences.
 *
 * This replaces a marginal-average table (temperature / ratio / grind, each
 * averaged over every brew) that was actively misleading. Its rows invited the
 * reader to take the best band from each and compose them: 89 degrees, 1:13,
 * 384 on the Niche — cold, tight and fine at once, a brew nobody would make.
 * A dial only means something CONDITIONAL on the bean, and averaging one dial
 * across 63 different coffees washes the bean out of the number entirely.
 *
 * So: segment first (origin family x process — "African naturals", "Latin
 * American washed"), then inside ONE segment compare the brews the user
 * clearly liked against the ones they clearly didn't, and report only a dial
 * that actually separates the two. One segment, one sentence, no table of
 * knobs to mix and match.
 *
 * The thresholds below exist because the underlying ratings are tightly
 * clustered — most brews land near 4 stars — so a 0.2-star difference between
 * two bands is noise wearing a bold font. Nothing is emitted unless there are
 * enough brews on BOTH sides and the dial separation is bigger than the
 * everyday scatter of that dial. When nothing clears the bar, the honest
 * output is no sentence at all.
 */

/** A segment needs this many rated brews before it can say anything. */
export const MIN_SEGMENT_BREWS = 8;
/** ...and this many on each side of the comparison. */
export const MIN_GROUP_BREWS = 4;
/** Clear hits vs clear misses. The middle is dropped on purpose: splitting a
 *  pile of 4-star brews down the middle produces two arbitrary halves. */
export const HIT_RATING = 4.5;
export const MISS_RATING = 3.5;

/** Minimum separation before a dial is worth mentioning, in that dial's units. */
const MIN_DELTA = {
  temp: 1.5, // °C
  ratio: 0.7, // water per gram of coffee
  niche: 6, // degrees
  clicks: 1.5, // Comandante clicks
} as const;

export interface ContextInsight {
  /** e.g. "African naturals". */
  segment: string;
  brews: number;
  hits: number;
  misses: number;
  /** Ready-to-render sentence, no further formatting needed. */
  sentence: string;
}

export interface ContextInsightsResult {
  insights: ContextInsight[];
  /** Segments that were big enough to look at but showed no separation. */
  inconclusiveSegments: string[];
}

const ORIGIN_FAMILIES: Array<[string, string[]]> = [
  [
    "African",
    ["ethiopia", "kenya", "burundi", "rwanda", "tanzania", "uganda", "congo", "zambia", "malawi"],
  ],
  [
    "Latin American",
    [
      "colombia", "brazil", "brasil", "costa rica", "guatemala", "honduras", "peru", "bolivia",
      "el salvador", "nicaragua", "panama", "mexico", "ecuador", "venezuela",
    ],
  ],
  [
    "Asian & Pacific",
    ["indonesia", "sumatra", "java", "sulawesi", "india", "papua", "vietnam", "thailand", "china", "yemen", "timor"],
  ],
];

function originFamily(origin: string | undefined): string | null {
  const o = (origin ?? "").toLowerCase().trim();
  if (!o) return null;
  for (const [label, countries] of ORIGIN_FAMILIES) {
    if (countries.some((c) => o.includes(c))) return label;
  }
  return null;
}

function processLabel(process: string | undefined): string | null {
  const p = (process ?? "").toLowerCase();
  if (!p) return null;
  // Anaerobic/experimental first — those strings often also contain "natural".
  if (p.includes("anaerobic") || p.includes("carbonic") || p.includes("ferment")) return "anaerobics";
  if (p.includes("honey")) return "honeys";
  if (p.includes("natural") || p.includes("dry")) return "naturals";
  if (p.includes("washed") || p.includes("wet")) return "washed";
  return null;
}

function segmentOf(s: Session): string | null {
  const family = originFamily(s.coffee?.origin);
  const process = processLabel(s.coffee?.process);
  if (!family || !process) return null;
  // "African naturals", "Latin American washed" — reads as a sentence subject.
  return `${family} ${process}`;
}

interface Dials {
  temp?: number;
  ratio?: number;
  niche?: number;
  clicks?: number;
}

function grindReading(raw: string | undefined): { value: number; unit: "niche" | "clicks" } | null {
  if (!raw) return null;
  const text = raw.toLowerCase();
  const m = text.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const value = parseFloat(m[1]);
  if (!Number.isFinite(value)) return null;
  if (text.includes("click") || text.includes("comandante")) return { value, unit: "clicks" };
  if (text.includes("°") || text.includes("niche")) return { value, unit: "niche" };
  // The two grinders' scales don't overlap, so the magnitude is enough.
  if (value >= 300) return { value, unit: "niche" };
  if (value <= 60) return { value, unit: "clicks" };
  return null;
}

function dialsOf(s: Session): Dials | null {
  const recipe = resolveBrewedRecipe(s).recipe;
  if (!recipe) return null;
  const out: Dials = {};

  const t = recipe.waterTempC;
  if (typeof t === "number" && t >= 70 && t <= 100) out.temp = t;

  const dose = recipe.doseGrams;
  const water = recipe.waterGrams;
  if (typeof dose === "number" && dose > 0 && typeof water === "number" && water > 0) {
    const r = water / dose;
    if (r >= 8 && r <= 22) out.ratio = r;
  }

  const g = grindReading(recipe.grindSize);
  if (g?.unit === "niche") out.niche = g.value;
  if (g?.unit === "clicks") out.clicks = g.value;

  return Object.keys(out).length > 0 ? out : null;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Phrase one separating dial in plain language, hits relative to misses. */
function phrase(dial: keyof Dials, hit: number, miss: number): string {
  switch (dial) {
    case "temp":
      return `${hit > miss ? "hotter" : "cooler"} water (${Math.round(hit)}° vs ${Math.round(miss)}°)`;
    case "ratio":
      return `${hit > miss ? "a leaner ratio" : "a tighter ratio"} (1:${round1(hit)} vs 1:${round1(miss)})`;
    case "niche":
      return `${hit > miss ? "a coarser grind" : "a finer grind"} (${Math.round(hit)}° vs ${Math.round(miss)}°)`;
    case "clicks":
      return `${hit > miss ? "a coarser grind" : "a finer grind"} (${round1(hit)} vs ${round1(miss)} clicks)`;
  }
}

export function buildContextInsights(sessions: Session[]): ContextInsightsResult {
  const bySegment = new Map<string, { hits: Dials[]; misses: Dials[]; total: number }>();

  for (const s of sessions) {
    const rating = s.result?.rating;
    if (typeof rating !== "number" || rating <= 0) continue;
    const segment = segmentOf(s);
    if (!segment) continue;
    const dials = dialsOf(s);
    if (!dials) continue;

    const bucket = bySegment.get(segment) ?? { hits: [], misses: [], total: 0 };
    bucket.total += 1;
    if (rating >= HIT_RATING) bucket.hits.push(dials);
    else if (rating <= MISS_RATING) bucket.misses.push(dials);
    bySegment.set(segment, bucket);
  }

  const insights: ContextInsight[] = [];
  const inconclusiveSegments: string[] = [];

  for (const [segment, { hits, misses, total }] of Array.from(bySegment.entries())) {
    if (total < MIN_SEGMENT_BREWS) continue;
    if (hits.length < MIN_GROUP_BREWS || misses.length < MIN_GROUP_BREWS) {
      inconclusiveSegments.push(segment);
      continue;
    }

    // Rank the dials that genuinely separate the two groups, strongest first.
    const separating: Array<{ dial: keyof Dials; hit: number; miss: number; strength: number }> = [];
    for (const dial of ["temp", "ratio", "niche", "clicks"] as const) {
      const h = hits.map((d) => d[dial]).filter((v): v is number => typeof v === "number");
      const m = misses.map((d) => d[dial]).filter((v): v is number => typeof v === "number");
      if (h.length < MIN_GROUP_BREWS || m.length < MIN_GROUP_BREWS) continue;
      const hv = mean(h);
      const mv = mean(m);
      const delta = Math.abs(hv - mv);
      if (delta < MIN_DELTA[dial]) continue;
      separating.push({ dial, hit: hv, miss: mv, strength: delta / MIN_DELTA[dial] });
    }

    if (separating.length === 0) {
      inconclusiveSegments.push(segment);
      continue;
    }

    separating.sort((a, b) => b.strength - a.strength);
    // Two at most. A third clause turns the finding back into a list of knobs.
    const parts = separating.slice(0, 2).map((s) => phrase(s.dial, s.hit, s.miss));
    const joined = parts.length === 2 ? `${parts[0]} and ${parts[1]}` : parts[0];

    insights.push({
      segment,
      brews: total,
      hits: hits.length,
      misses: misses.length,
      sentence: `Your best ${segment} took ${joined}.`,
    });
  }

  insights.sort((a, b) => b.brews - a.brews);
  return { insights, inconclusiveSegments: inconclusiveSegments.sort() };
}
