/**
 * Varieties knowledge module.
 *
 * Structured priors for ~25 Arabica varieties / cultivars covering the
 * canon a specialty roaster will source: Bourbon family (Bourbon, Caturra,
 * Catuai, Mundo Novo, Pacas, Yellow Bourbon, Pink Bourbon), Typica family
 * (Typica, Java, Maragogype, Sumatra), Ethiopian landraces (Heirloom,
 * Wush Wush, Chiroso, Sidra), Geisha, the Kenyan SL series (SL28, SL34,
 * Ruiru 11, Batian), Colombian disease-resistant cultivars (Castillo,
 * Tabi), F1 hybrids (Centroamericano), Pacamara, and Mokka.
 *
 * Genetic / agronomic facts source: World Coffee Research Arabica Coffee
 * Varieties Catalog. Cup descriptions: specialty-industry consensus.
 *
 * Consumed by /recommend and /explore via `formatVarietyPriorsForPrompt`.
 */

export type {
  VarietyPrior,
  GeneticFamily,
  IntensityLevel,
  DepthLevel,
  AromaticLevel,
  CommonProcess,
  VarietySource,
} from "./types";

export { VARIETY_PRIORS } from "./data";

export {
  getVarietyPrior,
  getVarietyPriorsForBag,
  formatVarietyPriorForPrompt,
  formatVarietyPriorsForPrompt,
} from "./helpers";
