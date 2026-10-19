/**
 * The "Special" time bucket — the flow's fast shot (`timeAvailable: "special"`,
 * legacy `"quick"`). Since 2026-10-19 this is INFORMATION for the model ("he
 * has about three minutes; say so if a recipe needs more"), never a filter on
 * the menu and never a reason to drop a candidate.
 */

/** The fast-shot ceiling the prompt names: 150 s target plus 20 % tolerance. */
export const SPECIAL_MAX_SEC = 180;

export function isSpecialTime(timeAvailable?: string): boolean {
  const t = (timeAvailable ?? "").toLowerCase();
  return t === "special" || t === "quick";
}

/** The one line /recommend appends on a Special brew. */
export function specialTimeNote(timeAvailable?: string): string {
  if (!isSpecialTime(timeAvailable)) return "";
  return `\nTIME: he picked the fast shot — about ${Math.round(SPECIAL_MAX_SEC / 60)} minutes in total is what he has. Build for that; if the recipe that fits best genuinely needs longer, say so in whyChosen rather than silently stretching or squeezing it.`;
}
