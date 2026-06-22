-- 0019 — Adaptive hydration check-in
--
-- An evening, graded self-assessment of how much the user drank against a
-- daily target that adapts to heat (apparent temperature) and movement
-- (active calories). The table stores the TARGET + its composition + the
-- CONTEXT it was computed from + the user's ordinal answer, so later both the
-- self-assessment and the conditions behind it can be correlated.
--
-- Single-user app: like every other table here there is NO user_id; the day
-- is the natural key (one check-in row per calendar day, Europe/Berlin).
--
-- self_assessment is the 1..5 ordinal answer (spec §4); NULL = not answered.
-- *_data_missing flags mark when heat/activity data was unavailable so the
-- surcharge was 0 — the day is still kept, not skipped.
-- anhebung_gemeldet_ml is the last target value announced to the user, for the
-- anti-spam guard on the "target raised" message (spec §5).
--
-- Run with:
--   cat src/lib/db/migrations/0019_add_hydration_checkin.sql | docker compose exec -T postgres psql -U brewlog -d brewlog

CREATE TABLE IF NOT EXISTS hydration_checkin (
  id                      BIGSERIAL   PRIMARY KEY,
  day                     DATE        NOT NULL UNIQUE,

  -- Target composition (all ml)
  basis_ml                INTEGER     NOT NULL,
  hitze_aufschlag_ml      INTEGER     NOT NULL DEFAULT 0,
  bewegungs_aufschlag_ml  INTEGER     NOT NULL DEFAULT 0,
  ziel_ml                 INTEGER     NOT NULL,   -- computed, after cap

  -- Context (for later correlation)
  apparent_temp_max_c     NUMERIC(4,1),
  active_calories         INTEGER,
  heat_data_missing       BOOLEAN     NOT NULL DEFAULT FALSE,
  activity_data_missing   BOOLEAN     NOT NULL DEFAULT FALSE,

  -- Answer
  self_assessment         SMALLINT,   -- 1..5, NULL = not answered
  assessed_at             TIMESTAMPTZ,
  geschaetzte_menge_ml    INTEGER,    -- optional, derived from level × target
  notiz                   TEXT,

  -- Communication (anti-spam: last announced target)
  anhebung_gemeldet_ml    INTEGER,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT hydration_checkin_self_assessment_range
    CHECK (self_assessment IS NULL OR self_assessment BETWEEN 1 AND 5)
);
