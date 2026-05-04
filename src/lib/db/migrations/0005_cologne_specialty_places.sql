-- Confirmed Cologne specialty coffee places with street addresses.
-- Addresses enable accurate geocoding (name+address+city) vs name-only guessing.
-- These are inserted WITHOUT coordinates — the /api/places endpoint geocodes them
-- automatically, with newly-added places (highest IDs) processed first.
--
-- Quijote, Kafferösterei Otto, Frank's Nähcafé from migration 0004 are cleaned up:
-- Quijote is actually in Hamburg; the others are unverified. Removing them so
-- locate-me in Cologne doesn't waste slots on unresolvable entries.
DELETE FROM "places"
  WHERE city = 'Köln'
    AND address IS NULL
    AND name IN ('Quijote Coffee Roasters', 'Kafferösterei Otto', 'Frank''s Nähcafé');

INSERT INTO "places" ("name", "address", "city") VALUES
  ('ERNST Kaffeeröster',        'Bonner Str. 56',           'Köln'),
  ('Heilandt Kaffeemanufaktur', 'Bismarckstraße 41',        'Köln'),
  ('Van Dyck Rösterei',         'Körnerstraße 43',          'Köln'),
  ('Van Dyck Mülheim',          'Schanzenstraße 36',        'Köln'),
  ('Schamong Kaffee',           'Venloer Straße 535',       'Köln'),
  ('Benson Coffee',             'Eichendorffstraße 49',     'Köln'),
  ('WIEWALDI coffee roasters',  'Kleiner Griechenmarkt 33', 'Köln'),
  ('Habitat Coffee',            'Burgunderstraße 11',       'Köln'),
  ('Meramanis Coffee Roaster',  'Krefelder Str. 7-9',       'Köln'),
  ('Track One Coffee',          'Rothehausstraße 6-12',     'Köln'),
  ('zwoo Kaffeeröster',         'Körnerstraße 73',          'Köln'),
  ('CafeCafe',                  'Schanzenstraße 36',        'Köln')
ON CONFLICT DO NOTHING;
