/**
 * Per-turn context builders for the home chat.
 *
 * Split out of `src/app/api/explore-agent/route.ts` for the same reason as
 * `agentPrompt.ts`: so a measurement harness can import the REAL builders
 * instead of reimplementing them. A reimplemented builder drifts, and a
 * harness measuring a drifted copy reports numbers about nothing — which is
 * exactly the failure this repo keeps meeting (#530, #535).
 *
 * Everything here is Next-free and pure apart from the corpus memo.
 * Byte-identical move; no behaviour change.
 */
import { applyPourDurations } from "@/lib/recipe/pourDurations";
import type { CompactCoffee } from "@/lib/claude/coffeeLibrary";
import { reconcileWaterToPourPlan } from "@/lib/claude/recipeFidelity";
import { ALL_RECIPES, formatRecipeForPrompt } from "@/lib/knowledge/recipes";
import { recipeIndexLine } from "@/lib/chat/recipeLookup";
import { buildTodaysAngles, selectTodaysAngles } from "@/lib/chat/todaysAngles";
import type { BrewRecipe } from "@/lib/types/session";
import { derivePourSequence, sanitizePourSteps } from "@/lib/utils/pourSteps";

/**
 * The reference recipe INDEX, grouped by brewer, with the corpus's imbalance
 * stated up front.
 *
 * Reported as "der Chat kennt nur V60". He was reading a real signal: the
 * corpus is roughly one-third V60 (the largest group by a factor of two)
 * because that is what the coffee world publishes, not what suits his beans.
 * Dumped as a flat list, recipe COUNT reads as endorsement, and the model
 * reaches for the brewer it saw thirty times. Grouping makes the shape visible,
 * and the header says outright that frequency is an artefact of publishing.
 *
 * SINCE 2026-10-03 (speed round) this is an INDEX, not the corpus: one line
 * per recipe (name, person, brewer, headline numbers), ~5k tokens instead of
 * the ~43k the full text cost on every single turn. The full text of the
 * likeliest references for the bags on the counter arrives per turn in
 * `buildRecipeShortlist`; anything else the model fetches with the
 * `lookup_recipe` tool. Nothing is removed from reach — only from the prefix.
 *
 * Built once per process and prompt-cached; it is a compile-time constant.
 */
let recipeLibraryCache: string | null = null;
export function recipeLibraryBlock(): string {
  if (recipeLibraryCache) return recipeLibraryCache;

  const byBrewer = new Map<string, typeof ALL_RECIPES>();
  for (const r of ALL_RECIPES) {
    const list = byBrewer.get(r.brewer);
    if (list) list.push(r);
    else byBrewer.set(r.brewer, [r]);
  }
  const groups = Array.from(byBrewer.entries()).sort((a, b) => b[1].length - a[1].length);

  const header =
    `\n## Reference Recipe Index (every championship + named-expert recipe documented in the app, one line each)\n\n` +
    `This is an INDEX for choosing, not a recipe to quote from: a line holds the headline numbers, never the pours. ` +
    `The full text of the likeliest references for the bags on the counter is in the SHORTLIST in your per-turn context; ` +
    `for any other entry call lookup_recipe with its exact name (or a person, or a brewer id) BEFORE you quote or adapt its sequence.\n\n` +
    `HOW MANY RECIPES A BREWER HAS IS NOT A RECOMMENDATION. It reflects what the coffee world has published, ` +
    `nothing else. ${ALL_RECIPES.length} recipes across ${groups.length} brewers: ` +
    groups.map(([b, rs]) => `${b} ${rs.length}`).join(", ") + `. ` +
    `The V60 is over-represented because it is the most written-about brewer on earth; the Orea V4 Wide — one of ` +
    `the user's primary cones — has ${groups.filter(([b]) => /orea/i.test(b)).reduce((n, [, rs]) => n + rs.length, 0)} entries ` +
    `across its four bottoms. Choose the brewer for the BEAN and the goal, then adapt the ` +
    `nearest recipe to it — a recipe published on a V60 usually transfers to another cone with the same geometry. ` +
    `Never pick a brewer because this index happens to hold more recipes for it.\n`;

  recipeLibraryCache =
    header +
    groups
      .map(([brewer, rs]) => `\n### ${brewer} (${rs.length})\n` + rs.map((r) => recipeIndexLine(r)).join("\n"))
      .join("\n");
  return recipeLibraryCache;
}

/**
 * Today's angles PLUS the full text of exactly those recipes (2026-10-03).
 *
 * The angle lines (todaysAngles.ts) say which real recipes are fresh for the
 * bags on the counter; this block appends their complete documented text so
 * the model can quote a pour sequence without a tool round-trip. Uncached and
 * per turn (it rotates daily), ≤ MAX_BAGS × ANGLES_PER_BAG recipes, deduped.
 * Returns "" when nothing is in rotation.
 */
