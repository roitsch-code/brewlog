-- Reset coordinates for places that have an address field so they get
-- re-geocoded with the improved fallback (address+city query).
-- Previously these were geocoded with name+address+city only, which
-- often failed or returned wrong results for business names Nominatim
-- doesn't know.
UPDATE "places" SET lat = NULL, lng = NULL WHERE address IS NOT NULL;
