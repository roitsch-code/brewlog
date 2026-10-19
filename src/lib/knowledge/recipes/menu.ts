/**
 * The /recommend menu — every owned brewer on the table (2026-10-19).
 *
 * Until this module the menu was a 4-slot best-fit portfolio with four hard
 * filters (±20 % batch window, vessel capacity, one Orea bottom, a Special
 * ceiling). Measured on the real selector, that put the AeroPress, the
 * Moccamaster and the Origami wave on 0 of 360 Small menus and the Chemex on
 * 54 — the owner found his brewers missing. Owner decision: all brewers are
 * equal, each with a role and a limit; a recipe published at another size or
 * a vessel smaller than the amount is INFORMATION the model reads, never a
 * reason to hide a brewer.
 *
 * So: one entry per role, always. Each carries that brewer's best-fit recipe
 * (scored exactly as before: roast / process / variety / goal / occasion, ties
 * rotated by seed, recently-seen references demoted within ties), the scale
 * factor to today's amount, the reach path when the vessel cannot serve it,
 * and how long ago the brewer was last offered. The LEADS — the brewers least
 * recently offered, rotated by seed — get their best recipe's full text this
 * turn; every other recipe is one line in the cached index. Pure.
 */
import {
  BREWER_ROLES,
  BREWER_TYPE_TO_ROLE,
  reachFor,
  type BrewerRole,
  type BrewerRoleKey,
  type Reach,
} from "../brewers";
import { CANONICAL_EQUIPMENT, brewersAvailableFromEquipment, formatRecipeForPrompt, mixSeed, pickRepresentative, recipeIndexLine, scoreAndOrder, type RecipeSelectionInput, type ScoredRecipe } from "./helpers";
import { ALL_RECIPES } from "./helpers";
import type { Recipe } from "./types";

export interface MenuEntry {
  role: BrewerRoleKey;
  brewer: BrewerRole;
  /** Every recipe of this turn's partition on this brewer, best fit first. */
  recipes: ScoredRecipe[];
  /** The one that represents the brewer this turn (rotated among near-equals). */
  best: ScoredRecipe | null;
  /** best.water → today's amount; 1 when no amount or no recipe. */
  scaleFactor: number;
  reach: Reach;
  /** Brews ago this brewer was last offered or brewed; null = not in the window. */
  lastOffered: number | null;
  /** Full text this turn. */
  lead: boolean;
}

export interface BrewerMenu {
  entries: MenuEntry[];
  leads: MenuEntry[];
  targetWaterGrams?: number;
  locked: boolean;
}

export interface BrewerMenuInput extends RecipeSelectionInput {
  targetWaterGrams?: number;
  /** role → brews ago (0 = the newest session). From brewerRecency(). */
  lastOffered?: Map<BrewerRoleKey, number>;
  /** How many brewers get their best recipe in full this turn. */
  leadCount?: number;
  /** How many recipes a LOCKED brewer shows in full. */
  lockedLimit?: number;
}

export const DEFAULT_LEAD_COUNT = 8;
export const DEFAULT_LOCKED_LIMIT = 5;
export const RECENCY_WINDOW = 10;

function hashKey(key: string): number {
  return Array.from(key).reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
}

export function buildBrewerMenu(input: BrewerMenuInput): BrewerMenu {
  const isCold = (input.occasion ?? "").toLowerCase() === "cold-brew";
  const locked = !!input.lockedBrewers && input.lockedBrewers.size > 0;
  const scored = scoreAndOrder(input);
  const seed = input.rotationSeed ?? 0;

  const byRole = new Map<BrewerRoleKey, ScoredRecipe[]>();
  for (const s of scored) {
    const role = BREWER_TYPE_TO_ROLE.get(s.recipe.brewer);
    if (!role) continue;
    const list = byRole.get(role);
    if (list) list.push(s);
    else byRole.set(role, [s]);
  }

  const roles = BREWER_ROLES.filter((r) => {
    if (r.coldOnly !== isCold && r.coldOnly) return false;
    if (isCold && !r.coldOnly && !byRole.has(r.key)) return false;
    if (locked) return r.brewers.some((b) => input.lockedBrewers!.has(b));
    return r.brewers.some((b) => input.brewersAvailable.has(b));
  });

  const entries: MenuEntry[] = roles.map((brewer) => {
    const recipes = byRole.get(brewer.key) ?? [];
    const best = recipes.length ? pickRepresentative(recipes, seed) : null;
    const scaleFactor =
      best && input.targetWaterGrams && best.recipe.water.grams > 0
        ? input.targetWaterGrams / best.recipe.water.grams
        : 1;
    return {
      role: brewer.key,
      brewer,
      recipes,
      best,
      scaleFactor,
      reach: reachFor(brewer.key, input.targetWaterGrams),
      lastOffered: input.lastOffered?.get(brewer.key) ?? null,
      lead: false,
    };
  });

  // Leads: least recently offered first (never-offered ahead of everything),
  // ties rotated by the turn's seed so two brewers never move in lockstep.
  const leadCount = locked ? entries.length : (input.leadCount ?? DEFAULT_LEAD_COUNT);
  const ranked = [...entries]
    .filter((e) => e.best)
    .sort((a, b) => {
      const la = a.lastOffered ?? Number.POSITIVE_INFINITY;
      const lb = b.lastOffered ?? Number.POSITIVE_INFINITY;
      if (la !== lb) return lb - la;
      return (mixSeed(seed + hashKey(a.role)) % 1000) - (mixSeed(seed + hashKey(b.role)) % 1000);
    });
  const leads = ranked.slice(0, leadCount);
  for (const e of leads) e.lead = true;

  return { entries, leads, targetWaterGrams: input.targetWaterGrams, locked };
}

