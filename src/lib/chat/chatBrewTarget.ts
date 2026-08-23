import { coffeeKeyFor } from "../coffee/coffeeKey";
import type { CoffeeIdentity } from "../types/session";

/**
 * Who a chat `start_brew` pill actually brews — the two halves of the fix for
 * the dead Brew button of 2026-08-23.
 *
 * What happened: the owner photographed a NEW bag (DAK Cassis, not in the
 * library), asked for a recipe, and got a Brew pill that did nothing. The
 * production DB showed why: the model had invented a plausible id
 * (`dak_coffee_roasters__cassis` — exactly the slug the bag WOULD get, because
 * ids are derived by coffeeKeyFor, so a guess can look perfect) for a row that
 * does not exist. The tap handler fetched that coffee, got nothing, discarded
 * the whole validated recipe and navigated to a blank brew flow. Every earlier
 * pill carried a real library id, which is why this never showed before.
 *
 * The design answer is NOT "forbid start_brew for new bags" (the prompt already
 * said that and the model leaked around it — the same class as the banned
 * brewer and the grinder unit). It is to make the pill work without a library
 * row: a brew saved through POST /api/sessions creates/merges the coffee row by
 * the same coffeeKeyFor slug, so brewing from roaster+name alone is the app's
 * oldest supported path. The model now passes roaster+name alongside (or
 * instead of) the id, and both sides use the helpers here:
 *
 *   - the ROUTE calls resolveStartBrewTarget to verify the id against the ids
 *     this turn's context actually offered — an unknown id with no names goes
 *     back to the model as an error tool_result (the #544 repair machinery),
 *     never onto a pill;
 *   - the PILL calls chatBrewIdentity when it has no library row, so the tap
 *     still seeds the timer with the chat's exact recipe.
 */

export interface StartBrewTarget {
  id?: string;
  roaster?: string;
  name?: string;
}

export type StartBrewTargetResult =
  | { ok: true; id?: string }
  | { ok: false; problem: string };

/**
 * Server-side check: does this start_brew point at something the tap handler
 * can actually brew? `knownIds` is the set of coffee ids this turn's context
 * injected (rotation + recent library) — the only ids the model can honestly
 * know.
 *
 * Returns the id to KEEP on the action: a known id survives; an unknown id is
 * resolved to the library row it plainly meant (roaster+name slug in the
 * library) or stripped (roaster+name present — the client brews from the names
 * and the row is created when the brew is saved). Unknown id with no names is
 * the unfixable case: nothing the tap could do, so it is bounced back.
 */
export function resolveStartBrewTarget(
  target: StartBrewTarget,
  knownIds: ReadonlySet<string>,
): StartBrewTargetResult {
  const id = target.id?.trim();
  const roaster = target.roaster?.trim();
  const name = target.name?.trim();

  if (id && knownIds.has(id)) return { ok: true, id };

  if (roaster && name) {
    // The model named the bag but guessed (or skipped) the id. If the derived
    // slug IS a library row, use it — the tap then gets the real photo, Field
    // and roast date. Otherwise drop the id entirely: a guessed id would cost
    // the client a doomed fetch, and the names are sufficient to brew.
    const derived = coffeeKeyFor(roaster, name);
    return knownIds.has(derived) ? { ok: true, id: derived } : { ok: true };
  }

  return {
    ok: false,
    problem: id
      ? `start_brew id "${id}" is not in the user's Coffee Library — never guess an id. ` +
        `Re-send the SAME recipe with the id of a bag from the library context, or, for a bag ` +
        `not in the library yet, omit id and pass its roaster and name instead (the Brew button ` +
        `works from those; the bag is created when the brew is saved).`
      : `start_brew needs a target: either the id of a library bag from the context, or — for a ` +
        `bag not in the library yet — its roaster and name. Re-send the SAME recipe with those.`,
  };
}

/**
 * Client-side fallback identity for a start_brew pill with no library row —
 * either no id at all (a bag not yet added) or an id whose fetch failed. The
 * shape mirrors what /coffees' "Brew this" synthesises from an aggregate:
 * enough for the brew screen and for the session save to create/merge the
 * coffee row on the derived slug.
 */
export function chatBrewIdentity(target: {
  roaster?: string;
  name?: string;
  origin?: string;
  process?: string;
}): CoffeeIdentity | null {
  const roaster = target.roaster?.trim();
  const name = target.name?.trim();
  if (!roaster || !name) return null;
  return {
    roaster,
    name,
    origin: target.origin?.trim() || "",
    process: target.process?.trim() || "Other",
    roastLevel: "Light",
    aiExtracted: false,
    coffeeId: coffeeKeyFor(roaster, name),
  };
}
