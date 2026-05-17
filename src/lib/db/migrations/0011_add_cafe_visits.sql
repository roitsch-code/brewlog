-- 0011 — Cafe visits without a brew session
--
-- The "I've been here" mode: log a visit to a coffee shop without logging
-- a brew session. Use case is the place was visited (the user remembers
-- being there) but no specific cup was tracked. Rating is intentionally
-- binary — would-come-back vs won't-return — because the brew context
-- the star rating depends on isn't there.
--
-- Reuses cafe_name + location strings from session.place so the same
-- name reads consistently in the Cafe Library aggregator (no foreign
-- key into the bulk places table — that table is read-only reference
-- data, visits are user-owned).
--
-- Run this file with:
--   cat src/lib/db/migrations/0011_add_cafe_visits.sql | docker compose exec -T postgres psql -U brewlog -d brewlog

CREATE TABLE IF NOT EXISTS cafe_visits (
  id              text PRIMARY KEY,
  cafe_name       text NOT NULL,
  location        text,
  rating          text NOT NULL CHECK (rating IN ('come-back', 'wont-return')),
  notes           text,
  visited_at      timestamptz NOT NULL DEFAULT now(),
  visited_at_ms   bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS cafe_visits_visited_at_ms_idx
  ON cafe_visits (visited_at_ms DESC);

CREATE INDEX IF NOT EXISTS cafe_visits_cafe_name_idx
  ON cafe_visits (cafe_name);
