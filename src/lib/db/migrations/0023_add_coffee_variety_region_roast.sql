-- Migration 0023 — variety, region and roast level as first-class coffee columns.
--
-- THE GAP: `coffees` carried roaster/name/origin/process but NOT variety,
-- region or roast level. Those three lived ONLY inside a session's `coffee`
-- JSONB, so a coffee could not describe itself without a brew attached to it.
-- Consequences that were live in the app:
--   * /coffees "Brew this" hardcoded roastLevel: "Light" because the row had no
--     roast level to read (src/app/(light)/coffees/page.tsx).
--   * src/lib/claude/coffeeInsight.ts had to dig variety/roast/region out of the
--     latest session instead of reading the coffee.
--   * /recommend's getVarietyPriorsForBag() got `undefined` for any brew started
--     from the library, so variety priors never reached the recipe prompt.
--   * A coffee added WITHOUT a session (the new chat "add to library" path) had
--     nowhere to put SL28/SL34 or Nyeri at all.
--
-- BACKWARDS COMPATIBLE BY CONSTRUCTION: all three columns are nullable and every
-- consumer keeps its existing "read the latest session" path as the preferred
-- source, falling back to these columns only when there is no session carrying
-- the field. Nothing that works today starts reading differently.
--
-- BACKFILL SAFETY (the DB hard rule — never a broad overwrite):
--   * Each UPDATE is gated on `c.<col> IS NULL`, so a value already present is
--     never touched. Re-running the migration is a no-op.
--   * Rows are matched by the coffee's OWN primary key, reconstructed from the
--     session identity with the exact same slug function that generates it in
--     src/app/api/sessions/route.ts (lower + non-[a-z0-9] -> "_"). That is the
--     definition of the coffee<->session relationship, so it cannot bind the
--     wrong row.
--   * Per column we take the most recent session that ACTUALLY CARRIES that
--     field — not simply the newest session. A "Brew Again" save carries no scan
--     identity, so newest-session-wins would blank out a variety the original
--     scan established. Same reasoning as the tastingNotesFromBag lookup in
--     /api/coffees/[id].
--   * Every step RAISEs the row count it changed, so the workflow run log shows
--     exactly what moved.
--   * ZERO rows is a no-op, never an error — the CI screenshots job applies
--     every migration to an empty throwaway Postgres (this is what red-lined the
--     run on migration 0022).
--
-- Applied via the push-triggered runner (.github/migrate) or the manual
-- "Run SQL Migration" workflow. MUST run before the code that reads these
-- columns deploys — Drizzle is column-strict and would 500 every coffee read.

ALTER TABLE coffees ADD COLUMN IF NOT EXISTS variety     text;
ALTER TABLE coffees ADD COLUMN IF NOT EXISTS region      text;
ALTER TABLE coffees ADD COLUMN IF NOT EXISTS roast_level text;

DO $$
DECLARE
  n_total   int;
  n_variety int;
  n_region  int;
  n_roast   int;
BEGIN
  SELECT count(*) INTO n_total FROM coffees;
  RAISE NOTICE 'coffees rows before backfill: %', n_total;

  IF n_total = 0 THEN
    RAISE NOTICE 'No coffees — nothing to backfill (skipping)';
    RETURN;
  END IF;

  -- Variety
  UPDATE coffees c
  SET variety = sub.val
  FROM (
    SELECT DISTINCT ON (s.coffee_key) s.coffee_key, s.val
    FROM (
      SELECT
        regexp_replace(
          lower(concat(se.coffee->>'roaster', '__', se.coffee->>'name')),
          '[^a-z0-9]', '_', 'g'
        ) AS coffee_key,
        NULLIF(btrim(se.coffee->>'variety'), '') AS val,
        se.created_at_ms
      FROM sessions se
    ) s
    WHERE s.val IS NOT NULL
    ORDER BY s.coffee_key, s.created_at_ms DESC
  ) sub
  WHERE c.id = sub.coffee_key AND c.variety IS NULL;
  GET DIAGNOSTICS n_variety = ROW_COUNT;
  RAISE NOTICE 'variety backfilled on % row(s)', n_variety;

  -- Region
  UPDATE coffees c
  SET region = sub.val
  FROM (
    SELECT DISTINCT ON (s.coffee_key) s.coffee_key, s.val
    FROM (
      SELECT
        regexp_replace(
          lower(concat(se.coffee->>'roaster', '__', se.coffee->>'name')),
          '[^a-z0-9]', '_', 'g'
        ) AS coffee_key,
        NULLIF(btrim(se.coffee->>'region'), '') AS val,
        se.created_at_ms
      FROM sessions se
    ) s
    WHERE s.val IS NOT NULL
    ORDER BY s.coffee_key, s.created_at_ms DESC
  ) sub
  WHERE c.id = sub.coffee_key AND c.region IS NULL;
  GET DIAGNOSTICS n_region = ROW_COUNT;
  RAISE NOTICE 'region backfilled on % row(s)', n_region;

  -- Roast level
  UPDATE coffees c
  SET roast_level = sub.val
  FROM (
    SELECT DISTINCT ON (s.coffee_key) s.coffee_key, s.val
    FROM (
      SELECT
        regexp_replace(
          lower(concat(se.coffee->>'roaster', '__', se.coffee->>'name')),
          '[^a-z0-9]', '_', 'g'
        ) AS coffee_key,
        NULLIF(btrim(se.coffee->>'roastLevel'), '') AS val,
        se.created_at_ms
      FROM sessions se
    ) s
    WHERE s.val IS NOT NULL
    ORDER BY s.coffee_key, s.created_at_ms DESC
  ) sub
  WHERE c.id = sub.coffee_key AND c.roast_level IS NULL;
  GET DIAGNOSTICS n_roast = ROW_COUNT;
  RAISE NOTICE 'roast_level backfilled on % row(s)', n_roast;

  SELECT count(*) INTO n_total FROM coffees WHERE variety IS NOT NULL;
  RAISE NOTICE 'coffees with a variety after backfill: %', n_total;
END $$;
