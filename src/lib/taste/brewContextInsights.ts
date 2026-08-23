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

/**
 * Water is a CHOICE, not a reading, so it can't use MIN_DELTA's scatter logic:
 * the comparison is "how often was the clarity blend in the good cups vs the
 * bad ones". 40 percentage points is the floor — with 4–6 brews a side, a
 * smaller gap is one or two brews and means nothing. Both waters must also
 * genuinely appear in the segment, or a user who only ever used one would be
 * told his single habit is the reason.
 */
const MIN_WATER_SPLIT = 0.4;
const MIN_WATER_USES = 2;

/** One dial that separated the liked brews from the disliked ones. */
export interface SeparatingDial {
  dial: "temp" | "ratio" | "niche" | "clicks" | "water";
  /** Mean among the clear hits / the clear misses, in that dial's own unit. */
  hitValue: number;
  missValue: number;
  /** Printable unit suffix, e.g. "°C", "clicks", "" for a ratio. */
  unit: string;
}

export interface ContextInsight {
  /** e.g. "African naturals". */
  segment: string;
  brews: number;
  hits: number;
  misses: number;
  /** Ready-to-render sentence, no further formatting needed. */
  sentence: string;
  /** The same finding as raw figures — for surfaces that need exact numbers. */
  dials: SeparatingDial[];
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

/**
 * The segment a coffee belongs to, from its origin + process alone. Exported
 * so the greeting can ask the same question of a bag sitting in rotation —
 * one implementation, so a finding can never be matched to the wrong bag.
 */
export function segmentLabel(
  origin: string | undefined,
  process: string | undefined,
): string | null {
  const family = originFamily(origin);
  const proc = processLabel(process);
  if (!family || !proc) return null;
  // "African naturals", "Latin American washed" — reads as a sentence subject.
  return `${family} ${proc}`;
}

function segmentOf(s: Session): string | null {
  return segmentLabel(s.coffee?.origin, s.coffee?.process);
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

/**
 * The dials of ONE brew — what the user actually turned, not what the recipe
 * asked for.
 *
 * This reads `brew.actualTempC` / `brew.grindSettingUsed` FIRST and falls back
 * to the recipe only when the brew didn't record its own. Until 2026-08-23 it
 * read the recipe alone, which quietly made the whole analysis a study of the
 * RECIPES rather than of the user: every deviation — the grind nudged two
 * degrees coarser at the grinder, the kettle that landed at 96 instead of 94 —
 * was invisible, and a segment where the user consistently corrected the same
 * way looked like it had no separation at all. The fields are pre-filled from
 * the recipe and editable, so on a followed-to-the-letter brew both paths agree
 * and nothing changes; they diverge exactly when the user did something.
 *
 * Dose/water follow the same rule (`brew.*` is what external sessions carry),
 * so a café brew with no recipe attached can now contribute its ratio.
 */
function dialsOf(s: Session): Dials | null {
  const recipe = resolveBrewedRecipe(s).recipe;
  const b = s.brew;
  const out: Dials = {};

  const t = b?.actualTempC ?? recipe?.waterTempC;
  if (typeof t === "number" && t >= 70 && t <= 100) out.temp = t;

  const dose = b?.doseGrams ?? recipe?.doseGrams;
  const water = b?.waterGrams ?? recipe?.waterGrams;
  if (typeof dose === "number" && dose > 0 && typeof water === "number" && water > 0) {
    const r = water / dose;
    if (r >= 8 && r <= 22) out.ratio = r;
  }

  const g = grindReading(b?.grindSettingUsed ?? recipe?.grindSize);
  if (g?.unit === "niche") out.niche = g.value;
  if (g?.unit === "clicks") out.clicks = g.value;

  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Which water this brew used, or null when it wasn't recorded.
 *
 * Deliberately NOT defaulting to the daily water the way brewSignature does:
 * a signature needs a number for every brew, but a CONTRAST needs to know the
 * difference between "he used the daily water" and "nobody wrote it down".
 * Guessing here would manufacture a separation out of missing data.
 */
export function waterOf(s: Session): "clarity" | "daily" | null {
  const src = s.context?.waterSource;
  if (typeof src !== "string" || !src.trim()) return null;
  // "championship" is the flow's id for the 1:2 filtered+distilled clarity
  // blend (~73 ppm); "tap" is the BWT-filtered daily driver (~220 ppm), and
  // the legacy "diluted" (~150 ppm) sits on the daily side of the split.
  return src === "championship" ? "clarity" : "daily";
}

const UNIT: Record<keyof Dials | "water", string> = {
  temp: "°C",
  ratio: "", // rendered as a ratio, e.g. "1:15.4"
  niche: "° on the Niche",
  clicks: " Comandante clicks",
  water: "% clarity blend", // hit/miss values are shares, 0–100
};

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Phrase one separating dial in plain language, hits relative to misses. */
function phrase(dial: keyof Dials | "water", hit: number, miss: number): string {
  switch (dial) {
    case "water":
      // hit/miss are shares of clarity-blend use (0–1) in each group. Name the
      // water that dominates the GOOD cups; the figures carry the rest.
      return hit > miss
        ? `the clarity blend (${Math.round(hit * 100)}% of your best against ${Math.round(miss * 100)}% of your worst)`
        : `the daily BWT water (${Math.round((1 - hit) * 100)}% of your best against ${Math.round((1 - miss) * 100)}% of your worst)`;
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
  type Bucket = {
    hits: Dials[];
    misses: Dials[];
    /** Water per brew, hits and misses kept apart; unrecorded water is omitted. */
    hitWaters: Array<"clarity" | "daily">;
    missWaters: Array<"clarity" | "daily">;
    total: number;
  };
  const bySegment = new Map<string, Bucket>();

  for (const s of sessions) {
    const rating = s.result?.rating;
    if (typeof rating !== "number" || rating <= 0) continue;
    const segment = segmentOf(s);
    if (!segment) continue;
    const dials = dialsOf(s);
    if (!dials) continue;

    const bucket = bySegment.get(segment) ?? {
      hits: [], misses: [], hitWaters: [], missWaters: [], total: 0,
    };
    bucket.total += 1;
    const water = waterOf(s);
    if (rating >= HIT_RATING) {
      bucket.hits.push(dials);
      if (water) bucket.hitWaters.push(water);
    } else if (rating <= MISS_RATING) {
      bucket.misses.push(dials);
      if (water) bucket.missWaters.push(water);
    }
    bySegment.set(segment, bucket);
  }

  const insights: ContextInsight[] = [];
  const inconclusiveSegments: string[] = [];

  for (const [segment, { hits, misses, hitWaters, missWaters, total }] of Array.from(
    bySegment.entries(),
  )) {
    if (total < MIN_SEGMENT_BREWS) continue;
    if (hits.length < MIN_GROUP_BREWS || misses.length < MIN_GROUP_BREWS) {
      inconclusiveSegments.push(segment);
      continue;
    }

    // Rank the dials that genuinely separate the two groups, strongest first.
    const separating: Array<{
      dial: keyof Dials | "water";
      hit: number;
      miss: number;
      strength: number;
    }> = [];

    // Water competes for the same two clauses as the numeric dials — it is one
    // of the strongest levers in this setup (~220 ppm vs ~73 ppm), and leaving
    // it out was why the section could stare at a segment the user brews two
    // different ways and call it inconclusive.
    if (hitWaters.length >= MIN_GROUP_BREWS && missWaters.length >= MIN_GROUP_BREWS) {
      const clarityUses = [...hitWaters, ...missWaters].filter((w) => w === "clarity").length;
      const dailyUses = hitWaters.length + missWaters.length - clarityUses;
      if (clarityUses >= MIN_WATER_USES && dailyUses >= MIN_WATER_USES) {
        const hitShare = hitWaters.filter((w) => w === "clarity").length / hitWaters.length;
        const missShare = missWaters.filter((w) => w === "clarity").length / missWaters.length;
        const delta = Math.abs(hitShare - missShare);
        if (delta >= MIN_WATER_SPLIT) {
          separating.push({
            dial: "water",
            hit: hitShare,
            miss: missShare,
            strength: delta / MIN_WATER_SPLIT,
          });
        }
      }
    }
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
    const top = separating.slice(0, 2);
    const parts = top.map((s) => phrase(s.dial, s.hit, s.miss));
    const joined = parts.length === 2 ? `${parts[0]} and ${parts[1]}` : parts[0];

    insights.push({
      segment,
      brews: total,
      hits: hits.length,
      misses: misses.length,
      sentence: `Your best ${segment} took ${joined}.`,
      dials: top.map((s) => ({
        dial: s.dial,
        // Water is a share (0–1) — print it as a whole percentage so the
        // greeting's "exact figures" rule stays honest for it too.
        hitValue:
          s.dial === "water"
            ? Math.round(s.hit * 100)
            : s.dial === "ratio"
              ? round1(s.hit)
              : Math.round(s.hit * 10) / 10,
        missValue:
          s.dial === "water"
            ? Math.round(s.miss * 100)
            : s.dial === "ratio"
              ? round1(s.miss)
              : Math.round(s.miss * 10) / 10,
        unit: UNIT[s.dial],
      })),
    });
  }

  insights.sort((a, b) => b.brews - a.brews);
  return { insights, inconclusiveSegments: inconclusiveSegments.sort() };
}

/**
 * The findings, as EXACT figures, for the daily greeting — but only for
 * segments the user can actually act on right now.
 *
 * The greeting names a bag from the rotation, so a finding about African
 * naturals is only worth a word when an African natural is actually open on
 * the counter. Matching happens through segmentLabel(), the same function the
 * insights themselves were built with, so a finding can never be attached to
 * the wrong kind of coffee.
 *
 * The block prints the numbers rather than a paraphrase because a greeting
 * that says "a bit cooler" is worthless — the whole value is "92°C, not 97°C".
 * The prompt rule that goes with it forbids altering them.
 */
export function formatContextFindingsForGreeting(
  insights: ContextInsight[],
  rotation: Array<{ origin?: string; process?: string; roaster?: string; name?: string }>,
): string {
  const bySegment = new Map<string, string[]>();
  for (const bag of rotation) {
    const seg = segmentLabel(bag.origin, bag.process);
    if (!seg) continue;
    const label = [bag.roaster, bag.name].filter(Boolean).join(" ").trim();
    const list = bySegment.get(seg) ?? [];
    if (label) list.push(label);
    bySegment.set(seg, list);
  }

  const lines = insights
    .filter((i) => bySegment.has(i.segment))
    .map((i) => {
      const figures = i.dials
        .map((d) =>
          d.dial === "ratio"
            ? `1:${d.hitValue} vs 1:${d.missValue}`
            : `${d.hitValue}${d.unit} vs ${d.missValue}${d.unit}`,
        )
        .join(", ");
      const bags = bySegment.get(i.segment) ?? [];
      return `- ${i.segment}: your ${HIT_RATING}★+ brews ran ${figures} against your ${MISS_RATING}★-and-below ones (${i.hits} vs ${i.misses} brews). In rotation now: ${bags.join(", ") || "—"}.`;
    });

  if (lines.length === 0) return "";
  return `MEASURED CONTRAST (this user's own logged brews, for bags open right now)\n${lines.join("\n")}`;
}
