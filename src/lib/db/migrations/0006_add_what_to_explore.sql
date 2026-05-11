-- Add what_to_explore column to coffees table.
-- Populated weekly alongside written_summary by /api/coffees/compact.
-- Surfaces in /coffees/[id] and in StepContext (the brew-context entry step)
-- as a 2-sentence "what to try next on this coffee" hint.

ALTER TABLE coffees ADD COLUMN IF NOT EXISTS what_to_explore text;
