-- Migration 0019 — durable bag-flavors field on the coffee row.
--
-- Until now the flavors printed ON THE BAG lived only inside the scan
-- session's `coffee` JSONB (tastingNotesFromBag). That scan session is created
-- before the coffee row exists, so it carries no coffeeId and the flavors were
-- effectively buried per-session — invisible to any lookup that joined on
-- coffeeId, and lost from view after a "Brew Again" replaced the newest
-- session. This promotes them to a first-class column on `coffees` so they
-- live on the coffee itself, survive session deletion, and are read straight
-- off the row.
--
-- IMPORTANT: bag_flavors (what the BAG says) is DISTINCT from common_notes
-- (what the USER tastes, aggregated from logged sessions by
-- /api/coffees/compact and fed to the recommend AI). Do NOT conflate them.

ALTER TABLE coffees ADD COLUMN IF NOT EXISTS bag_flavors jsonb;

-- Backfill: for every coffee, copy the bag notes from its MOST RECENT session
-- that actually carries them. The scan session has no coffeeId, so match via
-- the coffee row's own session_ids array (which always includes the scan).
-- Only fills coffees that have such a session; the rest stay NULL. Idempotent
-- — re-running only fills rows that are still empty.
UPDATE coffees c
SET bag_flavors = latest.notes
FROM (
  SELECT DISTINCT ON (cc.id)
    cc.id                            AS coffee_id,
    s.coffee->'tastingNotesFromBag'  AS notes
  FROM coffees cc
  JOIN sessions s ON cc.session_ids ? s.id
  WHERE jsonb_array_length(COALESCE((s.coffee->'tastingNotesFromBag')::jsonb, '[]'::jsonb)) > 0
  ORDER BY cc.id, s.created_at_ms DESC
) latest
WHERE c.id = latest.coffee_id
  AND (c.bag_flavors IS NULL OR jsonb_array_length(c.bag_flavors) = 0);
