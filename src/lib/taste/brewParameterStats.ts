import type { Session } from "@/lib/types/session";
import { resolveBrewedRecipe } from "@/lib/utils/resolveRecipe";

/**
 * "What actually works for you" — the user's own brew PARAMETERS scored against
 * the ratings they gave.
 *
 * Distinct from the sensory correlations in patterns.ts, which relate how a cup
 * TASTED (body / acidity / clarity) to its rating. Those describe the cup after
 * the fact; these describe the dials the user can actually turn beforehand:
 * temperature, ratio, grind, dose. With 184 rated brews logged the buckets are
 * finally deep enough to mean something, which is the whole reason this exists.
 *
 * Honesty rules baked in, because this is the kind of screen that invites
 * over-reading:
 *   - a bucket needs MIN_SAMPLES brews before it is shown at all,
 *   - every row carries its own n so a 4-brew row can't pose as a 40-brew one,
 *   - a parameter with fewer than two qualifying buckets is dropped entirely —
 *     "94-96 degrees averages 4.2" says nothing without something to compare to,
 *   - grind buckets NEVER mix Niche degrees with Comandante clicks. They are
 *     different scales; averaging them would invent a number that means nothing.
 * No claim of causation is made anywhere — these are averages, and a bucket can
 * be high simply because the good coffees happened to land in it.
 */

export const MIN_SAMPLES = 4;

export interface ParameterBucket {
  /** Display label for the bucket, e.g. "94-96 degrees" or "1:15-1:16". */
  label: string;
  avgRating: number;
  count: number;
  /** Sort key so buckets render in natural order, not by score. */
  order: number;
}

export interface ParameterGroup {
  /** e.g. "Temperature", "Ratio", "Grind (Niche)". */
  title: string;
  /** One line of plain-English context under the title. */
  note: string;
  buckets: ParameterBucket[];
}

function push(
  acc: Map<string, { sum: number; count: number; order: number }>,
  label: string,
  order: number,
  rating: number,
) {
  const cur = acc.get(label) ?? { sum: 0, count: 0, order };
  cur.sum += rating;
  cur.count += 1;
  acc.set(label, cur);
}

function finish(
  acc: Map<string, { sum: number; count: number; order: number }>,
): ParameterBucket[] {
  return Array.from(acc.entries())
    .filter(([, v]) => v.count >= MIN_SAMPLES)
    .map(([label, v]) => ({
      label,
      avgRating: Math.round((v.sum / v.count) * 10) / 10,
      count: v.count,
      order: v.order,
    }))
    .sort((a, b) => a.order - b.order);
}

/** Niche settings are degrees (~350-450); Comandante settings are clicks (~15-45). */
function grindReading(raw: string | undefined): { value: number; unit: "niche" | "clicks" } | null {
  if (!raw) return null;
  const text = raw.toLowerCase();
  const num = text.match(/(\d+(?:\.\d+)?)/);
  if (!num) return null;
  const value = parseFloat(num[1]);
  if (!Number.isFinite(value)) return null;
  // Read the unit off the label where it is stated; fall back to the ranges,
  // which do not overlap for the two grinders in this kit.
  if (text.includes("click") || text.includes("comandante")) return { value, unit: "clicks" };
  if (text.includes("°") || text.includes("niche")) return { value, unit: "niche" };
  if (value >= 300) return { value, unit: "niche" };
  if (value <= 60) return { value, unit: "clicks" };
  return null;
}

export function buildBrewParameterStats(sessions: Session[]): ParameterGroup[] {
  const temp = new Map<string, { sum: number; count: number; order: number }>();
  const ratio = new Map<string, { sum: number; count: number; order: number }>();
  const niche = new Map<string, { sum: number; count: number; order: number }>();
  const clicks = new Map<string, { sum: number; count: number; order: number }>();

  for (const s of sessions) {
    const rating = s.result?.rating;
    if (!rating) continue;
    const recipe = resolveBrewedRecipe(s).recipe;
    if (!recipe) continue;

    const t = recipe.waterTempC;
    if (typeof t === "number" && t >= 70 && t <= 100) {
      if (t <= 90) push(temp, "90° and below", 0, rating);
      else if (t <= 93) push(temp, "91–93°", 1, rating);
      else if (t <= 96) push(temp, "94–96°", 2, rating);
      else push(temp, "97° and above", 3, rating);
    }

    const dose = recipe.doseGrams;
    const water = recipe.waterGrams;
    if (typeof dose === "number" && dose > 0 && typeof water === "number" && water > 0) {
      const r = water / dose;
      if (r >= 8 && r <= 22) {
        if (r < 14.5) push(ratio, "1:14 and tighter", 0, rating);
        else if (r < 16.5) push(ratio, "1:15–1:16", 1, rating);
        else push(ratio, "1:17 and leaner", 2, rating);
      }
    }

    const g = grindReading(recipe.grindSize);
    if (g?.unit === "niche") {
      if (g.value < 385) push(niche, "Below 385°", 0, rating);
      else if (g.value < 395) push(niche, "385–394°", 1, rating);
      else if (g.value < 405) push(niche, "395–404°", 2, rating);
      else push(niche, "405° and coarser", 3, rating);
    } else if (g?.unit === "clicks") {
      if (g.value < 24) push(clicks, "Under 24 clicks", 0, rating);
      else if (g.value < 28) push(clicks, "24–27 clicks", 1, rating);
      else push(clicks, "28 clicks and coarser", 2, rating);
    }
  }

  const groups: ParameterGroup[] = [
    {
      title: "Temperature",
      note: "Average rating of the brews you logged in each band.",
      buckets: finish(temp),
    },
    {
      title: "Ratio",
      note: "Water per gram of coffee, from the recipe you actually brewed.",
      buckets: finish(ratio),
    },
    {
      title: "Grind (Niche)",
      note: "Degrees only — Comandante clicks are a different scale and are listed separately.",
      buckets: finish(niche),
    },
    {
      title: "Grind (Comandante)",
      note: "Clicks from your travel brews.",
      buckets: finish(clicks),
    },
  ];

  // A single bucket is not a comparison — drop the group rather than imply one.
  return groups.filter((g) => g.buckets.length >= 2);
}
