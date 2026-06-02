-- One-shot data fix for the Friedhats Colombia Gesha record whose
-- roast date was extracted as 2025-MM-DD instead of 2026-MM-DD by the
-- bag scanner (defaulted to last year on an ambiguous month/day stamp).
--
-- This script runs in three parts. Inspect each SELECT before running
-- the UPDATE that follows it.
--
-- Run with:
--   cat scripts/fix-friedhats-gesha-date.sql \
--     | docker compose exec -T postgres psql -U brewlog -d brewlog

-- ──────────────────────────────────────────────────────────────────
-- 1. INSPECT: find the affected row in coffees
-- ──────────────────────────────────────────────────────────────────
SELECT id, roaster, name, latest_roast_date, in_rotation
  FROM coffees
 WHERE roaster ILIKE '%Friedhats%'
   AND (name ILIKE '%Gesha%' OR name ILIKE '%Geisha%')
   AND latest_roast_date LIKE '2025-%';

-- ──────────────────────────────────────────────────────────────────
-- 2. UPDATE: bump the year on coffees.latest_roast_date.
-- Comment this out if the SELECT above didn't return what you expected.
-- ──────────────────────────────────────────────────────────────────
UPDATE coffees
   SET latest_roast_date = '2026' || substring(latest_roast_date FROM 5)
 WHERE roaster ILIKE '%Friedhats%'
   AND (name ILIKE '%Gesha%' OR name ILIKE '%Geisha%')
   AND latest_roast_date LIKE '2025-%';

-- ──────────────────────────────────────────────────────────────────
-- 3. UPDATE: fix the same date inside each session's coffee JSONB.
-- The recommend / greeting / extractor read from sessions.coffee, not
-- coffees.latest_roast_date, so this update is just as important.
-- ──────────────────────────────────────────────────────────────────
UPDATE sessions
   SET coffee = jsonb_set(
         coffee,
         '{roastDate}',
         to_jsonb('2026' || substring(coffee->>'roastDate' FROM 5))
       )
 WHERE coffee->>'roaster' ILIKE '%Friedhats%'
   AND (coffee->>'name' ILIKE '%Gesha%' OR coffee->>'name' ILIKE '%Geisha%')
   AND coffee->>'roastDate' LIKE '2025-%';

-- ──────────────────────────────────────────────────────────────────
-- 4. VERIFY
-- ──────────────────────────────────────────────────────────────────
SELECT id, roaster, name, latest_roast_date
  FROM coffees
 WHERE roaster ILIKE '%Friedhats%'
   AND (name ILIKE '%Gesha%' OR name ILIKE '%Geisha%');

SELECT id, coffee->>'roaster', coffee->>'name', coffee->>'roastDate'
  FROM sessions
 WHERE coffee->>'roaster' ILIKE '%Friedhats%'
   AND (coffee->>'name' ILIKE '%Gesha%' OR coffee->>'name' ILIKE '%Geisha%');
