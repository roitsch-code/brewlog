/**
 * Recipes knowledge module.
 *
 * Structured representation of canonical specialty-coffee recipes —
 * World Brewers Cup + World AeroPress Championship winners
 * (`championship.ts`) and reference recipes from named experts
 * (`reference.ts` — Hoffmann, Rao, Kasuya, Perger, Rolf, Gagné,
 * Hatakeyama, Wallgren, etc.).
 *
 * Consumed by /recommend and /explore via the helpers in `helpers.ts`.
 */

export type {
  Recipe,
  BrewerType,
  RoastLevel,
  Process,
  Goal,
  TemperatureSpec,
  StagedTemperature,
  GrindSpec,
  PourAction,
  PourStep,
  Source,
} from "./types";

export { CHAMPIONSHIP_RECIPES } from "./championship";
export { REFERENCE_RECIPES } from "./reference";
export { EXPANDED_RECIPES } from "./expanded";
export { MARKUS_ADDITIONS } from "./markusAdditions";

export {
  ALL_RECIPES,
  CANONICAL_EQUIPMENT,
  brewersAvailableFromEquipment,
  brewersFromMethod,
  normaliseRoastLevel,
  normaliseProcess,
  normaliseGoal,
  selectRecipes,
  getRecipeById,
  findRecipesByPerson,
  formatRecipeForPrompt,
  formatRecipesForPrompt,
} from "./helpers";

export type { RecipeSelectionInput, ScoredRecipe } from "./helpers";
