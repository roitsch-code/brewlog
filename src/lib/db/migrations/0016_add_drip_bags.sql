-- 0016 — Drip bag documentation records
--
-- Single-serve drip bags (e.g. the INNO "Signature Drip Coffee" sachet)
-- are brewed exactly one fixed way (200 ml hot water through the built-in
-- filter), so there's no recipe to generate and no gear to log. This table
-- is pure documentation: the scanned identity, the flavour notes printed on
-- the package (bag_notes), the flavours the user tasted (flavor_notes), and
-- a 1–5 star rating.
--
-- Intentionally isolated from sessions / coffees / the AI corpus — mirrors
-- the cafe_visits precedent (migration 0011) — so drip bags never skew
-- /recommend, /api/insights, /taste, or the Café Library. Surfaced only in
-- the Coffee Library list (flagged) and their own detail page.
--
-- Run this file with:
--   cat src/lib/db/migrations/0016_add_drip_bags.sql | docker compose exec -T postgres psql -U brewlog -d brewlog

CREATE TABLE IF NOT EXISTS drip_bags (
  id              text PRIMARY KEY,
  roaster         text NOT NULL,
  name            text NOT NULL,
  origin          text,
  region          text,
  variety         text,
  process         text,
  roast_level     text,
  bag_notes       jsonb NOT NULL DEFAULT '[]'::jsonb,
  flavor_notes    jsonb NOT NULL DEFAULT '[]'::jsonb,
  rating          numeric,
  free_notes      text,
  bag_photo_url   text,
  bag_photo_path  text,
  field_zones     jsonb,
  ai_extracted    boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_at_ms   bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS drip_bags_created_at_ms_idx
  ON drip_bags (created_at_ms DESC);
