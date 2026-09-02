import type {
  Recipe,
  BrewerType,
  RoastLevel,
  Process,
  Goal,
} from "./types";
import { vesselCannotServe } from "../../utils/vesselCapacity";
import { CHAMPIONSHIP_RECIPES } from "./championship";
import { REFERENCE_RECIPES } from "./reference";
import { EXPANDED_RECIPES } from "./expanded";
import { MARKUS_ADDITIONS } from "./markusAdditions";
import { OREA_WIDE_RECIPES } from "./oreaWide";

export const ALL_RECIPES: Recipe[] = [
  ...CHAMPIONSHIP_RECIPES,
  ...REFERENCE_RECIPES,
  ...EXPANDED_RECIPES,
  ...MARKUS_ADDITIONS,
  ...OREA_WIDE_RECIPES,
];

/**
 * Maps free-text equipment strings (preferences.equipment) to the structured
 * BrewerType used by recipes. The matcher normalises the input (lowercase,
 * stripped of spaces/punctuation/parentheses) so "V60", "V60 + Drip Assist",
 * "OreaV4", "Origami (cone)", and "CleverDripper" all resolve correctly.
 *
 * A single recipe brewer (e.g. "v60") can match multiple equipment strings.
 */
function normaliseEquipmentKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\bdrip\s*assist\b/g, "")
    .replace(/[()+\-]/g, " ")
    .replace(/\s+/g, "")
    .trim();
}

const EQUIPMENT_PATTERNS: Array<{
  match: (k: string) => boolean;
  brewers: BrewerType[];
}> = [
  // Specific Orea bottoms first (so 'oreafast' doesn't get caught by 'orea').
  {
    match: (k) => k.includes("oreafast"),
    brewers: ["orea-v4-fast"],
  },
  {
    match: (k) => k.includes("oreaapex"),
    brewers: ["orea-apex"],
  },
  {
    match: (k) => k.includes("oreaclassic"),
    brewers: ["orea-classic"],
  },
  {
    match: (k) => k.includes("oreaopen"),
    brewers: ["orea-open"],
  },
  {
    match: (k) => k.includes("oreawide"),
    brewers: ["orea-v4-wide", "orea-v4-fast"],
  },
  {
    // Generic "Orea" or "OreaV4" — user has the modular V4, all bottoms
    // count as available.
    match: (k) => k.startsWith("oreav4") || k === "orea",
    brewers: [
      "orea-v4-wide",
      "orea-v4-fast",
      "orea-apex",
      "orea-classic",
      "orea-open",
    ],
  },
  // Origami — disambiguate by filter shape, with a generic fallback.
  {
    match: (k) => k.includes("origami") && k.includes("cone"),
    brewers: ["origami-cone"],
  },
  {
    match: (k) => k.includes("origami") && k.includes("wave"),
    brewers: ["origami-wave"],
  },
  {
    match: (k) => k.includes("origamiairm") || k.includes("airm"),
    // The Origami Air M physically takes BOTH a V60 conical filter and a
    // Kalita Wave flat-bottom filter, so every cone- and wave-shaped Origami
    // recipe is brewable on it. (There is no recipe with brewer
    // "origami-air-m" — mapping it there would dead-end and hide all Origami
    // recipes, which was the cause of Origami being under-represented.)
    brewers: ["origami-cone", "origami-wave"],
  },
  {
    match: (k) => k.includes("origami"),
    brewers: ["origami-cone", "origami-wave"],
  },
  // V60 — including "+ Drip Assist" variants (drip-assist is stripped above).
  {
    match: (k) => k.includes("v60") || k.includes("hariov60"),
    brewers: ["v60"],
  },
  // Other brewers.
  {
    match: (k) => k.includes("clever"),
    brewers: ["clever"],
  },
  {
    match: (k) => k.includes("kalita"),
    brewers: ["kalita-wave"],
  },
  {
    match: (k) => k.includes("aeropress"),
    brewers: ["aeropress", "aeropress-prismo"],
  },
  {
    match: (k) => k.includes("moccamaster") || k.includes("technivorm"),
    brewers: ["moccamaster"],
  },
  {
    match: (k) => k.includes("chemex"),
    brewers: ["chemex"],
  },
  {
    match: (k) => k.includes("solo"),
    brewers: ["solo-dripper"],
  },
  {
    match: (k) => k.includes("cafec") || k.includes("flower"),
    brewers: ["cafec-flower"],
  },
  // Cold-brew jar / large immersion vessel — any pitcher or jar. Always part
  // of the canonical kit (everyone has a jar), so big cold-brew batches have a
  // valid home instead of being mis-tagged onto a small Clever/AeroPress.
  {
    match: (k) => k.includes("jar") || k.includes("coldbrew") || k.includes("pitcher"),
    brewers: ["cold-brew-jar"],
  },
];