function mmss(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

function lastOfferedText(n: number | null): string {
  if (n === null) return `not offered in your last ${RECENCY_WINDOW} brews`;
  if (n === 0) return "offered on your last brew";
  return `last offered ${n + 1} brews ago`;
}

/**
 * The per-turn YOUR BREWERS TODAY block: one line per brewer, then the full
 * text of the leads' best recipes (scaled to today's amount where the
 * reference applies, labelled with its factor where it does not).
 */
export function formatMenuForPrompt(
  menu: BrewerMenu,
  opts: { grinder?: string; method?: string; lockedMethod?: string } = {},
): string {
  const target = menu.targetWaterGrams;
  const lines = menu.entries.map((e) => {
    const bits: string[] = [`- ${e.brewer.method}`];
    if (!e.recipes.length) bits.push("no documented recipe for this brewer — adapt the nearest by geometry and say so");
    else {
      bits.push(`${e.recipes.length} recipe${e.recipes.length === 1 ? "" : "s"} fit`);
      if (e.best) {
        const b = e.best.recipe;
        const scale =
          target && Math.abs(e.scaleFactor - 1) > 0.01
            ? ` (published at ${b.water.grams} g · ×${e.scaleFactor.toFixed(2)} to your ${Math.round(target)} g)`
            : "";
        bits.push(`best fit: ${b.shortName || b.name}${scale}`);
      }
    }
    if (e.reach.how !== "fits") bits.push(e.reach.text);
    if (!menu.locked) bits.push(lastOfferedText(e.lastOffered));
    if (e.lead) bits.push("full text below");
    return bits.join(" · ");
  });

  const head = menu.locked
    ? `YOUR BREWER TODAY — you locked ${opts.lockedMethod ?? "this brewer"}; both candidates use it, contrasting through genuinely different recipe physics on it.`
    : `YOUR BREWERS TODAY (${menu.entries.length}) — all on the table, equally; the brewer is yours to choose for this coffee, this amount and this goal, and whyChosen says why. "Not offered lately" is information, not an instruction. A brewer whose documented recipes sit far from today's amount is still a fine choice — scale, and say what is unmeasured.`;

  const fullHeader = menu.locked
    ? `\nFULL TEXT — the best-fit recipes on ${opts.lockedMethod ?? "this brewer"} (${menu.leads.reduce((n, e) => n + Math.min(e.recipes.length, DEFAULT_LOCKED_LIMIT), 0)}). Cite by name; the system prompt's index lists every other recipe by name.`
    : `\nFULL TEXT — the best-fit recipe on each of the ${menu.leads.length} brewers leading this turn. Any other recipe in the system prompt's REFERENCE RECIPE INDEX may be cited by its exact name when it fits better; its pours are then yours to reconstruct from the index line and the brewer rules, said so in whyChosen.`;

  const blocks: string[] = [];
  let i = 0;
  for (const e of menu.leads) {
    const rs = menu.locked ? e.recipes.slice(0, DEFAULT_LOCKED_LIMIT) : e.best ? [e.best] : [];
    for (const s of rs) {
      i += 1;
      blocks.push(
        `${i}. ${formatRecipeForPrompt(s.recipe, {
          scaleTo: target ? { targetWaterGrams: target, method: opts.method ?? e.brewer.method } : undefined,
          grinder: opts.grinder,
          label: `(${e.brewer.method})`,
        })}`,
      );
    }
  }

  return `${head}\n${lines.join("\n")}\n${fullHeader}\n\n${blocks.join("\n\n")}`;
}

/**
 * The cached REFERENCE RECIPE INDEX: one line per recipe on a brewer the
 * owner owns, grouped by role. Built from CANONICAL_EQUIPMENT only (never the
 * DB row), so it is byte-identical across calls and can be a cached system
 * block. Built once per process.
 */
let indexCache: string | null = null;
export function formatRecipeIndexBlock(): string {
  if (indexCache) return indexCache;
  const owned = brewersAvailableFromEquipment([...CANONICAL_EQUIPMENT]);
  const byRole = new Map<BrewerRoleKey, Recipe[]>();
  for (const r of ALL_RECIPES) {
    if (!owned.has(r.brewer)) continue;
    const role = BREWER_TYPE_TO_ROLE.get(r.brewer);
    if (!role) continue;
    const list = byRole.get(role);
    if (list) list.push(r);
    else byRole.set(role, [r]);
  }
  const total = Array.from(byRole.values()).reduce((n, rs) => n + rs.length, 0);
  const groups = BREWER_ROLES.filter((r) => byRole.has(r.key)).map((role) => {
    const rs = byRole.get(role.key)!;
    return `\n### ${role.method} (${rs.length})\n${rs.map(recipeIndexLine).join("\n")}`;
  });
  indexCache =
    `REFERENCE RECIPE INDEX — every documented recipe on a brewer you own (${total}), one line each. An index line holds the headline numbers, never the pours. ` +
    `HOW MANY RECIPES A BREWER HAS IS NOT A RECOMMENDATION: it reflects what the coffee world publishes, nothing else. ` +
    `The per-turn message carries the full text of the leading brewers' best recipes; any other entry here may be named in basedOn when it fits better.\n` +
    groups.join("\n");
  return indexCache;
}
