import type {
  Recipe,
  BrewerType,
  RoastLevel,
  Process,
  Goal,
} from "./types";
import { vesselTooSmallForTarget } from "../../utils/vesselCapacity";
import { CHAMPIONSHIP_RECIPES } from "./championship";
import { REFERENCE_RECIPES } from "./reference";
import { EXPANDED_RECIPES } from "./expanded";
import { MARKUS_ADDITIONS } from "./markusAdditions";

export const ALL_RECIPES: Recipe[] = [
  ...CHAMPIONSHIP_RECIPES,
  ...REFERENCE_RECIPES,
  ...EXPANDED_RECIPES,
  ...MARKUS_ADDITIONS,
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
  if (input.serveVolumeMl && vesselTooSmallForTarget(recipe.brewer, input.serveVolumeMl)) {
    return null;
  }

  let score = 0;
  const reasons: string[] = [];

  if (input.roastLevel && recipe.bestFor.roastLevels?.includes(input.roastLevel)) {
    score += 2;
    reasons.push(`roast match (${input.roastLevel})`);
  }

  if (input.process && recipe.bestFor.processes?.includes(input.process)) {
    score += 2;
    reasons.push(`process match (${input.process})`);
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
  // occasion). All 133 recipes — championship, reference, and the Markus
  // additions — compete on equal footing, best-match wins.

  return { recipe, score, reasons };
}

/**
 * Select the most relevant recipes for a brew. Returns up to `limit` recipes
 * sorted by score (descending). Diversity rule: never return more than one
 * recipe per brewer — we want the AI to see a varied portfolio, not five V60s.
 */
export function selectRecipes(
  input: RecipeSelectionInput,
  limit = 5
): ScoredRecipe[] {
  const locked = input.lockedBrewers && input.lockedBrewers.size > 0
    ? input.lockedBrewers
    : null;

  const scored = ALL_RECIPES
    // When a method is locked, hard-filter to recipes for that method only.
    .filter((r) => (locked ? locked.has(r.brewer) : true))
    .map((r) => scoreRecipe(r, input))
    .filter((s): s is ScoredRecipe => s !== null)
    .sort((a, b) => b.score - a.score);

  // Locked method → return the best N recipes FOR THAT METHOD (no per-brewer
  // cap; the user chose the brewer, they want the strongest matches on it).
  if (locked) return scored.slice(0, limit);

  // No lock → diversity portfolio: only one recipe per brewer, so the AI sees
  // a varied set across the user's kit rather than five V60s.
  const seenBrewers = new Set<BrewerType>();
  const result: ScoredRecipe[] = [];
  for (const s of scored) {
    if (seenBrewers.has(s.recipe.brewer)) continue;
    seenBrewers.add(s.recipe.brewer);
    result.push(s);
    if (result.length >= limit) break;
  }
  return result;
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
