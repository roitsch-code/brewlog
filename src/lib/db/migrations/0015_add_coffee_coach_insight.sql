-- 0015 — Per-coffee coach insight
--
-- Adds a jsonb column on `coffees` to hold an Opus-generated insight
-- specifically about THIS coffee. Replaces the library-wide
-- citation-field overlap matching that was showing wrong insights on
-- the wrong coffees (Friedhats Gesha was getting a "honey vs natural
-- light roasts" card that was about other bags entirely).
--
-- Shape of the column:
--   {
--     "observation": string,
--     "suggestion": string,
--     "status": "new" | "trying" | "confirmed" | "doesnt-apply",
--     "generatedAtSessionMs": number,
--     "generatedAt": "ISO string"
--   }
--
-- The orchestrator regenerates when generatedAtSessionMs is older than
-- this coffee's latest session, EXCEPT when status is "confirmed" or
-- "trying" (user is mid-act-on-it; don't change the card under them).
--
-- Run with:
--   cat src/lib/db/migrations/0015_add_coffee_coach_insight.sql \
--     | docker compose exec -T postgres psql -U brewlog -d brewlog

ALTER TABLE coffees
  ADD COLUMN IF NOT EXISTS coach_insight jsonb;
