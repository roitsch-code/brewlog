-- 0010 — Rename "Rösterei Vier" / "The Commonage" → "RVTC"
--
-- The Frankfurt roastery rebranded from "Rösterei Vier / The Commonage"
-- (sometimes written as "RVTC – Rösterei Vier / The Commonage") to just
-- "RVTC". Update every existing coffees row + every session.coffee JSONB
-- payload so the library reads the new name everywhere. The roasters
-- priors table is rebuilt by the app on demand (canonicalRoasterSlug("RVTC")
-- → "rvtc"), so dropping the old rows is enough.
--
-- BEFORE running this, take counts so the result is auditable:
--
--   SELECT count(*) FROM coffees
--    WHERE roaster ILIKE '%Rösterei Vier%'
--       OR roaster ILIKE '%The Commonage%'
--       OR roaster ILIKE '%RVTC%';
--
--   SELECT count(*) FROM sessions
--    WHERE coffee->>'roaster' ILIKE '%Rösterei Vier%'
--       OR coffee->>'roaster' ILIKE '%The Commonage%'
--       OR coffee->>'roaster' ILIKE '%RVTC%';
--
-- Run this file with:
--   cat src/lib/db/migrations/0010_rename_rvtc.sql | docker compose exec -T postgres psql -U brewlog -d brewlog

BEGIN;

-- 1. coffees table — direct column update
UPDATE coffees
SET roaster = 'RVTC'
WHERE roaster ILIKE '%Rösterei Vier%'
   OR roaster ILIKE '%The Commonage%'
   OR roaster ILIKE '%RVTC%';

-- 2. sessions table — coffee.roaster lives inside a JSONB column
UPDATE sessions
SET coffee = jsonb_set(coffee, '{roaster}', '"RVTC"', false)
WHERE coffee->>'roaster' ILIKE '%Rösterei Vier%'
   OR coffee->>'roaster' ILIKE '%The Commonage%'
   OR coffee->>'roaster' ILIKE '%RVTC%';

-- 3. roasters priors table — delete any cached entries for the old
--    names; the app will lazily regenerate an "rvtc" slug entry on
--    the next /api/roasters lookup.
DELETE FROM roasters
WHERE name ILIKE '%Rösterei Vier%'
   OR name ILIKE '%The Commonage%'
   OR slug ILIKE 'rosterei-vier%'
   OR slug ILIKE 'the-commonage%';

COMMIT;

-- Audit after:
--   SELECT roaster, count(*) FROM coffees WHERE roaster = 'RVTC' GROUP BY roaster;
--   SELECT count(*) FROM sessions WHERE coffee->>'roaster' = 'RVTC';
