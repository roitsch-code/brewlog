// Deterministic method-rotation constraint for /recommend.
//
// The owner-visible repetition ("always V60 and Clever, whatever the coffee")
// was never a reference-recipe problem — it's a METHOD funnel:
//   - the prompt pairs "different brewers, different extraction physics"
//     (percolation + immersion), and at a typical 250–350ml volume the
//     capacity rules forbid AeroPress (>230ml) and Moccamaster (<500ml), so
//     Clever is the ONLY immersion brewer left → it takes the second slot
//     every single brew;
//   - V60 takes the percolation slot as the most documented default.
// The prompt's three soft "vary your methods" notes don't move Mistral
// (same lesson as the Drip Assist leak: soft negatives need deterministic
// backstops). This module turns rotation into a HARD, computed constraint:
// count which brewer families appeared across the last recommendation sets,
// forbid the overused ones for this brew (both in the prompt AND by
// filtering their recipes out of the injected menu), and always leave the
// model enough eligible brewers for the requested volume.
//
// Safety rails:
//   - never applies when the user LOCKED a method (user override is absolute)
//   - never applies for cold brew (vessel-by-volume routing owns that world)
//   - never bans below a floor of eligible brewer families (3 normally,
//     2 when the volume leaves only a small pool)
//   - a family that's already capacity-forbidden at this volume never
//     consumes a ban slot (banning Moccamaster at 350ml is moot)

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
  orea: "Orea (Fast/Classic/Apex/Open)",
  origami: "Origami (cone or wave)",
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

/** Families physically eligible at the requested volume — mirrors the
 * HARD CAPACITY CONSTRAINT rules in recommend.ts. Unknown volume → all. */
function eligibleFamilies(
  targetWaterMl: number | undefined,
  iced: boolean,
): BrewerFamily[] {
  // Iced routes to the fixed hot-over-ice technique set (Japanese Iced
  // V60/Kalita, AeroPress Iced, Hoffmann Immersion Iced on the Clever); the
  // hot portion is well under the vessel caps, so no volume math here.
  if (iced) return ["v60", "kalita", "aeropress", "clever"];
  const all: BrewerFamily[] = [
    "v60", "orea", "origami", "kalita", "chemex", "clever", "aeropress", "moccamaster",
  ];
  if (!targetWaterMl) return all;
  return all.filter((f) => {
    if (f === "aeropress") return targetWaterMl <= 230;
    if (f === "clever") return targetWaterMl <= 450;
    if (f === "origami") return targetWaterMl <= 450; // 30g dose limit
    if (f === "moccamaster") return targetWaterMl >= 500;
    if (f === "v60") return targetWaterMl <= 600;
    return true;
  });
}

export interface MethodRotationInput {
  /** context.preferredMethod — a locked method disables rotation entirely. */
  lockedMethod?: string;
  /** context.occasion — cold-brew disables rotation; summer-time switches to the iced pool. */
  occasion?: string;
  /** Resolved target brew-water ml (same value the capacity constraint uses). */
  targetWaterMl?: number;
}

export interface MethodRotationResult {
  /** Hard-constraint block for the user message; empty string when inactive. */
  note: string;
  /** Brewer types whose recipes should be excluded from the injected menu. */
  excludeBrewers: Set<BrewerType>;
  /** Banned families (for the post-parse guard). */
  bannedFamilies: Set<BrewerFamily>;
}

const INACTIVE: MethodRotationResult = {
  note: "",
  excludeBrewers: new Set(),
  bannedFamilies: new Set(),
};

/** How many of the recent sessions a family must appear in (as a shown
 * candidate's method) before it counts as overused. */
const OVERUSE_THRESHOLD = 3;
/** How many recent sessions the window looks at. */
const WINDOW = 6;

/**
 * Compute the method-rotation constraint for this brew from the methods that
 * appeared in the user's recent recommendation sets. Pure and deterministic.
 */
