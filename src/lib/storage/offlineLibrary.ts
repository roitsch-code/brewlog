/**
 * Offline brew library — caches coffees and their re-brewable recipes in
 * IndexedDB so a known coffee can be brewed again without a network.
 *
 * Source of truth stays the server. We mirror, per coffee, its richest
 * identity and the *two best-rated* past recipes (deduplicated), derived
 * from the session feed the library pages already load while online. The
 * cache is refreshed on every successful online library load, so it is as
 * fresh as the last time the user opened the library with a connection.
 */

import type { Coffee } from "@/lib/types/coffee";
import type { Session, CoffeeIdentity, Recommendation, BrewRecipe } from "@/lib/types/session";
import type { FieldZones } from "@/lib/field/types";
import { STORE_BREWABLE, idbGetAll, idbGet, idbPut, idbReplaceAll } from "./idb";

export interface BrewableRecipe {
  method: string;
  recipe: BrewRecipe;
  /** Normalized Recommendation whose primaryMethod/primaryRecipe equal
   * the used recipe — set straight into the flow store so LightStepBrew
   * and LightStepSummary read the right numbers. */
  recommendation: Recommendation;
  brewedAt: string; // ISO
  rating?: number;
}

export interface BrewableCoffee {
  id: string;
  identity: CoffeeIdentity;
  fieldZones: FieldZones | null;
  sessionCount: number;
  recipes: BrewableRecipe[]; // up to 2, best first
  cachedAt: number;
}

function recipeSignature(r: BrewableRecipe): string {
  const x = r.recipe;
  return [r.method, x.doseGrams, x.waterGrams, x.waterTempC, x.targetTimeSec, x.pourSequence ?? ""].join("|");
}

/** The recipe that was actually brewed in a session, normalized so the
 * chosen method's recipe is the primary one. Null when the session has no
 * usable recommendation. */
function usedRecipe(session: Session): BrewableRecipe | null {
  const rec = session.recommendation;
  if (!rec) return null;
  const method = session.brew?.methodUsed || rec.primaryMethod;
  if (!method) return null;
  const recipe = rec.candidates?.find((c) => c.method === method)?.recipe ?? rec.primaryRecipe;
  if (!recipe) return null;
  return {
    method,
    recipe,
    recommendation: { ...rec, primaryMethod: method, primaryRecipe: recipe },
    brewedAt: session.createdAt,
    rating: session.result?.rating,
  };
}

/** Up to 2 distinct recipes, best rating first (recency breaks ties and
 * orders unrated brews). */
function topTwoRecipes(sessions: Session[]): BrewableRecipe[] {
  const recipes = sessions
    .map(usedRecipe)
    .filter((r): r is BrewableRecipe => r !== null)
    .sort((a, b) => {
      const ra = a.rating ?? -1;
      const rb = b.rating ?? -1;
      if (rb !== ra) return rb - ra;
      return b.brewedAt.localeCompare(a.brewedAt);
    });

  const seen = new Set<string>();
  const distinct: BrewableRecipe[] = [];
  for (const r of recipes) {
    const sig = recipeSignature(r);
    if (seen.has(sig)) continue;
    seen.add(sig);
    distinct.push(r);
    if (distinct.length === 2) break;
  }
  return distinct;
}

function synthesizeIdentity(coffee: Coffee): CoffeeIdentity {
  return {
    roaster: coffee.roaster,
    name: coffee.name,
    origin: coffee.origin,
    process: coffee.process,
    roastLevel: "Light",
    roastDate: coffee.latestRoastDate,
    bagPhotoUrl: coffee.bagPhotoUrl,
    aiExtracted: false,
    coffeeId: coffee.id,
  };
}

function buildBrewableCoffee(coffee: Coffee, coffeeSessions: Session[]): BrewableCoffee {
  // The most recent session's coffee identity is richest (variety, roast
  // level, tasting notes); fall back to a synthesized identity.
  const newest = [...coffeeSessions].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const identity: CoffeeIdentity = newest?.coffee
    ? { ...newest.coffee, coffeeId: coffee.id }
    : synthesizeIdentity(coffee);

  return {
    id: coffee.id,
    identity,
    fieldZones: coffee.fieldZones ?? null,
    sessionCount: coffee.sessionCount,
    recipes: topTwoRecipes(coffeeSessions),
    cachedAt: Date.now(),
  };
}

/** Comprehensive warm — replaces the whole cache from the full library +
 * session feed. Called on the coffee-library page while online. */
export async function cacheBrewableLibrary(coffees: Coffee[], sessions: Session[]): Promise<void> {
  try {
    const byId = new Map(sessions.map((s) => [s.id, s]));
    const records = coffees.map((c) => {
      const cs = (c.sessionIds ?? [])
        .map((id) => byId.get(id))
        .filter((s): s is Session => Boolean(s));
      return buildBrewableCoffee(c, cs);
    });
    await idbReplaceAll(STORE_BREWABLE, records);
  } catch {
    // Best-effort — a failed warm just leaves the previous cache in place.
  }
}

/** Single-coffee upsert — called on the coffee detail page while online so
 * a freshly-opened coffee's recipes stay current. */
export async function cacheBrewableCoffee(coffee: Coffee, coffeeSessions: Session[]): Promise<void> {
  try {
    await idbPut(STORE_BREWABLE, buildBrewableCoffee(coffee, coffeeSessions));
  } catch {
    // ignore
  }
}

export async function getBrewableLibrary(): Promise<BrewableCoffee[]> {
  try {
    const all = await idbGetAll<BrewableCoffee>(STORE_BREWABLE);
    return all.sort((a, b) => (a.identity.name || "").localeCompare(b.identity.name || ""));
  } catch {
    return [];
  }
}

export async function getBrewableCoffee(id: string): Promise<BrewableCoffee | null> {
  try {
    return (await idbGet<BrewableCoffee>(STORE_BREWABLE, id)) ?? null;
  } catch {
    return null;
  }
}
