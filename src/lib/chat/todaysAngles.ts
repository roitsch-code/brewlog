/**
 * "Today's angles" — a small, rotating set of concrete starting points for the
 * bags currently in rotation, injected into the home chat's per-turn context.
 *
 * THE PROBLEM IT SOLVED (Aug 2026): the chat received the ENTIRE recipe corpus
 * cached and byte-identical on every turn, with no scoring, rotation or cap, so
 * the model reached for the same salient entries every day. This block runs
 * the same selector /recommend trusts, seeded per day and per bag, and names a
 * few concrete angles for the bags actually on the counter.
 *
 * SINCE 2026-10-03 (speed round) the full corpus is GONE from the chat: the
 * cached block is a one-line-per-recipe index, and the recipes selected here
 * are the ones whose FULL text the chat gets per turn (agentContext.ts
 * `buildRecipeShortlist` renders them under the angle lines). Anything else is
 * fetched on demand through the `lookup_recipe` tool.
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
import type { Recipe } from "../knowledge/recipes";

/** Bags to surface angles for. Three keeps the block short enough that it reads
 * as a nudge rather than a second menu competing with the library above it. */
const MAX_BAGS = 3;
/** Angles per bag. Three: these are also the recipes the chat holds in FULL
 * this turn, so one more than before buys real choice at ~300 tokens each. */
const ANGLES_PER_BAG = 3;

/** Stable per-bag offset so two bags don't rotate in lockstep. */
function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) >>> 0;
  return h;
}

/** The first clause of a recipe's `teaches`, short enough to stay a nudge.
 * The full text runs to a paragraph; the line earns attention by being brief. */
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
export interface BagAngles {
  bag: CompactCoffee;
  recipes: Recipe[];
}

/** The selection itself — which real recipes are today's angles for each bag.
 * agentContext.ts renders the FULL text of exactly these under the angle lines. */
export function selectTodaysAngles(rotation: CompactCoffee[], daySeed: number): BagAngles[] {
  const bags = rotation.slice(0, MAX_BAGS);
  const brewersAvailable = brewersAvailableFromEquipment([...CANONICAL_EQUIPMENT]);
  const out: BagAngles[] = [];
  for (const bag of bags) {
    const selected = selectRecipes(
      {
        brewersAvailable,
        roastLevel: normaliseRoastLevel(undefined),
        process: normaliseProcess(bag.process),
        variety: bag.variety,
        // "explore" on purpose: this block's job is to widen what comes to
        // mind, not to re-derive the best everyday brew.
        goal: normaliseGoal("explore"),
        rotationSeed: mixSeed(daySeed + hashId(bag.id)),
      },
      ANGLES_PER_BAG,
    );
    if (selected.length) out.push({ bag, recipes: selected.map((s) => s.recipe) });
  }
  return out;
}

export function buildTodaysAngles(rotation: CompactCoffee[], daySeed: number): string {
  const picked = selectTodaysAngles(rotation, daySeed);
  if (picked.length === 0) return "";
  const lines: string[] = [];

  for (const { bag, recipes } of picked) {
    const selected = recipes.map((recipe) => ({ recipe }));
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
    `These are SUGGESTIONS, not a shortlist that excludes the rest: every other recipe in the Reference Recipe Index is still available in full through lookup_recipe, and a better fit there beats anything here. ` +
    `Use one when the user asks what to try, or when you would otherwise reach for the recipe you always reach for.\n` +
    lines.join("\n")
  );
}
