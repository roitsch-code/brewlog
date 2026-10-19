/**
 * "Fresh" — what is new since he last opened the Context step (2026-10-19).
 *
 * Owner: "Immer wieder Neues … ohne dass ich danach suchen oder bitten muss"
 * — and NOT on Home ("Home clean halten"). So the one place a new recipe, a
 * new coach insight or a new card for the bag on the counter is announced is
 * the Context step of the brew flow, as a compact strip under the hero
 * question, plus the "While you waited" card on the recipe screen. Pure
 * selection + queue here; the route reads the rows, the strip owns the
 * device's memory (last open, dismissed keys).
 */
import { BREWER_TYPE_TO_ROLE, reachFor } from "@/lib/knowledge/brewers";
import type { Recipe } from "@/lib/knowledge/recipes/types";

export type FreshKind = "coach" | "coffee-card" | "recipe";

export interface FreshItem {
  /** Stable key for the dismissed-set: `recipe:<id>`, `coach:<id>`, `coffee-card:<coffeeId>`. */
  key: string;
  kind: FreshKind;
  title: string;
  body: string;
  /** Where a tap goes; a recipe item carries the name to prefill instead. */
  href?: string;
  /** For a recipe: the name `userRequest` is prefilled with. */
  recipeName?: string;
  /** ISO time the thing appeared. */
  at: string;
}

/** A corpus entry counts as new for this long after `addedAt`. */
export const FRESH_RECIPE_DAYS = 30;
/** How many items the strip shows at once. */
export const FRESH_MAX_ITEMS = 2;

/**
 * Recipes added to the corpus within FRESH_RECIPE_DAYS, on a brewer that can
 * serve today's amount, newest first. `since` narrows to those added after
 * his last open; undefined = all within the window.
 */
export function freshRecipes(recipes: Recipe[], opts: { since?: number; waterMl?: number; now?: number }): FreshItem[] {
  const now = opts.now ?? Date.now();
  const floor = now - FRESH_RECIPE_DAYS * 86_400_000;
  const out: { item: FreshItem; t: number }[] = [];
  for (const r of recipes) {
    if (!r.addedAt) continue;
    const t = Date.parse(r.addedAt);
    if (!Number.isFinite(t) || t < floor || t > now) continue;
    if (opts.since !== undefined && t <= opts.since) continue;
    const role = BREWER_TYPE_TO_ROLE.get(r.brewer);
    if (role && opts.waterMl && reachFor(role, opts.waterMl).how === "not-for-this-size") continue;
    out.push({
      t,
      item: {
        key: `recipe:${r.id}`,
        kind: "recipe",
        title: r.shortName || r.name,
        body: `${r.attribution.person}${r.attribution.year ? ` (${r.attribution.year})` : ""} · ${r.dose.grams} g : ${r.water.grams} g${r.verified ? "" : " · unverified"}`,
        recipeName: r.name,
        at: new Date(t).toISOString(),
      },
    });
  }
  return out.sort((a, b) => b.t - a.t).map((x) => x.item);
}

/** The strip's queue: not dismissed, newest first, at most FRESH_MAX_ITEMS. */
export function freshQueue(items: FreshItem[], dismissed: Set<string>, max: number = FRESH_MAX_ITEMS): FreshItem[] {
  return items
    .filter((i) => !dismissed.has(i.key))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, max);
}

export const FRESH_LAST_OPEN_KEY = "brewlog.fresh.lastOpen";
export const FRESH_DISMISSED_KEY = "brewlog.fresh.dismissed.v1";

export function readDismissed(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const v: unknown = JSON.parse(raw);
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}