export function buildMethodRotation(
  pastSessions: Session[],
  input: MethodRotationInput,
): MethodRotationResult {
  if (input.lockedMethod && input.lockedMethod.trim()) return INACTIVE;
  const occasion = input.occasion?.toLowerCase() ?? "";
  if (occasion === "cold-brew") return INACTIVE;

  const window = pastSessions.slice(0, WINDOW);
  if (window.length < OVERUSE_THRESHOLD) return INACTIVE;

  // Per-family: in how many of the recent sessions did it appear as a shown
  // candidate's method, and how recently (0 = the latest session)?
  const presence = new Map<BrewerFamily, { count: number; latest: number }>();
  window.forEach((s, idx) => {
    const methods =
      s.recommendation?.candidates?.map((c) => c.method) ??
      [s.recommendation?.primaryMethod, s.recommendation?.alternativeMethod];
    const fams = new Set<BrewerFamily>();
    for (const m of methods) {
      const fam = familyFromMethod(m ?? undefined);
      if (fam) fams.add(fam);
    }
    for (const fam of Array.from(fams)) {
      const cur = presence.get(fam);
      if (cur) cur.count += 1;
      else presence.set(fam, { count: 1, latest: idx });
    }
  });

  const iced = occasion === "summer-time";
  const pool = eligibleFamilies(input.targetWaterMl, iced);
  const poolSet = new Set(pool);

  // Overused families that are actually eligible at this volume (banning an
  // already-forbidden brewer wastes a slot), most-frequent first, then most
  // recently seen, then name for determinism.
  const overused = Array.from(presence.entries())
    .filter(([fam, p]) => p.count >= OVERUSE_THRESHOLD && poolSet.has(fam))
    .sort((a, b) => b[1].count - a[1].count || a[1].latest - b[1].latest || a[0].localeCompare(b[0]));

  if (overused.length === 0) return INACTIVE;

  const floor = pool.length >= 5 ? 3 : 2;
  const banned: [BrewerFamily, { count: number; latest: number }][] = [];
  for (const entry of overused) {
    if (pool.length - banned.length - 1 < floor) break;
    banned.push(entry);
  }
  if (banned.length === 0) return INACTIVE;

  const bannedFamilies = new Set<BrewerFamily>(banned.map(([f]) => f));
  const excludeBrewers = new Set<BrewerType>();
  for (const fam of Array.from(bannedFamilies)) {
    for (const b of FAMILY_BREWERS[fam]) excludeBrewers.add(b);
  }

  const bannedStr = banned
    .map(([fam, p]) => `${FAMILY_LABEL[fam]} (in ${p.count} of your last ${window.length} recommendation sets)`)
    .join(", ");
  const allowedStr = pool
    .filter((f) => !bannedFamilies.has(f))
    .map((f) => FAMILY_LABEL[f])
    .join(", ");

  const note =
    `\nMETHOD ROTATION — HARD CONSTRAINT: the following brewers are FORBIDDEN for BOTH candidates this brew because they have dominated recent recommendations: ${bannedStr}. ` +
    `Choose each candidate's method from: ${allowedStr}. The reference recipe library above already reflects this — adapt from it. ` +
    `If this leaves no immersion brewer available, two contrasting PERCOLATION candidates testing genuinely different extraction physics (e.g. fast-flow high-agitation vs slow flat-bed minimal-agitation) are the correct portfolio — do NOT reach for a forbidden brewer to force a percolation+immersion pairing.`;

  return { note, excludeBrewers, bannedFamilies };
}

/**
 * Deterministic post-parse guard: drop any candidate whose method resolves to
 * a banned family — unless that would empty the list (never break /recommend).
 * Mirrors guardVesselCapacity's shape.
 */
export function stripRotationViolations<C extends { method: string; title?: string }>(
  candidates: C[],
  bannedFamilies: Set<BrewerFamily>,
): C[] {
  if (bannedFamilies.size === 0) return candidates;
  const safe = candidates.filter((c) => {
    const fam = familyFromMethod(c.method);
    if (fam && bannedFamilies.has(fam)) {
      console.warn(
        `[recommend] method-rotation guard: dropped "${c.title ?? c.method}" — ${c.method} is rotation-banned this brew`,
      );
      return false;
    }
    return true;
  });
  return safe.length ? safe : candidates;
}
