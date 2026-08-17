// Deterministic grinder-UNIT backstop for /recommend.
//
// The two grinders speak different languages: the Niche Zero is continuous
// degrees, the Comandante C40 is discrete clicks. Which one is in play is not a
// matter of taste — the user picks it in the flow (`context.grinder`), and
// recommend.ts already injects an explicit "NEVER Niche°" / "NEVER clicks"
// instruction for the chosen one.
//
// It still comes back in the wrong unit sometimes ("manchmal zeigt er Grad,
// obwohl ich sage Comandante"). That is the same failure mode this repo has
// already met twice — a hard instruction stated in prose and enforced nowhere
// (stripProactiveDripAssist for the banned brewer, the disc grind offset). A
// wrong unit is worse than a wrong number, because "406" on a Comandante isn't
// merely off, it is unreadable: the grinder's dial doesn't go there.
//
// So this converts rather than complains. The map is the owner's own measured
// one from docs/grind-settings.md / grindSettings.ts — two anchor points he
// established on his own kit (380° = 23 clicks, 400° = 29 clicks) — not an
// invented slope.

/** Anchor A of the owner's measured map: standard 15 g single cup. */
const ANCHOR_NICHE = 380;
const ANCHOR_CLICKS = 23;
/** ~3.3° per click, from the 380°=23 / 400°=29 anchor pair. */
const DEG_PER_CLICK = 10 / 3;

/** True when the selected grinder is the Comandante (clicks), not the Niche. */
export function isComandante(grinder?: string): boolean {
  return !!grinder && /comandante|c40/i.test(grinder);
}

export function nicheToClicks(deg: number): number {
  return Math.round(ANCHOR_CLICKS + (deg - ANCHOR_NICHE) / DEG_PER_CLICK);
}

export function clicksToNiche(clicks: number): number {
  return Math.round(ANCHOR_NICHE + (clicks - ANCHOR_CLICKS) * DEG_PER_CLICK);
}

// The two scales cannot be confused by magnitude: Niche degrees live in the
// mid-300s to mid-400s, Comandante clicks in the teens to forties. A number
// this far outside the selected grinder's own scale is the other unit, whatever
// (or whether) the string says it is.
const LOOKS_LIKE_DEGREES = 200;
const LOOKS_LIKE_CLICKS = 80;

/**
 * Return `grindSize` expressed in the unit the SELECTED grinder actually uses.
 * Leaves a value that is already in the right unit completely alone (including
 * its wording), and leaves anything it cannot parse alone rather than guessing.
 */
export function normalizeGrindToGrinder(
  grindSize: string | undefined,
  grinder: string | undefined,
): string | undefined {
  if (!grindSize) return grindSize;
  const m = /(\d{1,3}(?:\.\d+)?)/.exec(grindSize);
  if (!m) return grindSize;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return grindSize;

  if (isComandante(grinder)) {
    // Degrees handed to a clicks grinder.
    if (n >= LOOKS_LIKE_DEGREES) return `${nicheToClicks(n)} clicks`;
    return grindSize;
  }
  // Clicks handed to a degrees grinder.
  if (n <= LOOKS_LIKE_CLICKS) return `${clicksToNiche(n)}°`;
  return grindSize;
}
