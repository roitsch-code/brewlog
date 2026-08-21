/**
 * "Today's angles" — a small, rotating set of concrete starting points for the
 * bags currently in rotation, injected into the home chat's per-turn context.
 *
 * THE PROBLEM IT SOLVES: the chat receives the ENTIRE recipe corpus — 135
 * recipes, full pour sequences, ~39k tokens — cached and byte-identical on
 * every turn of every conversation. There is no scoring, no rotation, no
 * per-brewer cap; /recommend's whole selection machinery is wired to
 * /recommend only. Handed an undifferentiated wall, a model reaches for the
 * most salient entries, and the most salient entries do not change between
 * Tuesday and Friday. That is the chat half of "immer der gleiche Scheiss".
 *
 * The fix is not to shrink the corpus — it is the lookup reference and it stays
 * (also: it is the cached block, and cutting it would cost more than it saves).
 * It is to add a SMALL uncached block that DOES move: run the same selector
 * /recommend trusts, seeded per day and per bag, and name a couple of concrete
 * angles for the bags actually on the counter.
 *
 * Every recipe named here is a real corpus recipe, so this adds no new surface
 * for fabrication — it changes which real recipes are salient, nothing else.
 */

import {
  selectRecipes,
  brewersAvailableFromEquipment,
  CANONICAL_EQUIPMENT,
  normaliseRoastLevel,
  normaliseProcess,
  normaliseGoal,
  mixSeed,
} from "../knowledge/recipes";
import type { CompactCoffee } from "../claude/coffeeLibrary";

/** Bags to surface angles for. Three keeps the block short enough that it reads
 * as a nudge rather than a second menu competing with the library above it. */
const MAX_BAGS = 3;
/** Angles per bag. Two gives the model a choice without deciding for it. */
const ANGLES_PER_BAG = 2;

/** Stable per-bag offset so two bags don't rotate in lockstep. */
function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) >>> 0;
  return h;
}

/** The first clause of a recipe's `teaches`, short enough to stay a nudge.
 * The full text runs to a paragraph, and this block sits next to a 39k-token
 * library — it earns attention by being brief. */
function trimTeaches(teaches: string | undefined): string {
  const first = teaches?.split(/[.;]/)[0]?.trim() ?? "";
  if (first.length <= 90) return first;
  const cut = first.slice(0, 90);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : 90)}…`;
}

/** The day number — angles hold steady within a conversation and move overnight. */
export function daySeedFor(nowMs: number): number {
  return Math.floor(nowMs / 86_400_000);
}

/**
 * Build the block. Returns "" when there is nothing to say (no rotation bags,
 * or no recipe fits) so the caller can append it unconditionally.
 */
export function buildTodaysAngles(rotation: CompactCoffee[], daySeed: number): string {
  const bags = rotation.slice(0, MAX_BAGS);
  if (bags.length === 0) return "";

  const brewersAvailable = brewersAvailableFromEquipment([...CANONICAL_EQUIPMENT]);
  const lines: string[] = [];

  for (const bag of bags) {
    const selected = selectRecipes(
      {
        brewersAvailable,
        roastLevel: normaliseRoastLevel(undefined),
        process: normaliseProcess(bag.process),
        variety: bag.variety,
        // "explore" on purpose: this block's job is to widen what comes to
        // mind, not to re-derive the best everyday brew (the chat can do that
        // from the full library when asked).
        goal: normaliseGoal("explore"),
        rotationSeed: mixSeed(daySeed + hashId(bag.id)),
      },
      ANGLES_PER_BAG,
    );
    if (selected.length === 0) continue;

    const angles = selected
      .map((s) => {
        // Brackets, not parentheses: recipe names contain parentheses ("April
        // Coffee House V60 (Rolf)"), so "[…]" stays unambiguous to parse and to
        // read. The brewer is the raw id because that is the vocabulary the
        // corpus block above already uses.
        const teaches = trimTeaches(s.recipe.teaches);
        return `${s.recipe.name} [${s.recipe.brewer}]${teaches ? ` — ${teaches}` : ""}`;
      })
      .join(" · ");
    const explore = bag.whatToExplore ? ` (your log says: ${bag.whatToExplore})` : "";
    lines.push(`- ${bag.roaster} — ${bag.name}: ${angles}${explore}`);
  }

  if (lines.length === 0) return "";

  return (
    `\n## Today's angles — fresh starting points for the bags on the counter\n` +
    `Picked by the same scorer /recommend uses, re-rotated daily, so what comes to mind first is not the same every day. ` +
    `These are SUGGESTIONS, not a shortlist: the full Reference Recipe Library above is still available and a better fit there beats anything here. ` +
    `Use one when the user asks what to try, or when you would otherwise reach for the recipe you always reach for.\n` +
    lines.join("\n")
  );
}