/**
 * The owner's full, real brewing kit (single-user app — see CLAUDE.md
 * "User / Equipment Profile"). The onboarding equipment picker is a thin
 * subset (it never offered Origami or Chemex), so a recommendation that keyed
 * ONLY off the stored onboarding row silently filtered out every Origami and
 * Chemex recipe. We union this canonical kit into brewersAvailable so the
 * recipe selector always sees the brewers the owner actually has. Strings are
 * chosen to resolve through EQUIPMENT_PATTERNS (e.g. "Origami" → cone + wave).
 */
export const CANONICAL_EQUIPMENT: string[] = [
  "V60",
  "OreaV4",
  "Origami",
  "Kalita",
  "CleverDripper",
  "AeroPress",
  "Moccamaster",
  "Chemex",
  "ColdBrewJar",
];

export function brewersAvailableFromEquipment(
  equipment: string[]
): Set<BrewerType> {
  const set = new Set<BrewerType>();
  for (const raw of equipment) {
    const key = normaliseEquipmentKey(raw);
    for (const { match, brewers } of EQUIPMENT_PATTERNS) {
      if (match(key)) {
        for (const b of brewers) set.add(b);
        break;
      }
    }
  }
  return set;
}

/** Parse a user-supplied roast-level string into the canonical RoastLevel. */
export function normaliseRoastLevel(input?: string): RoastLevel | undefined {
  if (!input) return undefined;
  const n = input.toLowerCase().trim();
  if (n.includes("very light") || n.includes("very-light") || n.includes("nordic"))
    return "very-light";
  if (n.includes("light-medium") || n.includes("medium-light"))
    return "medium-light";
  if (n.includes("medium-dark")) return "medium-dark";
  if (n === "light" || n.startsWith("light")) return "light";
  if (n === "medium" || n.startsWith("medium")) return "medium";
  if (n === "dark" || n.startsWith("dark")) return "dark";
  return undefined;
}

/** Parse a user-supplied process string into the canonical Process. */
export function normaliseProcess(input?: string): Process | undefined {
  if (!input) return undefined;
  const n = input.toLowerCase().trim();
  if (n.includes("anaerobic") || n.includes("carbonic")) return "anaerobic";
  if (n.includes("natural") || n.includes("dry")) return "natural";
  if (n.includes("honey") || n.includes("pulped")) return "honey";
  if (n.includes("washed") || n.includes("wet")) return "washed";
  if (n.includes("experimental") || n.includes("yeast") || n.includes("co-ferment"))
    return "experimental";
  return undefined;
}

/** Map the user's `intent` field (SessionContext.intent) to a recipe Goal. */
export function normaliseGoal(input?: string): Goal {
  if (!input) return "balanced";
  const n = input.toLowerCase().trim();
  if (n === "high-clarity" || n.includes("clarity")) return "high-clarity";
  if (n === "aromatic" || n.includes("aromatic") || n.includes("floral"))
    return "aromatic";
  if (n === "sweetness-forward" || n.includes("sweet")) return "sweetness-forward";
  if (n === "body-forward" || n.includes("body")) return "body-forward";
  if (n === "explore" || n.includes("explor") || n === "educational")
    return "explore";
  return "balanced";
}

