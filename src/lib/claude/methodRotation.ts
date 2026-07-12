// Method fit-and-freshness signals for /recommend — NO bans.
//
// The owner-visible repetition ("always V60 and Clever water-first, whatever
// the context") had two structural causes, measured with a simulation of the
// real selection code:
//   - the system prompt's pairing rule read as "percolation + immersion", and
//     at a typical 250–350ml the capacity rules forbid AeroPress (>230ml) and
//     Moccamaster (<500ml) — so Clever was the ONLY immersion brewer left and
//     won the second slot every brew (fixed in recommendPrompt.ts: contrast
//     no longer requires an immersion vessel, and house-default pairings are
//     called out);
//   - for most everyday contexts several brewers genuinely fit EQUALLY well
//     (the recipe scoring produces wide ties), and the model resolved those
//     ties by habit — V60 as the most-documented default.
//
// The owner's design rule: nothing is ever banned; best fit always decides.
// So this module only produces FRESHNESS signals for tie-breaking:
//   1. a prompt block stating which brewers dominated the recent
//      recommendation sets, requiring a dominant brewer to EARN its slot with
//      an explicitly stated fit advantage — and directing equal-fit ties to
//      the least-recently-recommended brewer;
//   2. the same brewers as a Set for selectRecipes' `demoteBrewers`, which
//      moves their recipes to the BACK of their equal-score group in the
//      injected menu (ties only — a genuinely better-fitting recipe still
//      leads, and nothing is excluded).
//
// Inactive when a method is locked (user override) or for cold brew (the
// vessel-by-volume routing owns that world).

import type { Session } from "../types/session";
import type { BrewerType } from "../knowledge/recipes/types";
import { brewersFromMethod } from "../knowledge/recipes/helpers";

/** Brewer families as the user perceives them (an Orea Fast and an Orea
 * Classic are "the Orea again"; a cone or wave Origami is "the Origami"). */
export type BrewerFamily =
  | "v60"
  | "orea"
  | "origami"
  | "kalita"
  | "chemex"
  | "clever"
  | "aeropress"
  | "moccamaster";

const FAMILY_BREWERS: Record<BrewerFamily, BrewerType[]> = {
  v60: ["v60"],
  orea: ["orea-v4-fast", "orea-v4-wide", "orea-apex", "orea-classic", "orea-open"],
  origami: ["origami-cone", "origami-wave", "origami-air-m"],
  kalita: ["kalita-wave"],
  chemex: ["chemex"],
  clever: ["clever"],
  aeropress: ["aeropress", "aeropress-prismo"],
  moccamaster: ["moccamaster"],
};

const FAMILY_LABEL: Record<BrewerFamily, string> = {
  v60: "V60",
  orea: "Orea",
  origami: "Origami",
  kalita: "Kalita Wave",
  chemex: "Chemex",
  clever: "Clever Dripper",
  aeropress: "AeroPress",
  moccamaster: "Moccamaster",
};

const BREWER_TO_FAMILY: Map<BrewerType, BrewerFamily> = (() => {
  const m = new Map<BrewerType, BrewerFamily>();
  for (const [fam, brewers] of Object.entries(FAMILY_BREWERS) as [BrewerFamily, BrewerType[]][]) {
    for (const b of brewers) m.set(b, fam);
  }
  return m;
})();

/** Resolve a candidate's free-text method string ("V60", "Origami (cone)",
 * "Orea Fast", "V60 + Drip Assist", …) to its brewer family. Reuses the
 * equipment-pattern matcher so the vocabularies stay in sync. */
export function familyFromMethod(method?: string): BrewerFamily | null {
  if (!method) return null;
  for (const b of Array.from(brewersFromMethod(method))) {
    const fam = BREWER_TO_FAMILY.get(b);
    if (fam) return fam;
  }
  return null;
}

export interface MethodRecencyInput {
  /** context.preferredMethod — a locked method disables the signal entirely. */
  lockedMethod?: string;
  /** context.occasion — cold-brew disables the signal. */
  occasion?: string;
}

export interface MethodRecencyResult {
  /** Fit-and-freshness block for the user message; empty string when inactive. */
  note: string;
  /** Brewer types of the dominant families — for selectRecipes' demoteBrewers
   * (tie-break demotion in the injected menu; never an exclusion). */
  recentBrewers: Set<BrewerType>;
}

const INACTIVE: MethodRecencyResult = { note: "", recentBrewers: new Set() };

/** A family counts as "dominant" when it appeared (as a shown candidate's
 * method) in at least this many of the recent sessions. */
const DOMINANCE_THRESHOLD = 3;
/** How many recent sessions the window looks at. */
const WINDOW = 6;

/**
 * Compute the method fit-and-freshness signal for this brew from the methods
 * that appeared in the user's recent recommendation sets. Pure, deterministic,
 * and never a ban — see the module header.
 */
export function buildMethodRecency(
  pastSessions: Session[],
  input: MethodRecencyInput,
): MethodRecencyResult {
  if (input.lockedMethod && input.lockedMethod.trim()) return INACTIVE;
  if ((input.occasion?.toLowerCase() ?? "") === "cold-brew") return INACTIVE;

  const window = pastSessions.slice(0, WINDOW);
  if (window.length < DOMINANCE_THRESHOLD) return INACTIVE;

  // Per-family: in how many of the recent sessions did it appear as a shown
  // candidate's method?
  const presence = new Map<BrewerFamily, number>();
  for (const s of window) {
    const methods =
      s.recommendation?.candidates?.map((c) => c.method) ??
      [s.recommendation?.primaryMethod, s.recommendation?.alternativeMethod];
    const fams = new Set<BrewerFamily>();
    for (const m of methods) {
      const fam = familyFromMethod(m ?? undefined);
      if (fam) fams.add(fam);
    }
    for (const fam of Array.from(fams)) {
      presence.set(fam, (presence.get(fam) ?? 0) + 1);
    }
  }

  const dominant = Array.from(presence.entries())
    .filter(([, count]) => count >= DOMINANCE_THRESHOLD)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  if (dominant.length === 0) return INACTIVE;

  const recentBrewers = new Set<BrewerType>();
  for (const [fam] of dominant) {
    for (const b of FAMILY_BREWERS[fam]) recentBrewers.add(b);
  }

  const dominantStr = dominant
    .map(([fam, count]) => `${FAMILY_LABEL[fam]} (in ${count} of your last ${window.length} recommendation sets)`)
    .join(", ");

  const note =
    `\nMETHOD FIT & FRESHNESS: method choice must be re-derived from THIS coffee and THIS context — nothing is banned, best fit always decides. But these brewers have dominated your recent recommendation sets: ${dominantStr}. A dominant brewer must EARN its slot: include it only when it genuinely fits this coffee + context better than the alternatives, and state that specific, concrete advantage in whyChosen (if you cannot name one, it does not fit better). When several brewers fit equally well — which is common — choose the one LEAST recently recommended. The reference recipe library above is ordered best-fit-first with equal-fit ties broken toward brewers you have not seen lately; treat its order as meaningful.`;

  return { note, recentBrewers };
}
