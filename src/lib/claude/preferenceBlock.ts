/**
 * The owner's preferences for /recommend — ONE paragraph of information.
 *
 * Until 2026-10-19 /recommend never saw CANONICAL_PROFILE at all (only the
 * chat did) and instead carried his taste as rules scattered through the
 * system prompt ("dark = avoid entirely", "This user avoids anaerobic coffees
 * — flag explicitly", "the only user-stated bias allowed"). Owner: taste is a
 * preference the model weighs and explains, never a filter. So the rules are
 * gone from the prompt and this block states the preference once, with the
 * standing instruction that going against it is allowed — with a reason.
 */
import type { UserPreferences } from "../types/preferences";

export function formatPreferencesForRecommend(prefs: UserPreferences | null | undefined): string {
  const tp = prefs?.tasteProfile;
  const extra: string[] = [];
  if (tp?.preferredBodyLevel) extra.push(`body ${tp.preferredBodyLevel}`);
  if (tp?.preferredAcidityLevel) extra.push(`acidity ${tp.preferredAcidityLevel}`);
  if (tp?.likedProcesses?.length) extra.push(`likes ${tp.likedProcesses.join(", ")}`);
  if (tp?.avoidProcesses?.length) extra.push(`has not enjoyed ${tp.avoidProcesses.join(", ")} so far`);
  const saved = extra.length ? ` His saved profile adds: ${extra.join("; ")}.` : "";
  return (
    `\nHIS PREFERENCES — information you weigh, never a rule you enforce. He likes silky, balanced, floral and fruity light roasts, elegant rather than wild; washed Ethiopia and Kenya, natural Brazil, honey Costa Rica are favourites. He has not enjoyed extreme fermentation, infused coffees, heavy or dark roasts or anaerobic fruit bombs so far — but the bag on the counter is the bag he chose, so brew it as well as it can be brewed. When a candidate leans into something he has not enjoyed, say in one clause of whyChosen why it is worth it today.${saved}`
  );
}
