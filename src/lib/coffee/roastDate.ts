/**
 * Defensive year adjustment for ambiguous month+day-only roast dates.
 *
 * Bags routinely print "18.05" with no year. Readers (the vision scanner, and
 * now the chat) resolve that to a full date and used to land on LAST year —
 * a Friedhats bag roasted two weeks ago was logged as 14 months old, which
 * then cascaded through the welcome haiku and /recommend's freshness logic
 * (PR #216).
 *
 * The rule: if the parsed date is >11 months in the past AND shifting it
 * forward by one year lands inside the fresh-bag window (i.e. not in the
 * future), take the bump. Otherwise return the original untouched — a
 * genuinely old bag stays old.
 *
 * Extracted from src/lib/claude/analyzeBag.ts so the coffee-create route can
 * apply the same guard without importing the Anthropic SDK.
 */
export function guardRoastYear(iso: string): string {
  const parsed = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (isNaN(parsed.getTime())) return iso;
  const now = new Date();
  const elevenMonthsMs = 11 * 30 * 24 * 60 * 60 * 1000;
  const ageMs = now.getTime() - parsed.getTime();
  if (ageMs < elevenMonthsMs) return iso;

  const bumped = new Date(parsed);
  bumped.setUTCFullYear(bumped.getUTCFullYear() + 1);
  // Bumped must not be in the future and must be more reasonable.
  if (bumped.getTime() > now.getTime()) return iso;
  const newAgeMs = now.getTime() - bumped.getTime();
  if (newAgeMs >= elevenMonthsMs) return iso;
  return bumped.toISOString().slice(0, 10);
}