export interface RecipeSelectionInput {
  brewersAvailable: Set<BrewerType>;
  roastLevel?: RoastLevel;
  process?: Process;
  /**
   * Blend processes — a coffee with 2+ components can span processes
   * (e.g. Natural + Washed). When set, a recipe scores the process match if it
   * suits ANY component's process, instead of the single `process` collapsing
   * to the first one. Single-origin bags leave this empty and use `process`.
   */
  processes?: Process[];
  variety?: string;
  goal: Goal;
  occasion?: string;
  maxWaterMl?: number;
  /**
   * The exact drink volume the user asked for (ml). When set, recipes on a
   * vessel that physically can't serve it are hard-excluded (e.g. AeroPress for
   * 450ml). Set ONLY for plain hot brews — omitted for iced / cold brew (vessel
   * holds less than the drink) and when a method is locked (USER OVERRIDE).
   */
  serveVolumeMl?: number;
  /**
   * When the user locks a specific brew method in the flow (preferredMethod),
   * pass the resolved BrewerType(s) here. Selection is then HARD-FILTERED to
   * those brewers and the per-brewer diversity cap is lifted — the user wants
   * the best recipes *for that method*, not a portfolio across their kit.
   */
  lockedBrewers?: Set<BrewerType>;
  /**
   * Rotation seed for tie-breaking. Recipes that score EQUALLY are genuinely
   * interchangeable (equal best-match ranking — no pedigree bonus, PR #193), so
   * rotating which equal-scoring recipe leads across brews stops the same menu
   * (and the same per-brewer winner, e.g. Clever water-first) from being
   * injected every single time. Pass a value that changes per brew — the latest
   * session's timestamp is a good seed; the session COUNT is not (the client
   * caps how many sessions it sends, so a count saturates and the rotation
   * freezes). Deterministic per call; ties only — a higher score is NEVER
   * demoted below a lower one.
   */
  rotationSeed?: number;
  /**
   * Reference-recipe names that surfaced in the user's recent sessions (the
   * candidates' `basedOn` strings). Within each EQUAL-score group these are
   * moved to the back, so an equally-good recipe the user has NOT just seen
   * takes the slot (and the per-brewer diversity win). Ties only — a
   * recently-used recipe that genuinely outscores the field still leads.
   */
  recentReferenceNames?: string[];
  /**
   * Brewers that dominated the user's recent recommendation sets. Within each
   * EQUAL-score group their recipes are moved to the back — an equally-good
   * recipe on a fresher brewer takes the slot (and the per-brewer diversity
   * win). Ties only, NEVER an exclusion: a recipe on a dominant brewer that
   * genuinely outscores the field still leads (best fit always decides).
   * Ignored when a method is locked.
   */
  demoteBrewers?: Set<BrewerType>;
  /**
   * Exclude recipes whose DESIGN builds in a long wait — a steep or a long rest
   * between pours (see hasLongDesignedWait). Set when the user locked the Hario
   * Drip Assist disc: the disc distributes water across the whole bed so it
   * drains almost as fast as it's poured, which makes a designed steep / minutes-
   * long pause pointless (owner: "das macht mit der Disc keinen Sinn"). The
   * recipes are NOT rewritten — they're just not offered for the disc. Falls back
   * to the unfiltered set if excluding would leave nothing.
   */
  excludeLongWaits?: boolean;
}

/**
 * Resolve the flow's preferredMethod string ("V60", "Orea Fast", "Chemex",
 * "Origami (wave)", …) to the BrewerType(s) it should match. Reuses the same
 * normalisation as equipment matching so the vocabularies stay in sync.
 */
export function brewersFromMethod(method?: string): Set<BrewerType> {
  if (!method || !method.trim()) return new Set();
  return brewersAvailableFromEquipment([method]);
}

export interface ScoredRecipe {
  recipe: Recipe;
  score: number;
  reasons: string[];
}

/**
 * Score a single recipe against the brew context. Higher = more relevant.
 * Recipes that fail the hard brewer filter return null (excluded entirely).
 */