export function buildRecipeShortlist(rotation: CompactCoffee[], daySeed: number): string {
  const angles = buildTodaysAngles(rotation, daySeed);
  if (!angles) return "";
  const seen = new Set<string>();
  const rs = selectTodaysAngles(rotation, daySeed)
    .flatMap((b) => b.recipes)
    .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
  if (rs.length === 0) return angles;
  return (
    angles +
    `\n\n### SHORTLIST — full text of today's angles (${rs.length}). Quote and adapt from these directly; ` +
    `for any recipe NOT here, call lookup_recipe before you state its sequence.\n\n` +
    // Unscaled on purpose: the chat gets its scaling through the recipe
    // validator instead, and this exact expression is pinned by a test.
    rs.map((r) => formatRecipeForPrompt(r)).join("\n\n")
  );
}

export function formatLibraryForAgent(library: CompactCoffee[]): string {
  if (library.length === 0) return "";
  return library
    .map((c) => {
      const usage =
        c.avgRating != null
          ? `${c.avgRating.toFixed(1)}★ · ${c.sessionCount} sessions`
          : `${c.sessionCount} sessions`;
      const rotationMark = c.inRotation ? "★ IN ROTATION | " : "";
      // Variety comes off the coffee row (migration 0023), so it shows even for
      // a bag with no brews yet — e.g. one just added from this chat.
      const variety = c.variety ? ` ${c.variety}` : "";
      // Written weekly by /api/coffees/compact from this bag's own brew
      // history. It sat unused by the one surface most likely to be asked
      // "what should I try with this one?".
      const explore = c.whatToExplore ? `\n    Explore next: ${c.whatToExplore}` : "";
      return `- [id:${c.id}] ${rotationMark}${c.roaster} — ${c.name} | ${c.origin}${variety} ${c.process} | ${usage}${explore}`;
    })
    .join("\n");
}

/**
 * Clean a chat-authored `start_brew` recipe so the brew timer can render it the
 * same way a /recommend recipe renders. The model's tool input is raw: its step
 * `action` wording drifts ("Plunge", "Steep", "Press") and it carries no
 * `pourSequence` fallback string. Without this the AeroPress / immersion guide
 * mis-routes (the renderer matches exact action words) and shows no steps. We:
 *   1. action-normalize + validate the structured steps (shared with /recommend),
 *   2. derive the legacy `pourSequence` backstop from those steps, and
 *   3. snap the headline water to the actual pour plan (the "too much water"
 *      header-vs-plan mismatch /recommend already corrects).
 */
export function cleanChatRecipe(
  recipe: BrewRecipe | undefined,
  ctx: { basedOn?: string; method?: string; pourRateGPS?: number } = {},
): BrewRecipe | undefined {
  return cleanChatRecipeDetailed(recipe, ctx)?.recipe;
}

export interface CleanedChatRecipe {
  recipe: BrewRecipe;
  /** Where the pour seconds came from (src/lib/recipe/pourDurations.ts). */
  pourSource: "reference" | "house" | "none";
  /** Every pour time the app changed — /recommend logs these, the chat never did. */
  pourChanges: string[];
}

export function cleanChatRecipeDetailed(
  recipe: BrewRecipe | undefined,
  ctx: { basedOn?: string; method?: string; pourRateGPS?: number } = {},
): CleanedChatRecipe | undefined {
  if (!recipe) return undefined;
  const pourSteps = sanitizePourSteps(recipe.pourSteps);
  const out: BrewRecipe = {
    ...recipe,
    ...(pourSteps ? { pourSteps } : {}),
    pourSequence: recipe.pourSequence ?? derivePourSequence(pourSteps),
  };
  // 4. Pour TIMES are the app's, not the model's — the same rule /recommend
  //    applies (src/lib/recipe/pourDurations.ts): a verified reference's own
  //    scaled times, else the owner's measured pace in 5-second steps.
  const timed = applyPourDurations(reconcileWaterToPourPlan(out), ctx);
  // 5. The string follows the (re-timed) steps, as in /recommend.
  const r = timed.recipe;
  return {
    recipe: { ...r, pourSequence: derivePourSequence(r.pourSteps) ?? r.pourSequence },
    pourSource: timed.source,
    pourChanges: timed.changes,
  };
}

/**
 * Which grinder is in the user's hand, read off the conversation.
 *
 * There is no structured context here the way the brew flow has one — the only
 * statement of fact is the user typing "I've got the Comandante". That is the
 * same signal the model itself works from, and without it the unit check has
 * nothing to compare against, so it simply doesn't run (a wrong unit is worth
 * catching; a guessed one is not). Most recent mention wins, because the
 * grinder can change mid-conversation when they get home.
 */
export function grinderFromConversation(messages: { role: string; content?: unknown }[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user" || typeof m.content !== "string") continue;
    if (/comandante|\bc40\b/i.test(m.content)) return "Comandante C40";
    if (/niche/i.test(m.content)) return "Niche Zero";
  }
  return undefined;
}
