/**
 * Structured representation of a coffee brewing recipe.
 *
 * Designed so the recommendation/explore engines can:
 *  - select recipes by coffee properties, brewer, and goal,
 *  - cite attribution accurately (who, year, competition or publication),
 *  - reproduce the mechanics (dose, water, staged temp, pour sequence) faithfully,
 *  - reason about the technique (what it tests for, what mechanism is at play).
 *
 * The data lives in `championship.ts` (WBrC / WAC winners) and `reference.ts`
 * (named recipes from canonical experts — Hoffmann, Rao, Kasuya, Rolf, Gagné, etc.).
 */

export type BrewerType =
  | "v60"
  | "orea-v4-fast"
  | "orea-v4-wide"
  | "orea-apex"
  | "orea-classic"
  | "orea-open"
  | "origami-cone"
  | "origami-wave"
  | "origami-air-m"
  | "clever"
  | "kalita-wave"
  | "aeropress"
  | "aeropress-prismo"
  | "moccamaster"
  | "chemex"
  | "solo-dripper"
  | "cafec-flower"
  | "conical-paper";

export type RoastLevel =
  | "very-light"
  | "light"
  | "medium-light"
  | "medium"
  | "medium-dark"
  | "dark";

export type Process =
  | "washed"
  | "natural"
  | "honey"
  | "anaerobic"
  | "experimental"
  | "any";

export type Goal =
  | "balanced"
  | "high-clarity"
  | "sweetness-forward"
  | "body-forward"
  | "aromatic"
  | "explore";

/** A specific in-recipe pour temperature, when the recipe stages temperature. */
export interface StagedTemperature {
  /** 0-indexed: which pour event this temperature applies to. */
  pourIndex: number;
  celsius: number;
  /** Optional descriptor — "bloom", "development", "aroma-preservation". */
  label?: string;
}

export interface TemperatureSpec {
  /** Single working temperature when the recipe is not staged. */
  celsius?: number;
  /** Acceptable working range — informational, not selection criterion. */
  rangeC?: [number, number];
  /** Per-pour temperatures when the recipe explicitly stages. */
  staged?: StagedTemperature[];
}

export interface GrindSpec {
  /** Grinder the original recipe was published against. */
  referenceGrinder?: string;
  /** Setting on that reference grinder ("58 clicks", "490 µm", "1.6 EK"). */
  referenceSetting?: string;
  /** Approximate Niche Zero degrees — single value or working range. */
  nicheZeroDegrees?: number | [number, number];
  /** Free-text descriptor for grind feel ("medium-fine, like table salt"). */
  description?: string;
}

export type PourAction =
  | "pour"
  | "stir"
  | "swirl"
  | "wait"
  | "press"
  | "invert"
  | "flip"
  | "drain"
  | "bypass"
  | "melodrip"
  | "agitate-bed";

export interface PourStep {
  /** Human label — "Bloom", "Pour 1", "Steep". */
  label: string;
  action: PourAction;
  /** Cumulative water in the brewer after this step (grams). */
  waterGramsAtEnd?: number;
  /** Duration of this step in seconds. */
  durationSec?: number;
  /** Per-step temperature override (for staged-temperature recipes). */
  temperatureC?: number;
  notes?: string;
}

export interface Source {
  type:
    | "official-competition"
    | "video"
    | "article"
    | "book"
    | "report"
    | "transcript"
    | "interview"
    | "blog";
  citation: string;
  url?: string;
  year?: number;
}

export interface Recipe {
  /** Stable identifier — "wbrc-2024-wolfl", "hoffmann-clever-ultimate". */
  id: string;
  /** Full canonical name. */
  name: string;
  /** Short cite-form name ("Wölfl 2024", "Hoffmann Clever"). */
  shortName: string;

  attribution: {
    person: string;
    title?: string;
    affiliation?: string;
    country?: string;
    year?: number;
  };

  category: "championship" | "reference" | "experimental";
  brewer: BrewerType;
  /** Specific equipment notes — "Orea V4 Fast bottom", "Solo PCTG 40°". */
  brewerNotes?: string;

  dose: { grams: number };
  water: {
    grams: number;
    /** Pre-computed ratio string — "1:15", "1:14.3". */
    ratio: string;
  };
  temperature: TemperatureSpec;
  grind: GrindSpec;
  pourSequence: PourStep[];
  totalTimeSec: number;

  /** Tags for the techniques this recipe employs. */
  techniques: string[];

  bestFor: {
    roastLevels?: RoastLevel[];
    processes?: Process[];
    varieties?: string[];
    goals?: Goal[];
    occasions?: string[];
  };

  /** 1–2 sentences: what does this recipe demonstrate or test for? */
  teaches: string;
  /** 2–4 sentences: the mechanism. WHY does it work? */
  science: string;
  /** 1–2 sentences: when would a brewer reach for this recipe? */
  whenToUse: string;

  sources: Source[];
  /**
   * `true` when mechanics are agreed across multiple independent sources.
   * `false` when third-party transcriptions diverge — the entry preserves
   * the consensus skeleton (dose, water, temp, brewer) but secondary
   * details (exact pour sequence, agitation timing) may not match the
   * original routine. The brain should still cite the recipe but flag
   * uncertainty when teaching from it.
   */
  verified: boolean;
  /** Caveats, known variants, source disagreements. */
  notes?: string;
}