function scoreRecipe(
  recipe: Recipe,
  input: RecipeSelectionInput
): ScoredRecipe | null {
  // Hard filter: must be brewable on equipment the user owns.
  if (!input.brewersAvailable.has(recipe.brewer)) return null;

  // Hard filter: cold-brew long steeps and the rest of the corpus are mutually
  // exclusive. A 12-hour cold steep must never surface for a morning V60, and a
  // cold-brew occasion must never pull a hot pour-over. Identify a cold steep by
  // its hours-long total time or its explicit cold-brew occasion tag.
  const isColdBrewRecipe =
    recipe.totalTimeSec >= 3600 ||
    !!recipe.bestFor.occasions?.some((o) => o.toLowerCase() === "cold-brew");
  const wantColdBrew = input.occasion?.toLowerCase() === "cold-brew";
  if (isColdBrewRecipe !== wantColdBrew) return null;

  // Hard filter: same mutual exclusion for ICED. A flash/Japanese-iced recipe
  // brews a concentrated hot portion onto ice — its dose, ratio, grind and
  // timing only make sense as an iced brew, and a hot pour-over recipe is not
  // an iced recipe with less water. Until now "summer-time" was only a soft
  // +2 score, so a summer-time menu could be mostly hot recipes and the prompt
  // had to carry its own numbered iced list to compensate. That literal list
  // was byte-identical on every call — one of the reasons the same iced recipes
  // came back every time. With this filter the per-turn library IS the iced
  // menu (8 documented entries), so the prompt keeps only the iced RULES.
  const isIcedRecipe = !!recipe.bestFor.occasions?.some(
    (o) => o.toLowerCase() === "summer-time" || o.toLowerCase() === "iced",
  );
  const wantIced = input.occasion?.toLowerCase() === "summer-time";
  if (isIcedRecipe !== wantIced) return null;

  // Hard filter: if a water cap is set, exclude recipes whose total water
  // exceeds it by more than 20% (some recipes have published variants at
  // larger doses).
  if (input.maxWaterMl && recipe.water.grams > input.maxWaterMl * 1.2) {
    return null;
  }

  // Hard filter: exclude vessels that physically can't SERVE the requested
  // drink volume (e.g. an AeroPress for a 450ml brew) so the model is never
  // handed a forbidden-vessel reference and tempted to clamp the water down to
  // fit it (the "450ml request → 180ml AeroPress" bug). Mirrors the prompt's
  // HARD CAPACITY CONSTRAINT. The caller only sets serveVolumeMl for plain hot
  // brews (omitted for iced / cold brew, where the vessel holds less than the
  // drink volume) and never when a method is locked (USER OVERRIDE).
  if (input.serveVolumeMl && vesselCannotServe(recipe.brewer, input.serveVolumeMl)) {
    return null;
  }

  let score = 0;
  const reasons: string[] = [];

  if (input.roastLevel && recipe.bestFor.roastLevels?.includes(input.roastLevel)) {
    score += 2;
    reasons.push(`roast match (${input.roastLevel})`);
  }

  // Process match — union over blend components when present, else the single
  // process. A blend "Natural + Washed" credits a recipe suited to either.
  const wantProcesses =
    input.processes && input.processes.length
      ? input.processes
      : input.process
        ? [input.process]
        : [];
  const processHit = wantProcesses.some((p) => recipe.bestFor.processes?.includes(p));
  if (processHit) {
    score += 2;
    reasons.push(`process match (${wantProcesses.filter((p) => recipe.bestFor.processes?.includes(p)).join("/")})`);
  } else if (recipe.bestFor.processes?.includes("any")) {
    score += 1;
  }

  if (input.variety && recipe.bestFor.varieties) {
    const v = input.variety.toLowerCase();
    const match = recipe.bestFor.varieties.find((rv) =>
      v.includes(rv.toLowerCase())
    );
    if (match) {
      score += 3;
      reasons.push(`variety match (${match})`);
    }
  }

  if (recipe.bestFor.goals?.includes(input.goal)) {
    score += 2;
    reasons.push(`goal match (${input.goal})`);
  }

  if (
    input.occasion &&
    recipe.bestFor.occasions?.some((o) =>
      input.occasion!.toLowerCase().includes(o.toLowerCase())
    )
  ) {
    score += 2;
    reasons.push(`occasion match`);
  }

  // No pedigree or verification bonus: every recipe is ranked purely on how
  // well it matches the brew context (roast / process / variety / goal /
  // occasion). All 135 recipes — championship, reference, and the Markus
  // additions — compete on equal footing, best-match wins.

  return { recipe, score, reasons };
}

/**
 * Rotate the order WITHIN each equal-score group by `seed`, leaving the
 * relative order of different score levels untouched. Equal-scoring recipes are
 * interchangeable best-matches, so taking turns leading across brews varies the
 * injected menu (and the per-brewer diversity winner) without ever demoting a
 * higher-scoring recipe below a lower one. Deterministic for a given seed.
 */
