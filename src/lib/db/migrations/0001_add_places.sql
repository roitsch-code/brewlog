CREATE TABLE IF NOT EXISTS "places" (
  "id" serial PRIMARY KEY,
  "name" text NOT NULL,
  "address" text,
  "city" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
INSERT INTO "places" ("name", "address", "city") VALUES
  ('Roasted Kaffeebar',             NULL,                        'Düsseldorf'),
  ('Cøffe',                          NULL,                        'Düsseldorf'),
  ('Stoak',                         NULL,                        'Düsseldorf'),
  ('Schvarz Kaffee',                NULL,                        'Düsseldorf'),
  ('BREW Specialty Coffee Shop',    NULL,                        'Düsseldorf'),
  ('No Worries Coffee',             NULL,                        'Düsseldorf'),
  ('MERCY coffee company',          NULL,                        'Düsseldorf'),
  ('Weird Space',                   'Hüttenstraße',              'Düsseldorf'),
  ('Weird Space',                   'Volmerswerther Straße',     'Düsseldorf'),
  ('Carl Ferdinand Kaffeebar',      NULL,                        'Düsseldorf'),
  ('Kasper Coffee',                 NULL,                        'Düsseldorf'),
  ('Goldsheim Coffee',              NULL,                        'Düsseldorf'),
  ('Jaenner Coffee',                NULL,                        'Düsseldorf'),
  ('Orange - Finest Coffee',        NULL,                        'Düsseldorf'),
  ('Carl Ferdinand Röstfabrik',     NULL,                        'Düsseldorf'),
  ('B12 Coffee',                    NULL,                        'Düsseldorf'),
  ('Rösterei Vier',                 NULL,                        'Düsseldorf'),
  ('Lightroast Coffee',             NULL,                        'Düsseldorf')
ON CONFLICT DO NOTHING;
