-- Migration 0025 — pending_brews: brews that finished the timer but are not
-- rated yet.
--
-- Until now a brew reached the database only on the Summary screen's Save. The
-- whole brewed draft (recipe, actual time, Acaia flow analysis) lived in ONE
-- localStorage slot, and every new entry into the flow (New Session, Brew
-- Again, widget, drip scan) called reset() and overwrote it — an unrated brew
-- was simply gone. The Log screen now writes the draft here the moment it
-- opens; the Home card lists these rows; the real sessions POST deletes the
-- row once the brew is rated and saved (body.pendingBrewId).
--
-- A SEPARATE table on purpose: nothing that reads `sessions` (recommend, coach,
-- chat, greeting, taste stats) ever sees an unrated brew, so no corpus consumer
-- changes behaviour.
--
-- dismissed_at: the owner tapped Dismiss — the row stops reminding but is kept
-- (still ratable from /brew/unrated).
--
-- Idempotent (IF NOT EXISTS), creates no rows — a no-op on re-run and safe on
-- the empty CI database.

CREATE TABLE IF NOT EXISTS pending_brews (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL,
  created_at_ms bigint NOT NULL,
  draft jsonb NOT NULL,
  field_zones jsonb,
  dismissed_at timestamptz
);

CREATE INDEX IF NOT EXISTS pending_brews_created_at_ms_idx
  ON pending_brews (created_at_ms DESC);
