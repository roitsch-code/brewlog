-- Migration 0022 — one-off data fix: mark La Cabra "Terra" as the blend it is.
--
-- Migration 0021 added the `components` column but deliberately did NOT backfill
-- (splitting an old single-origin string into a blend would mean guessing the
-- composition). Terra is the one existing blend in the library, so set its
-- components explicitly.
--
-- Composition per La Cabra's own Terra listing (lacabra.com/products/terra):
-- a Brazil natural + an Ethiopia natural (Yirgacheffe, Chelbesa / SNAP Coffee).
-- No ratio is published, so none is stored (ratio is optional). If the actual
-- bag's batch differs, correct via a follow-up — nothing here is fabricated
-- beyond what the roaster lists.
--
-- SAFETY: aborts (under ON_ERROR_STOP) only when the roaster+name match is
-- AMBIGUOUS (>1 row), so it can never touch the wrong bag. A ZERO-row match is a
-- no-op, not an error — there's nothing to touch, and the migration must stay
-- safe to apply against ANY database state, including the empty throwaway
-- Postgres the CI screenshots job spins up (which applies every migration to a
-- fresh DB with no seed data — the hard "exactly 1" guard used to abort that run
-- and red the whole job). Idempotent — re-running sets the same values.
--
-- Applied via the push-triggered runner (.github/migrate) or the manual
-- "Run SQL Migration" workflow.

DO $$
DECLARE
  target_id text;
  n int;
BEGIN
  SELECT count(*) INTO n
  FROM coffees
  WHERE roaster ILIKE '%la cabra%' AND name ILIKE '%terra%';

  IF n = 0 THEN
    RAISE NOTICE 'No La Cabra Terra coffee row found — nothing to update (skipping)';
    RETURN;
  END IF;

  IF n > 1 THEN
    RAISE EXCEPTION 'Expected at most 1 La Cabra Terra coffee row, found % — aborting so no wrong row is touched', n;
  END IF;

  SELECT id INTO target_id
  FROM coffees
  WHERE roaster ILIKE '%la cabra%' AND name ILIKE '%terra%';

  UPDATE coffees
  SET components = '[
        {"origin": "Brazil", "process": "Natural"},
        {"origin": "Ethiopia", "region": "Yirgacheffe, Chelbesa", "process": "Natural"}
      ]'::jsonb,
      origin  = 'Brazil, Ethiopia',
      process = 'Natural'
  WHERE id = target_id;

  RAISE NOTICE 'Set Terra blend components on coffee %', target_id;
END $$;
