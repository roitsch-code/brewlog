-- 0013 — Lessons: questions + answers for the "ask before rating" flow
--
-- When the live distiller (src/lib/claude/lessons.ts) decides it cannot
-- write a confident lesson from the brew evidence alone — multiple
-- plausible causes (recipe vs bag age vs water source vs technique
-- drift) — it now stores a DRAFT plus a small set of clarifying
-- questions and flips status='pending'. The user answers on the
-- /lessons page; a second Haiku turn folds the answers in and the row
-- moves back to status='active'.
--
-- Two new nullable JSONB columns:
--   - questions LessonQuestion[]  | null  — populated while status='pending'
--   - answers   LessonAnswer[]    | null  — populated once the user has answered
--
-- Status CHECK is extended to allow 'pending' alongside the existing
-- 'active' / 'dismissed'. DROP IF EXISTS guards the rename so the
-- migration is safe to apply on systems where the auto-named
-- constraint differs from the default lessons_status_check.
--
-- Run on VPS:
--   cat src/lib/db/migrations/0013_add_lesson_questions.sql \
--     | docker compose exec -T postgres psql -U brewlog -d brewlog

ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS questions jsonb;

ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS answers jsonb;

ALTER TABLE lessons
  DROP CONSTRAINT IF EXISTS lessons_status_check;

ALTER TABLE lessons
  ADD CONSTRAINT lessons_status_check
  CHECK (status IN ('active', 'dismissed', 'pending'));
