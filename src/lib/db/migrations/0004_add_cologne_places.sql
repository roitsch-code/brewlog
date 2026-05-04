INSERT INTO "places" ("name", "address", "city") VALUES
  ('Quijote Coffee Roasters', NULL, 'Köln'),
  ('Kafferösterei Otto',      NULL, 'Köln'),
  ('Frank''s Nähcafé',        NULL, 'Köln')
ON CONFLICT DO NOTHING;
