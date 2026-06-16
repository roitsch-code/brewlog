-- 0018 — Loading-screen insight pool (auto-refreshed)
--
-- The recipe-creation loading screen rotates short, headline-sized coffee
-- insights (Fraunces 40px) while Claude builds the recipe. They were a static
-- code array (src/lib/coffeeHints.ts → COFFEE_HINTS); this table lets a
-- scheduled agent grow and refresh the pool automatically, with no human in
-- the loop.
--
-- Because there is no human review, NOTHING ungrounded may reach the screen:
-- every row carries the source it was grounded in (source = 'corpus' | 'brews'
-- | 'web', source_ref = the corpus entry id / brew-metric key / fetched URL),
-- and the agent only inserts a line after it passes the deterministic gate in
-- src/lib/insights/loadingInsightLint.ts plus a model claim-check. See
-- src/app/api/loading-insights/refresh/route.ts (the agent) and
-- src/app/api/loading-insights/route.ts (the read the screen consumes).
--
-- The static COFFEE_HINTS array stays as the synchronous fallback + seed, so
-- the screen is never empty and never worse than today, even offline / before
-- the first refresh has run.
--
-- Run with:
--   cat src/lib/db/migrations/0018_add_loading_insights.sql | docker compose exec -T postgres psql -U brewlog -d brewlog

CREATE TABLE IF NOT EXISTS loading_insights (
  id              text PRIMARY KEY,
  text            text NOT NULL,
  source          text NOT NULL,                 -- 'corpus' | 'brews' | 'web'
  source_ref      text,                          -- corpus id / metric key / url
  status          text NOT NULL DEFAULT 'live',  -- 'live' | 'retired'
  score           numeric NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_at_ms   bigint NOT NULL,
  verified_at_ms  bigint
);

-- Case-insensitive uniqueness on the line itself — a DB-level dedup backstop
-- in addition to the agent's own normalized dedup.
CREATE UNIQUE INDEX IF NOT EXISTS loading_insights_text_lower_idx
  ON loading_insights (lower(text));
CREATE INDEX IF NOT EXISTS loading_insights_status_idx
  ON loading_insights (status);
CREATE INDEX IF NOT EXISTS loading_insights_created_at_ms_idx
  ON loading_insights (created_at_ms DESC);
