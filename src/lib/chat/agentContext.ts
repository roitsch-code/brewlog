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
import type { CompactCoffee } from "@/lib/claude/coffeeLibrary";
import { reconcileWaterToPourPlan } from "@/lib/claude/recipeFidelity";
import { ALL_RECIPES, formatRecipeForPrompt } from "@/lib/knowledge/recipes";
import type { BrewRecipe } from "@/lib/types/session";
import { pourSequenceFromSteps, sanitizePourSteps } from "@/lib/utils/pourSteps";

/**
 * The reference recipe corpus, grouped by brewer, with its own imbalance
 * stated up front.
 *
 * Reported as "der Chat kennt nur V60". He was reading a real signal: the
 * corpus is 45/136 V60 (33%, the largest group by a factor of two) while his
 * Orea V4 — one of his main brewers — has exactly ONE recipe, because that is
 * what the coffee world publishes, not what suits his beans. Dumped as a flat
 * list, recipe COUNT reads as endorsement, and the model reaches for the
 * brewer it saw thirty times.
 *
 * Grouping makes the shape visible instead of implicit, and the header says
 * outright that frequency is an artefact of publishing. Nothing is removed —
 * every recipe is still here, and a V60 is still the right answer whenever the
 * bean says so.
 *
 * Built once per process: the corpus is a compile-time constant, and this is a
 * ~39k-token string that used to be re-joined on every single chat turn.
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
    `\n## Reference Recipe Library (championship + named-expert recipes documented in the app; cite by name when you draw from one)\n\n` +
    `HOW MANY RECIPES A BREWER HAS IS NOT A RECOMMENDATION. It reflects what the coffee world has published, ` +
    `nothing else. ${ALL_RECIPES.length} recipes across ${groups.length} brewers: ` +
    groups.map(([b, rs]) => `${b} ${rs.length}`).join(", ") + `. ` +
    `The V60 is over-represented because it is the most written-about brewer on earth; the Orea has one entry ` +
    `and is still one of the user's primary cones. Choose the brewer for the BEAN and the goal, then adapt the ` +
    `nearest recipe to it — a recipe published on a V60 usually transfers to another cone with the same geometry. ` +
    `Never pick a brewer because this library happens to hold more recipes for it.\n`;

  recipeLibraryCache =
    header +
    groups
      .map(
        ([brewer, rs]) =>
          `\n### ${brewer} (${rs.length})\n\n` + rs.map(formatRecipeForPrompt).join("\n\n"),
      )
      .join("\n");
  return recipeLibraryCache;
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
export function cleanChatRecipe(recipe: BrewRecipe | undefined): BrewRecipe | undefined {
  if (!recipe) return undefined;
  const pourSteps = sanitizePourSteps(recipe.pourSteps);
  const out: BrewRecipe = {
    ...recipe,
    ...(pourSteps ? { pourSteps } : {}),
    pourSequence: recipe.pourSequence ?? pourSequenceFromSteps(pourSteps),
  };
  return reconcileWaterToPourPlan(out);
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
