/**
 * Techniques knowledge module.
 *
 * Atomic brewing techniques — the named moves that compose into recipes.
 * 18 entries spanning temperature staging (Hsu, Peng, Gagné, Hedrick),
 * agitation (Rao, Hoffmann, Perger, Rolf, Peng, Bailey), pour patterns
 * (Kasuya, Rao), pre-brew moves (Wallgren sieving, Peng layering,
 * Hatakeyama paper-matching), post-brew moves (Hoffmann/Stanica bypass,
 * flash chilling), vessel-specific (AeroPress inversion), and water
 * (Hendon's championship-water principles).
 *
 * Each technique cross-references the recipes that exemplify it, so the
 * brain can cite both the mechanism and a worked example when teaching.
 */

export type { Technique, TechniqueCategory } from "./types";

export { TECHNIQUES } from "./data";

export {
  getTechniqueById,
  getTechniquesForRecipe,
  getTechniquesByCategory,
  getTechniquesForBrewer,
  formatTechniqueForPrompt,
  formatTechniquesForPrompt,
} from "./helpers";
