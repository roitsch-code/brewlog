-- Migration 0024 — one-off data fix: the chat brew of 2026-10-10 15:21
-- (Düsseldorf) was logged under SEY "Wilson Alba - Sierra Morena - End of
-- Season", but the owner brewed SEY "Susan Meneses" (not in the library).
--
-- Why: the chat's start_brew pill carried the label "Brew SEY Susan Meneses —
-- V60" with the Wilson Alba id — the model invented the id and the route
-- trusted it (fixed in #619: a known id whose roaster+name describe a
-- different bag is dropped). The session's `coffee` JSONB is therefore
-- Wilson Alba's identity (incl. its 2026-05-30 roast date), and Wilson
-- Alba's aggregates carry a brew + a 3★ rating that are not its own.
--
-- What this does (one session, two coffee rows):
--   1. creates the coffees row for SEY Susan Meneses (slug = coffeeKeyFor,
--      the same `roaster__name` expression migration 0023 mirrors);
--   2. re-points the session's coffee JSONB (roaster/name/coffeeId) to it and
--      REMOVES the fields that were Wilson Alba's, never Susan Meneses's
--      (roastDate, origin, region, variety, process, bagPhotoUrl/Path,
--      tastingNotesFromBag, cuppingScore) — nothing is invented in their place;
--   3. moves the session id + the rating out of Wilson Alba's aggregates
--      (session_count 2 → 1, rating_sum −3, rating_count −1, avg recomputed)
--      into the new row's.
--
-- OWNER-CONFIRMED VALUES (fill before merging the `.github/migrate` marker):
--   origin / process / roast date of the Susan Meneses bag are NOT known to
--   the app and are NOT guessed here: origin + process are set to the
--   placeholders 'Unknown' / 'Other' (both legal in the schema and the UI's
--   own "not sure" values), roast date is left empty. Edit them on the coffee
--   page or via a follow-up once the owner says what is printed on the bag.
--
-- SAFETY: exactly ONE session may match (name + a 40-minute window around
-- 13:21 UTC); 0 rows → no-op (CI applies every migration to an EMPTY DB);
-- >1 rows → abort. Idempotent: once the session points at the new row the
-- match (by the OLD name) is empty and nothing runs twice.

DO $$
DECLARE
  old_id   text := 'sey__wilson_alba___sierra_morena___end_of_season';
  new_id   text := 'sey__susan_meneses';
  sid      text;
  n        int;
  rating   numeric;
  old_cnt  int;
  old_sum  numeric;
  old_rc   int;
BEGIN
  SELECT count(*) INTO n
  FROM sessions
  WHERE coffee->>'name' = 'Wilson Alba - Sierra Morena - End of Season'
    AND coffee->>'roaster' = 'SEY'
    AND created_at BETWEEN '2026-10-10 13:00:00+00' AND '2026-10-10 13:40:00+00';

  IF n = 0 THEN
    RAISE NOTICE 'No 2026-10-10 15:21 Wilson Alba session found — nothing to move (skipping)';
    RETURN;
  END IF;
  IF n > 1 THEN
    RAISE EXCEPTION 'Expected exactly 1 matching session, found % — aborting', n;
  END IF;

  SELECT id, NULLIF(result->>'rating','')::numeric INTO sid, rating
  FROM sessions
  WHERE coffee->>'name' = 'Wilson Alba - Sierra Morena - End of Season'
    AND coffee->>'roaster' = 'SEY'
    AND created_at BETWEEN '2026-10-10 13:00:00+00' AND '2026-10-10 13:40:00+00';

  -- 1. the new coffee row (merge if a later brew already created it)
  INSERT INTO coffees (id, roaster, name, origin, process, first_seen_at,
                       session_count, session_ids, rating_sum, rating_count, avg_rating, in_rotation)
  VALUES (new_id, 'SEY', 'Susan Meneses', 'Unknown', 'Other',
          to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          1, jsonb_build_array(sid),
          COALESCE(rating, 0), CASE WHEN rating IS NULL THEN 0 ELSE 1 END,
          rating, true)
  ON CONFLICT (id) DO UPDATE SET
    session_count = coffees.session_count + 1,
    session_ids   = coffees.session_ids || jsonb_build_array(sid),
    rating_sum    = COALESCE(coffees.rating_sum, 0) + COALESCE(rating, 0),
    rating_count  = COALESCE(coffees.rating_count, 0) + CASE WHEN rating IS NULL THEN 0 ELSE 1 END,
    avg_rating    = CASE
                      WHEN COALESCE(coffees.rating_count, 0) + CASE WHEN rating IS NULL THEN 0 ELSE 1 END = 0 THEN NULL
                      ELSE (COALESCE(coffees.rating_sum, 0) + COALESCE(rating, 0))
                           / (COALESCE(coffees.rating_count, 0) + CASE WHEN rating IS NULL THEN 0 ELSE 1 END)
                    END;

  -- 2. the session's identity
  UPDATE sessions
  SET coffee = (coffee
                 - 'roastDate' - 'origin' - 'region' - 'variety' - 'process'
                 - 'bagPhotoUrl' - 'bagPhotoPath' - 'tastingNotesFromBag' - 'cuppingScore'
                 - 'components' - 'fermentationStyle')
               || jsonb_build_object('roaster', 'SEY', 'name', 'Susan Meneses',
                                     'coffeeId', new_id, 'origin', 'Unknown', 'process', 'Other',
                                     'aiExtracted', false)
  WHERE id = sid;

  -- 3. Wilson Alba's aggregates lose the brew
  SELECT session_count, COALESCE(rating_sum, 0), COALESCE(rating_count, 0)
    INTO old_cnt, old_sum, old_rc
  FROM coffees WHERE id = old_id;
  IF old_cnt IS NOT NULL THEN
    UPDATE coffees
    SET session_ids   = COALESCE((SELECT jsonb_agg(x) FROM jsonb_array_elements(session_ids) x WHERE x #>> '{}' <> sid), '[]'::jsonb),
        session_count = GREATEST(old_cnt - 1, 0),
        rating_sum    = GREATEST(old_sum - COALESCE(rating, 0), 0),
        rating_count  = GREATEST(old_rc - CASE WHEN rating IS NULL THEN 0 ELSE 1 END, 0),
        avg_rating    = CASE
                          WHEN old_rc - CASE WHEN rating IS NULL THEN 0 ELSE 1 END <= 0 THEN NULL
                          ELSE (old_sum - COALESCE(rating, 0)) / (old_rc - CASE WHEN rating IS NULL THEN 0 ELSE 1 END)
                        END
    WHERE id = old_id;
  END IF;

  RAISE NOTICE 'Moved session % (rating %) from % to %', sid, rating, old_id, new_id;
END $$;
