-- One-time data fix (2026-07-17) — clear per-coffee coach cards for
-- IN-ROTATION coffees so they regenerate fresh from the corrected code.
--
-- Why: PRs #495/#496 fixed the primary-vs-selected bug where the post-brew
-- insight reasoned over the PRIMARY recipe instead of the candidate the user
-- actually brewed (e.g. citing "ninety-six degrees" when 85°C was brewed).
-- A user who tapped "Save to try" / "Confirmed" on such a post-brew insight
-- persisted that wrong-recipe sentence into the coffee's coach_insight column
-- (POST /api/insights). Those cards are status 'trying'/'confirmed', which the
-- GET regeneration DELIBERATELY preserves and never overwrites — so the wrong
-- text would sit there indefinitely.
--
-- Setting coach_insight = NULL forces a clean regeneration on the next
-- /coffees/[id] visit via generateCoffeeInsight (which already reads the
-- brewed candidate correctly). Scoped to in_rotation = true — out-of-rotation
-- coffees render no card and are intentionally left untouched.
--
-- Hard Rule: verify the affected row count BEFORE the UPDATE. The SELECT below
-- prints it in the workflow run log.

SELECT count(*) AS rotation_cards_to_clear
FROM coffees
WHERE in_rotation = true
  AND coach_insight IS NOT NULL;

UPDATE coffees
SET coach_insight = NULL
WHERE in_rotation = true
  AND coach_insight IS NOT NULL;
