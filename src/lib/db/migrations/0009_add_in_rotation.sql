-- Rotation marker on coffees — Markus' /home greeting feedback:
-- "Ich sollte auch irgendwie anmerken welche Kaffees ich in der
-- Rotation habe." User-controlled flag, default false. The /api/
-- greeting prompt enriches its library snapshot with this signal so
-- the daily Haiku starter can prioritise rotation bags over the rest
-- of the library. UI lives on /coffees/[id] (the Coffee Detail page).
--
-- Run on the VPS after deploy:
--   cat src/lib/db/migrations/0009_add_in_rotation.sql \
--     | docker compose exec -T postgres psql -U brewlog -d brewlog

ALTER TABLE coffees
  ADD COLUMN IF NOT EXISTS in_rotation boolean NOT NULL DEFAULT false;
