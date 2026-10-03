/**
 * `lookup_recipe` — the chat's on-demand reference lookup (2026-10-03, speed
 * round).
 *
 * Until now every chat turn carried the FULL 147-recipe corpus as a cached
 * system block: ~172k characters, ~43k tokens, byte-identical on every turn.
 * The chat now gets a compact INDEX (one line per recipe, cached) plus the
 * full text of the likeliest references for the bags on the counter
 * (uncached, per turn), and fetches any other recipe's full text through this
 * tool when it needs it. Pure; the route dispatches it.
 */
import {
  ALL_RECIPES,
  formatRecipeForPrompt,
  formatTemperature,
  matchesAnyName,
  normName,
  type Recipe,
} from "../knowledge/recipes";

/** One index line: enough to CHOOSE a recipe, never enough to quote its pours. */
export function recipeIndexLine(r: Recipe): string {
  const mm = Math.floor(r.totalTimeSec / 60);
  const ss = String(r.totalTimeSec % 60).padStart(2, "0");
  const year = r.attribution.year ? ` (${r.attribution.year})` : "";
  const tag = r.verified ? "" : " [reconstructed]";
  return `- ${r.name} — ${r.attribution.person}${year} · ${r.brewer} · ${r.dose.grams}g:${r.water.grams}g (${r.water.ratio}) · ${formatTemperature(r)} · ${mm}:${ss}${tag}`;
}

/**
 * Recipes answering to `query`, most specific match first:
 * exact id / name / shortName → name containment (6-char floor, the same
 * binding `basedOn` uses) → attribution person → brewer id.
 */
export function matchRecipesByName(query: string, recipes: Recipe[] = ALL_RECIPES): Recipe[] {
  const q = normName(query);
  if (!q) return [];
  const byId = recipes.filter((r) => r.id === query.trim());
  if (byId.length) return byId;
  // A bare brewer id ("v60", "orea-classic") means the whole group, even when
  // one recipe's shortName happens to be the same word.
  const brewerQ = q.replace(/\s+/g, "-");
  const byBrewerExact = recipes.filter((r) => r.brewer === brewerQ);
  if (byBrewerExact.length) return byBrewerExact;
  const exact = recipes.filter((r) => normName(r.name) === q || normName(r.shortName) === q);
  if (exact.length) return exact;
  const contained = recipes.filter((r) => matchesAnyName(r, [query]));
  if (contained.length) return contained;
  const byPerson = recipes.filter((r) => normName(r.attribution.person).includes(q));
  if (byPerson.length) return byPerson;
  return recipes.filter((r) => r.brewer.includes(brewerQ) || normName(r.brewer).includes(q));
}

export type LookupResult = { kind: "full" | "index" | "none"; text: string; matches: number };

/** The tool's answer: full text for a few hits, an index of names for many, a pointer for none. */
export function lookupRecipe(query: string, opts: { max?: number } = {}): LookupResult {
  const max = opts.max ?? 3;
  const hits = matchRecipesByName(query);
  if (hits.length === 0) {
    return {
      kind: "none",
      matches: 0,
      text: `No recipe matches "${query}". The Reference Recipe Index in your context lists every recipe by exact name — call lookup_recipe again with one of those names, a person (e.g. "Hoffmann") or a brewer id (e.g. "orea-classic"). Do not reconstruct a recipe from memory.`,
    };
  }
  if (hits.length <= max) {
    return { kind: "full", matches: hits.length, text: hits.map((r) => formatRecipeForPrompt(r)).join("\n\n") };
  }
  return {
    kind: "index",
    matches: hits.length,
    text:
      `${hits.length} recipes match "${query}" — name ONE to get its full text:\n` +
      hits.map(recipeIndexLine).join("\n"),
  };
}