/** Lowercase-alnum normalisation for recipe-name matching (mirrors
 * recipeFidelity's norm() so `basedOn` strings bind the same way). */
function normName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Within each equal-score group, move recipes matching `isDemoted` to the
 * back — an equal-scored fresh alternative gets the slot. Stable, ties only:
 * nothing ever crosses a score boundary.
 */
function demoteWithinTies(
  scored: ScoredRecipe[],
  isDemoted: (r: Recipe) => boolean,
): ScoredRecipe[] {
  const out: ScoredRecipe[] = [];
  let i = 0;
  while (i < scored.length) {
    let j = i + 1;
    while (j < scored.length && scored[j].score === scored[i].score) j++;
    const group = scored.slice(i, j);
    out.push(...group.filter((s) => !isDemoted(s.recipe)), ...group.filter((s) => isDemoted(s.recipe)));
    i = j;
  }
  return out;
}

/**
 * Tie-break demotion of recipes the user has RECENTLY been recommended
 * (matched by name/shortName against the sessions' `basedOn` strings).
 */
function demoteRecentWithinTies(
  scored: ScoredRecipe[],
  recentNames: string[] | undefined,
): ScoredRecipe[] {
  if (!recentNames || recentNames.length === 0) return scored;
  const recent = Array.from(new Set(recentNames.map(normName).filter(Boolean)));
  if (recent.length === 0) return scored;
  // Exact-or-containment matching with a specificity floor, mirroring
  // recipeFidelity's resolveReference(). Exact-only matching silently
  // no-opped in production: the model writes short basedOn strings
  // ("Kasuya 4:6") while corpus names are long ("Kasuya 4:6 Method —
  // Standard"), so nothing ever matched and nothing was ever demoted.
  const nameMatches = (name: string, q: string) =>
    name === q ||
    ((name.includes(q) || q.includes(name)) && Math.min(name.length, q.length) >= 6);
  const isRecent = (r: Recipe) => {
    const names = [normName(r.name), normName(r.shortName)].filter(Boolean);
    return recent.some((q) => names.some((n) => nameMatches(n, q)));
  };
  return demoteWithinTies(scored, isRecent);
}

/**
 * Mix a seed before it is used modulo a small group size.
 *
 * The caller's seed is a millisecond timestamp, and `ms % len` is degenerate
 * for exactly the group sizes that occur here: 86,400,000 (one day) is
 * divisible by 2, 3, 4, 5, 6, 8, 9, 10 …, so brews a day apart landed on the
 * SAME offset and the rotation stood still. Measured before this fix: one
 * single menu across 20 consecutive brews. Hashing decorrelates the low bits
 * from the calendar, which is what the modulo actually needs.
 */
