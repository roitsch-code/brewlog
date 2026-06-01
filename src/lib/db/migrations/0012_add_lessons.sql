-- 0012 — Lessons (BTTS distilled memory)
--
-- The point of BTTS is that every brew teaches the app something. Today
-- raw freeNotes / ratings live on the session row and are listed
-- verbatim per turn into /recommend; once a session falls out of the
-- in-prompt history window the insight is gone. This table promotes
-- what we learn to a durable, level-keyed memory that survives history
-- decay and can be read by the user.
--
-- Four levels (one row per (level, scope) pair):
--   - 'coffee'        scope = coffees.id            — per bag
--   - 'roaster'       scope = lowercased roaster    — per roaster
--   - 'method-style'  scope = "Method · basedOn"    — per recipe family
--   - 'process-roast' scope = "Process × Roast"     — across coffees
--
-- The distillation pipeline (src/lib/claude/lessons.ts) updates the
-- content text and confidence_n after meaningful brews. user_status =
-- 'dismissed' means the user thumbsed it down on the Lessons page and
-- it should be hidden from /recommend even if confidence_n grows.
--
-- Run this file with:
--   cat src/lib/db/migrations/0012_add_lessons.sql | docker compose exec -T postgres psql -U brewlog -d brewlog

CREATE TABLE IF NOT EXISTS lessons (
  id                    text PRIMARY KEY,
  level                 text NOT NULL CHECK (level IN ('coffee', 'roaster', 'method-style', 'process-roast')),
  scope                 text NOT NULL,
  content               text NOT NULL,
  confidence_n          integer NOT NULL DEFAULT 0,
  evidence_session_ids  jsonb NOT NULL DEFAULT '[]'::jsonb,
  source                text NOT NULL DEFAULT 'auto' CHECK (source IN ('auto', 'user-confirmed', 'user-edited', 'backfill')),
  status                text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dismissed')),
  user_note             text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS lessons_level_scope_idx ON lessons (level, scope);
CREATE INDEX IF NOT EXISTS lessons_level_idx ON lessons (level);
CREATE INDEX IF NOT EXISTS lessons_status_idx ON lessons (status);
CREATE INDEX IF NOT EXISTS lessons_updated_at_idx ON lessons (updated_at DESC);
