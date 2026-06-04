-- 0017 — Insight snooze status
--
-- The original 3-action coach card collapsed three outcomes into a single
-- decision row (Try it / Confirmed / Doesn't apply) and removed the card
-- from view the moment any action was taken. The "saved to try" intent
-- never closed the loop because the user lost sight of what they'd
-- committed to.
--
-- The redesign splits the workflow into two visible stages:
--   1. New stage (status='new') → Save to try / Confirmed / Doesn't apply
--   2. Saved stage (status='trying') → It helped / Didn't help / Skip
--
-- "Skip" means **remind me later**, which needs a new status that
-- re-enters the queue after a cool-off. This migration introduces
-- 'snoozed' and a snoozed_until timestamp:
--
--   status='snoozed' AND snoozed_until > now() → hidden from all surfaces
--   status='snoozed' AND snoozed_until <= now() → resurfaces (regen
--     treats it like 'new' again)
--
-- Default snooze window: 7 days, set by the PATCH endpoint when the user
-- taps Skip. Matches the conversation-cleanup TTL — feels right for a
-- brewing reminder cadence; tunable later.
--
-- Run with:
--   cat src/lib/db/migrations/0017_add_insight_snooze.sql \
--     | docker compose exec -T postgres psql -U brewlog -d brewlog

-- Drop the existing inline CHECK constraint from migration 0014 — its
-- auto-generated name varies (insights_status_check / _check1 / etc.)
-- so we look it up rather than guessing.
DO $$
DECLARE
  cons_name text;
BEGIN
  SELECT conname INTO cons_name
  FROM pg_constraint
  WHERE conrelid = 'insights'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%'
  LIMIT 1;
  IF cons_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE insights DROP CONSTRAINT %I', cons_name);
  END IF;
END $$;

ALTER TABLE insights
  ADD CONSTRAINT insights_status_check
    CHECK (status IN ('new', 'trying', 'confirmed', 'doesnt-apply', 'snoozed'));

ALTER TABLE insights
  ADD COLUMN IF NOT EXISTS snoozed_until timestamptz;

CREATE INDEX IF NOT EXISTS insights_snoozed_until_idx ON insights (snoozed_until);