export function mixSeed(seed: number): number {
  let x = Math.abs(Math.trunc(seed)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

function rotateTies(scored: ScoredRecipe[], seed: number): ScoredRecipe[] {
  if (seed <= 0) return scored;
  seed = mixSeed(seed);
  const out: ScoredRecipe[] = [];
  let i = 0;
  while (i < scored.length) {
    let j = i + 1;
    while (j < scored.length && scored[j].score === scored[i].score) j++;
    const len = j - i;
    if (len > 1) {
      const off = ((seed % len) + len) % len;
      for (let k = 0; k < len; k++) out.push(scored[i + ((k + off) % len)]);
    } else {
      out.push(scored[i]);
    }
    i = j;
  }
  return out;
}

/**
 * A designed wait longer than this (seconds) marks a recipe as steep-/rest-heavy
 * — not suited to the Drip Assist disc, which drains almost as fast as it's
 * poured. Chosen from the corpus: a normal V60 bloom + pulse pour tops out at a
 * ~55–60s bloom rest / inter-pour gap, and the next tier up is 80s+ (the Kasuya
 * Mugen 105s draw, the Hedrick bypass 100s gap, Rao's Rule-of-Thirds 80s rest).
 * 75 sits cleanly in that gap, so it excludes the genuine long-steep designs
 * without touching ordinary pulse recipes. See tests/dataflow/drip-assist-drawdown.
 */
export const LONG_DESIGNED_WAIT_SEC = 75;

/**
 * The longest DESIGNED wait in a recipe's authored pour sequence: the max of
 * (a) any standalone `wait`-action step's duration, and (b) the gap between two
 * consecutive water-adding pours (the pouring step's own duration plus any
 * rests authored before the next pour). This reads the RECIPE's own numbers —
 * it does not depend on how the app later spaces the pours.
 */
export function longestDesignedWaitSec(recipe: Recipe): number {
  const seq = recipe.pourSequence ?? [];
  let maxWait = 0;
  let prevWater = -1;
  let sinceLastPour = 0;
  for (const s of seq) {
    if (s.action === "wait") maxWait = Math.max(maxWait, s.durationSec ?? 0);
    const w = s.waterGramsAtEnd;
    if (w != null && w > prevWater) {
      if (prevWater >= 0) maxWait = Math.max(maxWait, sinceLastPour);
      sinceLastPour = s.durationSec ?? 0;
      prevWater = w;
    } else {
      sinceLastPour += s.durationSec ?? 0;
    }
  }
  return maxWait;
}

/** True when a recipe's design builds in a long wait (steep / long rest) that
 * makes no sense with the Drip Assist disc. Used to exclude such recipes from
 * disc-locked selection — the recipe itself is never altered. */
export function hasLongDesignedWait(recipe: Recipe): boolean {
  return longestDesignedWaitSec(recipe) >= LONG_DESIGNED_WAIT_SEC;
}

/**
 * The immersion brewers, as a closed set. For these a long designed `wait` IS
 * the steep — the whole method — not a pour-over dead-gap, so the long-wait
 * exclusion must never touch them.
 *
 * Keyed on the brewer FAMILY (not the recipe's step shape): a step-shape probe
 * like hasImmersionShape() misfires here because V60 bypass/draw recipes
 * (kasuya-mugen-flat, hedrick-bypass-v60) trip it too — and it reads a
 * different field (BrewRecipe.pourSteps) than the corpus (Recipe.pourSequence).
 * Brewer family is the correct, robust key.
 */
export const IMMERSION_BREWERS: ReadonlySet<BrewerType> = new Set<BrewerType>([
  "clever",
  "aeropress",
  "aeropress-prismo",
]);

/** True when a recipe brews by full immersion (Clever / AeroPress), whose long
 * `wait` is the intended steep rather than a pour-over dead-gap. */
export function isImmersionRecipe(recipe: Recipe): boolean {
  return IMMERSION_BREWERS.has(recipe.brewer);
}

/**
 * Select the most relevant recipes for a brew. Returns up to `limit` recipes
 * sorted by score (descending). Diversity rule: never return more than one
 * recipe per brewer — we want the AI to see a varied portfolio, not five V60s.
 * Ties are rotated by `input.rotationSeed` so the injected menu varies between
 * brews instead of surfacing the same recipes every time.
 */
export function selectRecipes(
  input: RecipeSelectionInput,
  limit = 5
): ScoredRecipe[] {
  const locked = input.lockedBrewers && input.lockedBrewers.size > 0
    ? input.lockedBrewers
    : null;

  // Ordering passes, all tie-scoped (a higher score is NEVER demoted below a
  // lower one — best fit always decides): rotate ties by seed, then demote
  // recently-seen reference names, then demote recently-dominant brewers.
  // The brewer pass runs LAST so brewer freshness dominates the final order
  // within a tie group (it's the repetition the user actually perceives).
  const demoteBrewers = !locked && input.demoteBrewers?.size ? input.demoteBrewers : null;
  const ordered = demoteWithinTies(
    demoteRecentWithinTies(
      rotateTies(
        ALL_RECIPES
          // When a method is locked, hard-filter to recipes for that method only.
          .filter((r) => (locked ? locked.has(r.brewer) : true))
          .map((r) => scoreRecipe(r, input))
          .filter((s): s is ScoredRecipe => s !== null)
          .sort((a, b) => b.score - a.score),
        input.rotationSeed ?? 0,
      ),
      input.recentReferenceNames,
    ),
    (r) => (demoteBrewers ? demoteBrewers.has(r.brewer) : false),
  );

  // Drop POUR-OVER recipes whose design builds in a long dead-gap between pours
  // (Kasuya Mugen 105s draw, Hedrick bypass 100s gap, Rao Rule-of-Thirds 80s
  // rest) — the Drip Assist disc can't honour them, and on any hot brew the
  // owner has flagged such long waits as tasting bad. IMMERSION recipes are
  // exempt: a Clever/AeroPress steep is a long `wait` BY DESIGN (it is the whole
  // method, not a dead-gap), so lumping them in with pour-over long-waits wrongly
  // stripped every immersion recipe from the hot menu and left the model to reach
  // for a Clever out-of-menu instead. The recipe is never rewritten — just not
  // offered. Fall back to the full set if excluding would leave nothing.
  let scored = ordered;
  if (input.excludeLongWaits) {
    const kept = ordered.filter(
      (s) => isImmersionRecipe(s.recipe) || !hasLongDesignedWait(s.recipe),
    );
    if (kept.length) scored = kept;
  }

  // Locked method → return the best N recipes FOR THAT METHOD (no per-brewer
  // cap; the user chose the brewer, they want the strongest matches on it).
  if (locked) return scored.slice(0, limit);

  // No lock → diversity portfolio: only one recipe per brewer, so the AI sees
  // a varied set across the user's kit rather than five V60s.
  //
  // WHICH recipe represents a brewer is rotated per brew, and that is the fix
  // for the repetition the owner reported over and over. Rotating ties alone
  // could not touch it: reordering equal-scoring recipes changes their order,
  // but this loop then takes each brewer's BEST one — which is the same recipe
  // regardless of order, so the injected set never moved. Measured on the real
  // selector: 1 distinct menu across 20 consecutive brews, both for a
  // washed-SL28 morning and a natural-clarity brew.
  //
  // Fit still decides. A brewer is only ever represented by a recipe within
  // REP_SCORE_TOLERANCE of that brewer's own best score, so this picks between
  // genuinely interchangeable options for that vessel (Hedrick vs Wendelboe vs
  // Kasuya on the V60) and never promotes a poor match. Which brewers appear,
  // and in what order, is unchanged — that stays score + the freshness
  // tie-breaks above.
  const byBrewer = new Map<BrewerType, ScoredRecipe[]>();
  for (const s of scored) {
    const list = byBrewer.get(s.recipe.brewer);
    if (list) list.push(s);
    else byBrewer.set(s.recipe.brewer, [s]);
  }

  const seenBrewers = new Set<BrewerType>();
  const result: ScoredRecipe[] = [];
  for (const s of scored) {
    if (seenBrewers.has(s.recipe.brewer)) continue;
    seenBrewers.add(s.recipe.brewer);
    result.push(pickRepresentative(byBrewer.get(s.recipe.brewer) ?? [s], input.rotationSeed ?? 0));
    if (result.length >= limit) break;
  }
  // Substituting a representative can swap in a recipe scoring up to
  // REP_SCORE_TOLERANCE apart, which would leave the menu no longer in
  // best-fit order — and the prompt tells the model that the library order IS
  // meaningful. Re-sort so that promise stays true. The sort is stable, so the
  // freshness demotions already applied within each tie group survive it.
  return result.sort((a, b) => b.score - a.score);
}

/** How far below a brewer's best score a recipe may sit and still stand in for
 * it. One point: the scale is coarse integers, so this is "as good as", not
 * "nearly as good as". */
const REP_SCORE_TOLERANCE = 1;

/**
 * Choose which of a brewer's recipes represents it this brew. `candidates` is
 * already in the selector's final order, so index 0 is the best fit and the
 * freshness demotions have already been applied within tie groups.
 *
 * Rotation is offset by the brewer's own name as well as the seed, so two
 * brewers in the same menu don't move in lockstep — otherwise every vessel
 * would jump to "its second recipe" on the same brew.
 */
function pickRepresentative(candidates: ScoredRecipe[], seed: number): ScoredRecipe {
  if (candidates.length <= 1 || seed <= 0) return candidates[0];
  const best = candidates[0].score;
  const eligible = candidates.filter((c) => c.score >= best - REP_SCORE_TOLERANCE);
  if (eligible.length <= 1) return candidates[0];
  const brewerOffset = mixSeed(
    Array.from(candidates[0].recipe.brewer).reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7),
  );
  return eligible[(mixSeed(seed) + brewerOffset) % eligible.length];
}

/** Look up a recipe by id. */
export function getRecipeById(id: string): Recipe | undefined {
  return ALL_RECIPES.find((r) => r.id === id);
}

/** Look up recipes by attribution person (case-insensitive substring match). */
export function findRecipesByPerson(name: string): Recipe[] {
  const n = name.toLowerCase();
  return ALL_RECIPES.filter((r) =>
    r.attribution.person.toLowerCase().includes(n)
  );
}

// ── Prompt formatting ────────────────────────────────────────────────────

function formatPourSequence(recipe: Recipe): string {
  return recipe.pourSequence
    .map((step) => {
      const parts: string[] = [];
      parts.push(step.label);
      if (step.waterGramsAtEnd !== undefined) parts.push(`→ ${step.waterGramsAtEnd}g`);
      if (step.temperatureC !== undefined) parts.push(`@ ${step.temperatureC}°C`);
      if (step.durationSec !== undefined) parts.push(`${step.durationSec}s`);
      return parts.join(" ");
    })
    .join(" · ");
}

function formatTemperature(recipe: Recipe): string {
  const t = recipe.temperature;
  if (t.staged?.length) {
    return `staged ${t.staged.map((s) => `${s.celsius}°C`).join(" → ")}`;
  }
  if (t.celsius) return `${t.celsius}°C`;
  if (t.rangeC) return `${t.rangeC[0]}–${t.rangeC[1]}°C`;
  return "unspecified";
}

function formatGrind(recipe: Recipe): string {
  const g = recipe.grind;
  const parts: string[] = [];
  if (g.nicheZeroDegrees !== undefined) {
    parts.push(
      typeof g.nicheZeroDegrees === "number"
        ? `Niche ${g.nicheZeroDegrees}°`
        : `Niche ${g.nicheZeroDegrees[0]}–${g.nicheZeroDegrees[1]}°`
    );
  }
  if (g.referenceSetting) parts.push(`(${g.referenceSetting})`);
  return parts.join(" ") || "unspecified";
}

/**
 * Format a single recipe as a compact prompt block. Used inside a numbered
 * list of recipes injected into the system prompt for /recommend and /explore.
 */
export function formatRecipeForPrompt(recipe: Recipe): string {
  const verifiedTag = recipe.verified ? "" : " [pour sequence reconstructed]";
  const lines = [
    `▸ ${recipe.name} — ${recipe.attribution.person}${recipe.attribution.year ? ` (${recipe.attribution.year})` : ""}${verifiedTag}`,
    `  ${recipe.attribution.title ?? ""}${recipe.attribution.country ? `, ${recipe.attribution.country}` : ""}`,
    `  Brewer: ${recipe.brewer}${recipe.brewerNotes ? ` — ${recipe.brewerNotes}` : ""}`,
    `  Recipe: ${recipe.dose.grams}g : ${recipe.water.grams}g (${recipe.water.ratio}) | ${formatTemperature(recipe)} | ${formatGrind(recipe)} | total ${Math.floor(recipe.totalTimeSec / 60)}:${(recipe.totalTimeSec % 60).toString().padStart(2, "0")}`,
    `  Sequence: ${formatPourSequence(recipe)}`,
    `  Techniques: ${recipe.techniques.join(", ")}`,
    `  Teaches: ${recipe.teaches}`,
    `  Science: ${recipe.science}`,
    `  When to use: ${recipe.whenToUse}`,
  ];
  return lines.filter(Boolean).join("\n");
}

/**
 * Format a set of selected recipes as a system-prompt block. Designed to
 * be injected once per turn into /recommend and /explore. The brain reads
 * this and selects, adapts, or composes from it.
 */
export function formatRecipesForPrompt(
  selected: ScoredRecipe[],
  header = "RELEVANT REFERENCE RECIPES"
): string {
  if (!selected.length) return "";
  const intro = `${header} (${selected.length}) — selected for this coffee and equipment. Each entry is a documented expert recipe; cite by name when you draw from one, and explain the science behind your adaptation.`;
  const blocks = selected
    .map((s, i) => `${i + 1}. ${formatRecipeForPrompt(s.recipe)}`)
    .join("\n\n");
  return `${intro}\n\n${blocks}`;
}
