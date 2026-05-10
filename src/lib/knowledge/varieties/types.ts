/**
 * Structured priors for Arabica coffee varieties (cultivars).
 *
 * Sourced primarily from World Coffee Research's Arabica Coffee Varieties
 * Catalog (the only non-commercial, research-grade variety reference) plus
 * specialty-industry-canonical cup descriptions from Royal Coffee / The
 * Crown's *Green Coffee Book*, Sucafina origin profiles, and well-attested
 * trade publications.
 *
 * The data lives in `data.ts`; this file defines the type surface.
 *
 * Honest caveat about WCR vs. cup descriptions:
 *   WCR provides authoritative genetic family, parentage, and agronomic
 *   information. Cup descriptions in this module synthesise the
 *   specialty-coffee industry consensus — they are not WCR-published cup
 *   notes (WCR is conservative about cup claims because cup outcomes depend
 *   heavily on terroir, processing, and roast, which are outside genetics).
 *   Each entry's `confidence` field marks the source of authority.
 */

export type GeneticFamily =
  | "Bourbon"
  | "Typica"
  | "SL series"
  | "Geisha"
  | "Ethiopia landrace"
  | "F1 hybrid"
  | "Catimor / Sarchimor"
  | "Pacamara"
  | "Mokka"
  | "Other";

export type IntensityLevel = "low" | "moderate" | "high" | "varies";
export type DepthLevel = "light" | "medium" | "full" | "varies";
export type AromaticLevel = "delicate" | "moderate" | "intense" | "varies";

/**
 * Process tags for the variety's typical processing pairings — helps the
 * brain pre-bias recipe selection (e.g. Wush Wush is most often natural,
 * SL28 most often washed).
 */
export type CommonProcess =
  | "washed"
  | "natural"
  | "honey"
  | "anaerobic"
  | "experimental"
  | "any";

export interface VarietySource {
  type:
    | "wcr-catalog"
    | "industry-canonical"
    | "trade-publication"
    | "research-paper"
    | "interview";
  citation: string;
  url?: string;
  year?: number;
}

export interface VarietyPrior {
  /** Canonical name. Use the WCR catalog spelling when one exists. */
  name: string;
  /** Common alternate spellings and synonyms. */
  aliases?: string[];

  geneticFamily: GeneticFamily;
  /** Verified parentage when known, or "unknown / wild population" for landraces. */
  parentage?: string;
  /** Country/region where the variety was first identified or developed. */
  origin: string;
  /** Year of first formal identification, where known. */
  identifiedYear?: number;

  /** 1–2 sentence canonical cup description. */
  cupSignature: string;

  acidity: IntensityLevel;
  body: DepthLevel;
  aromatics: AromaticLevel;

  /**
   * Bean density at typical altitude — higher density = harder, slower to
   * extract, often higher solubility once extracted, more aromatic
   * complexity. Lower density = faster, often less complex.
   */
  density: IntensityLevel;
  /** Soluble-mass content. Drives extraction efficiency. */
  solubility: IntensityLevel;

  /** 2–3 sentences on extraction approach for this variety. */
  brewingTendencies: string;

  /** Which processings are commonly applied to this variety. */
  commonProcessings: CommonProcess[];

  /** Recipe IDs (from src/lib/knowledge/recipes) that suit this variety well. */
  pairsWellWithRecipes: string[];

  /** Common extraction pitfalls — over-extraction risks, under-extraction risks. */
  extractionRisks: string[];

  /** Free-form additional context — typical farms, breeders, market position. */
  notes: string;

  /**
   * Confidence in this prior:
   *   wcr-curated      — genetic / agronomic facts traceable to WCR catalog;
   *                      cup description is industry consensus.
   *   industry-canonical — variety not in WCR catalog (e.g. some new hybrids,
   *                      Ethiopian landraces) but well-documented in trade
   *                      publications.
   *   inferred         — limited public documentation; treat with caution.
   */
  confidence: "wcr-curated" | "industry-canonical" | "inferred";

  sources: VarietySource[];
}
