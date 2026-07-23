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
-- SAFETY: targets exactly one coffee row and RAISEs (aborting the whole
-- statement under ON_ERROR_STOP) unless the roaster+name match is unique, so it
-- can never touch the wrong bag. Idempotent — re-running sets the same values.
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

  IF n <> 1 THEN
    RAISE EXCEPTION 'Expected exactly 1 La Cabra Terra coffee row, found % — aborting so no wrong row is touched', n;
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
