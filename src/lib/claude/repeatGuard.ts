/**
 * Candidate-level repetition guard for /recommend (Oct 2026).
 *
 * WHY THIS EXISTS: measured on production (recommend-logs.yml, 2026-10-03), a
 * Clever Dripper sat in 10 of the last 17 unlocked recommendations — and only
 * 5 of those 10 came from the turn's rotated menu. The other 5 were "Own
 * experiment" candidates the model titled "Water-First Clever Immersion": a
 * published Hoffmann recipe rewritten from memory under the own-work label.
 * Every rotation lever in this repo (pickRepresentative, demoteBrewers,
 * recentReferenceNames) acts on the MENU, so a candidate from outside the menu
 * escaped all of them, and the freshness note in the prompt was ignored.
 *
 * The rule (owner decision 2026-10-03, "Ja, hart"): a FREE-FORM candidate — an
 * Own experiment / Own recipe / a basedOn that names nothing this turn offered —
 * on a brewer family already offered in at least REPEAT_THRESHOLD of the last
 * REPEAT_WINDOW recommendations is sent back for ONE repair round. Menu recipes
 * and the user's own references are never touched: when the scored library
 * puts a Clever in front of this coffee, best fit still decides. Pure; the
 * repair call itself lives in recommend.ts.
 */
import type { Session } from "../types/session";
import { familyFromMethod, type BrewerFamily } from "./methodRotation";
import { isMenuRecipe } from "./menuBinding";

export const REPEAT_WINDOW = 4;
export const REPEAT_THRESHOLD = 2;

/** How many of the last REPEAT_WINDOW recommendation sets offered each brewer
 * family (each session counts a family once). `pastSessions` is newest first. */
export function recentlyOfferedFamilies(
  pastSessions: Session[],
  window: number = REPEAT_WINDOW,
): Map<BrewerFamily, number> {
  const out = new Map<BrewerFamily, number>();
  const withRecs = pastSessions.filter((s) => s.recommendation).slice(0, window);
  for (const s of withRecs) {
    const methods =
      s.recommendation?.candidates?.map((c) => c.method) ??
      [s.recommendation?.primaryMethod, s.recommendation?.alternativeMethod];
    const fams = new Set<BrewerFamily>();
    for (const m of methods) {
      const fam = familyFromMethod(m ?? undefined);
      if (fam) fams.add(fam);
    }
    fams.forEach((f) => out.set(f, (out.get(f) ?? 0) + 1));
  }
  return out;
}

export interface RepeatOffender {
  index: number;
  title: string;
  method: string;
  basedOn: string;
  family: BrewerFamily;
  timesOffered: number;
}

/** Candidates that are free-form AND on a crowded brewer family. */
export function findRepeatOffenders(
  candidates: { method: string; basedOn?: string; title?: string }[],
  menuNames: string[],
  offered: Map<BrewerFamily, number>,
  threshold: number = REPEAT_THRESHOLD,
): RepeatOffender[] {
  const out: RepeatOffender[] = [];
  candidates.forEach((c, index) => {
    if (isMenuRecipe(c.basedOn, menuNames)) return;
    const family = familyFromMethod(c.method);
    if (!family) return;
    const timesOffered = offered.get(family) ?? 0;
    if (timesOffered < threshold) return;
    out.push({
      index,
      title: c.title ?? c.method,
      method: c.method,
      basedOn: c.basedOn ?? "",
      family,
      timesOffered,
    });
  });
  return out;
}

/** The correction appended to the user message for the one repair round. */
export function formatRepeatRepair(
  offenders: RepeatOffender[],
  offered: Map<BrewerFamily, number>,
  window: number = REPEAT_WINDOW,
): string {
  const crowded = Array.from(offered.entries())
    .filter(([, n]) => n >= REPEAT_THRESHOLD)
    .map(([f]) => f);
  const lines = offenders.map(
    (o) =>
      `- Candidate ${o.index + 1} "${o.title}" (${o.method}, basedOn "${o.basedOn || "none"}") — ${o.method} was already offered in ${o.timesOffered} of the user's last ${window} recommendations, and this candidate is not a recipe from this turn's REFERENCE RECIPE LIBRARY.`,
  );
  return `

REPAIR — REPETITION. Your previous answer repeated a brewer the user keeps being offered, from outside the library you were given:
${lines.join("\n")}
Replace ONLY the candidate(s) above; keep any other candidate exactly as it was. The replacement must explore something the user has not been handed lately: either a recipe from this turn's REFERENCE RECIPE LIBRARY, or an Own experiment on a brewer family OTHER than ${crowded.join(", ")} that moves one named technique id from AVAILABLE TECHNIQUES. A library recipe on a recently-offered brewer is fine if the library actually holds one; a free-form one is not. Return the complete JSON again.`;
}
