import type { VarietyPrior } from "./types";
import { VARIETY_PRIORS } from "./data";

/**
 * Canonical slug for a variety name — strips common decorators
 * ("Variety:", parenthetical region, "(Panama)") and punctuation so that
 * "Geisha", "Geisha (Panama)", and "Panamanian Geisha" all map to the
 * same entry.
 */
function canonicalVarietySlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/\b(variety|var\.?|cultivar)\b/gi, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s/g, "-");
}

/**
 * Look up a single variety by name (case-insensitive, alias-aware,
 * slug-tolerant). Returns undefined if not found.
 */
export function getVarietyPrior(name: string): VarietyPrior | undefined {
  if (!name) return undefined;
  const normalised = name.toLowerCase().trim();
  const slug = canonicalVarietySlug(name);
  return (
    VARIETY_PRIORS.find((v) => v.name.toLowerCase() === normalised) ??
    VARIETY_PRIORS.find((v) => canonicalVarietySlug(v.name) === slug) ??
    VARIETY_PRIORS.find((v) =>
      v.aliases?.some((a) => canonicalVarietySlug(a) === slug)
    ) ??
    VARIETY_PRIORS.find((v) => {
      const n = v.name.toLowerCase();
      return normalised.includes(n) || n.includes(normalised);
    })
  );
}

/**
 * A bag's variety field can list multiple varieties separated by " / ",
 * " + ", " & ", "and", or commas (e.g. "SL28 / SL34", "Caturra, Castillo").
 * This splits and resolves each token against the catalog.
 */
export function getVarietyPriorsForBag(
  rawVariety: string | undefined
): VarietyPrior[] {
  if (!rawVariety) return [];
  const tokens = rawVariety
    .split(/\s*(?:[,/+&]|\band\b)\s*/i)
    .map((t) => t.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: VarietyPrior[] = [];
  for (const t of tokens) {
    const prior = getVarietyPrior(t);
    if (prior && !seen.has(prior.name)) {
      seen.add(prior.name);
      out.push(prior);
    }
  }
  return out;
}

/** Format a single variety prior as a compact prompt block. */
export function formatVarietyPriorForPrompt(prior: VarietyPrior): string {
  const lines = [
    `▸ ${prior.name}${prior.aliases?.length ? ` (also: ${prior.aliases.join(", ")})` : ""}`,
    `  Genetic family: ${prior.geneticFamily}${prior.parentage ? ` — ${prior.parentage}` : ""}`,
    `  Origin: ${prior.origin}${prior.identifiedYear ? ` (${prior.identifiedYear})` : ""}`,
    `  Cup signature: ${prior.cupSignature}`,
    `  Profile: acidity ${prior.acidity} | body ${prior.body} | aromatics ${prior.aromatics} | density ${prior.density} | solubility ${prior.solubility}`,
    `  Brewing tendencies: ${prior.brewingTendencies}`,
    `  Common processings: ${prior.commonProcessings.join(", ")}`,
    prior.pairsWellWithRecipes.length
      ? `  Pairs well with: ${prior.pairsWellWithRecipes.join(", ")}`
      : "",
    `  Extraction risks: ${prior.extractionRisks.join("; ")}`,
    `  Notes: ${prior.notes}`,
    `  Confidence: ${prior.confidence}`,
  ].filter(Boolean);
  return lines.join("\n");
}

/**
 * Format one or more variety priors as a system-prompt block.
 * Used by /recommend and /explore — injected once per turn when the bag's
 * variety field resolves to one or more known priors.
 */
export function formatVarietyPriorsForPrompt(
  priors: VarietyPrior[],
  header = "VARIETY PRIORS"
): string {
  if (!priors.length) return "";
  const intro =
    priors.length === 1
      ? `${header} — what genetics tell us about this coffee. Treat as a moderate prior; the lot's altitude, terroir, and processing modulate the variety's defaults.`
      : `${header} (${priors.length} varieties in this lot — likely blended) — what genetics tell us. The cup will reflect a composite, not any single variety alone.`;
  return `${intro}\n\n${priors.map(formatVarietyPriorForPrompt).join("\n\n")}`;
}
