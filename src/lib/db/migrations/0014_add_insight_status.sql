-- 0014 — Insight status workflow
--
-- The original insights table (0013) had only `dismissed_at`. The user
-- found that affordance confusing on /taste (only "Not for me" with no
-- feedback). This migration adds a richer workflow:
--
--   status = 'new'         → just generated, visible in /taste queue
--   status = 'trying'      → user tapped "Try it"; surfaces as a quiet
--                            reminder in /brew/new Context step
--   status = 'confirmed'   → user tapped "Confirmed"; carries higher
--                            weight in /recommend + /greeting prompts
--   status = 'doesnt-apply'→ user tapped "Doesn't apply"; soft-dismissed
--                            and inherited across regenerations so the
--                            same observation isn't re-pitched
--
-- Replaces dismissed_at semantically. The column is kept for back-compat
-- but new rows default to status='new' and the orchestrator preserves
-- non-'new' rows across Opus regenerations.
--
-- Run with:
--   cat src/lib/db/migrations/0014_add_insight_status.sql \
--     | docker compose exec -T postgres psql -U brewlog -d brewlog

ALTER TABLE insights
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'trying', 'confirmed', 'doesnt-apply'));

-- Back-fill any existing dismissed_at rows so the user's previous
-- dismissals don't pop back as 'new'.
UPDATE insights
  SET status = 'doesnt-apply'
  WHERE dismissed_at IS NOT NULL
    AND status = 'new';

CREATE INDEX IF NOT EXISTS insights_status_idx ON insights (status);
