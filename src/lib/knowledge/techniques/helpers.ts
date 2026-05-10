import type { Technique, TechniqueCategory } from "./types";
import { TECHNIQUES } from "./data";
import type { BrewerType } from "../recipes/types";

/** Look up a single technique by id. */
export function getTechniqueById(id: string): Technique | undefined {
  return TECHNIQUES.find((t) => t.id === id);
}

/** All techniques applied by a given recipe. */
export function getTechniquesForRecipe(recipeId: string): Technique[] {
  return TECHNIQUES.filter((t) => t.exemplifiedBy.includes(recipeId));
}

/** Filter techniques by category. */
export function getTechniquesByCategory(
  category: TechniqueCategory
): Technique[] {
  return TECHNIQUES.filter((t) => t.category === category);
}

/** All techniques compatible with a given brewer. */
export function getTechniquesForBrewer(brewer: BrewerType): Technique[] {
  return TECHNIQUES.filter(
    (t) => !t.compatibleBrewers || t.compatibleBrewers.includes(brewer)
  );
}

/** Format a single technique as a compact prompt block. */
export function formatTechniqueForPrompt(t: Technique): string {
  const lines = [
    `▸ ${t.name}${t.shortName && t.shortName !== t.name ? ` (${t.shortName})` : ""} — ${t.attribution.person}${t.attribution.year ? ` (${t.attribution.year})` : ""}`,
    `  Category: ${t.category} | Manipulates: ${t.manipulates.join(", ")}`,
    `  ${t.description}`,
    `  Mechanism: ${t.mechanism}`,
    `  When to use: ${t.whenToUse}`,
    t.contraindications?.length
      ? `  Avoid when: ${t.contraindications.join("; ")}`
      : "",
    t.requiredEquipment?.length
      ? `  Required equipment: ${t.requiredEquipment.join("; ")}`
      : "",
    t.exemplifiedBy.length
      ? `  Exemplified by: ${t.exemplifiedBy.join(", ")}`
      : "",
  ].filter(Boolean);
  return lines.join("\n");
}

/**
 * Format a list of techniques as a system-prompt block. Used by /explore
 * when teaching mechanism, and by /recommend when the brain wants to cite
 * the underlying technique behind a recommended recipe.
 */
export function formatTechniquesForPrompt(
  techniques: Technique[],
  header = "RELEVANT BREWING TECHNIQUES"
): string {
  if (!techniques.length) return "";
  const intro = `${header} (${techniques.length}) — atomic moves with documented mechanism. Cite by name when reasoning about why a recipe works.`;
  return `${intro}\n\n${techniques.map(formatTechniqueForPrompt).join("\n\n")}`;
}
