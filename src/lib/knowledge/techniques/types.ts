import type { BrewerType, Source } from "../recipes/types";

/**
 * Structured technique entries.
 *
 * Where `recipes/` answers "give me a complete brew prescription," and
 * `varieties/` answers "what does this coffee genetically want," the
 * `techniques/` module answers "what specific *moves* are available, and
 * what does each one do mechanistically?"
 *
 * Techniques are atomic — they compose into recipes. The brain can cite
 * a technique ("apply Rao's spin") and reason about
 * its mechanism without needing to drop in a full recipe.
 */

export type TechniqueCategory =
  | "agitation"
  | "temperature"
  | "water"
  | "pour-pattern"
  | "grind"
  | "pre-brew"
  | "post-brew"
  | "vessel-specific";

export interface Technique {
  /** Stable identifier — "swirl-not-stir", "rao-spin", "fines-removal". */
  id: string;
  /** Full canonical name. */
  name: string;
  /** Short cite-form for prompts ("Rao spin", "Hsu staging"). */
  shortName?: string;

  /** Who first published or popularised the technique. */
  attribution: {
    person: string;
    title?: string;
    year?: number;
  };

  category: TechniqueCategory;

  /** What variables this technique manipulates. Tags. */
  manipulates: string[];

  /** 1–2 sentences: what the technique does, plainly. */
  description: string;
  /** 2–4 sentences: the mechanism. WHY does it work? */
  mechanism: string;
  /** 1–2 sentences: when a brewer should reach for this. */
  whenToUse: string;
  /** When NOT to use it — what it interferes with. */
  contraindications?: string[];

  /** Equipment that is strictly required. */
  requiredEquipment?: string[];
  /** Brewers this technique can be applied to. */
  compatibleBrewers?: BrewerType[];

  /** Recipe IDs in the corpus that exemplify this technique. */
  exemplifiedBy: string[];

  sources: Source[];
  /** True when published by the original author with documented mechanics. */
  verified: boolean;
  /** Caveats, variants, or honest gaps. */
  notes?: string;
}
