import { db } from "@/lib/db/client";
import { places } from "@/lib/db/schema";
import { asc, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

let lastNominatimMs = 0;

async function nominatim(q: string): Promise<{ lat: number; lng: number } | null> {
  const wait = Math.max(0, lastNominatimMs + 1100 - Date.now());
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastNominatimMs = Date.now();
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`,
      { headers: { "User-Agent": "BrewLog-Server/1.0" } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch { /* network error */ }
  return null;
}

function buildQueries(name: string, address: string | null, city: string): string[] {
  if (address) return [
    `${name}, ${address}, ${city}`,
    `${address}, ${city}`,          // fallback: geocode the street if business name fails
  ];

  const queries: string[] = [];
  const seen = new Set<string>();
  const add = (q: string) => { if (!seen.has(q)) { seen.add(q); queries.push(q); } };

  // Strip common suffixes — shorter brand name works better in Nominatim
  const stripped = name
    .replace(/\s+(Specialty Coffee Shop|Coffee Shop|Coffee|Kaffee|Kaffeebar|Kafferösterei|Rösterei|Röstfabrik|company)\s*$/i, "")
    .trim();

  if (stripped !== name && stripped.length > 2) add(`${stripped}, ${city}`);

  // Original full name
  add(`${name}, ${city}`);

  // Fix "Coffe" typo → "Coffee"
  if (/\bCoffe\b/.test(name)) add(`${name.replace(/\bCoffe\b/g, "Coffee")}, ${city}`);

  // First word only — useful for acronyms like RVTC, single-word brands
  const first = name.split(/\s+/)[0];
  if (first.length > 3) add(`${first}, ${city}`);

  return queries;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // Nearby mode (map locate-me): nearest resolved places to a lat,lng pair,
  // ranked by great-circle distance in SQL. The client no longer needs the
  // whole table to work out what's close.
  const near = searchParams.get("near");
  if (near) {
    const [latStr, lngStr] = near.split(",");
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return Response.json([]);
    const rows = await db
      .select()
      .from(places)
      .where(sql`${places.lat} IS NOT NULL AND ${places.lng} IS NOT NULL`)
      .orderBy(
        // LEAST(1, …) guards acos against float drift past 1.0 (→ NaN).
        sql`6371 * acos(LEAST(1, cos(radians(${lat})) * cos(radians(${places.lat})) * cos(radians(${places.lng}) - radians(${lng})) + sin(radians(${lat})) * sin(radians(${places.lat}))))`,
      )
      .limit(50);
    return Response.json(rows);
  }

  const q = searchParams.get("q")?.trim() ?? "";

  // Split on whitespace so a search like "Kolo Berlin" requires BOTH "Kolo"
  // AND "Berlin" to appear somewhere in name/city/address — instead of
  // looking for the literal string "Kolo Berlin" in a single column.
  const tokens = q.split(/\s+/).filter(Boolean);

  // No query and no near → empty. The map loads on demand (search or
  // locate-me); the old no-arg branch returned all 6k rows as multi-MB JSON
  // that nothing rendered until the user interacted.
  if (tokens.length === 0) return Response.json([]);

  const rows = await db.select().from(places).where(
    sql.join(
      tokens.map((t) => {
        const pat = `%${t}%`;
        return sql`(${places.name} ILIKE ${pat} OR ${places.city} ILIKE ${pat} OR ${places.address} ILIKE ${pat})`;
      }),
      sql` AND `,
    ),
  ).orderBy(asc(places.city), asc(places.name));
  const unresolved = rows.filter(p => p.lat == null || p.lng == null);

  // Geocode matched-but-unresolved places in the background — newest IDs first
  // so a freshly-added café gets coords on a later search without delaying
  // this response.
  if (unresolved.length > 0) {
    const toGeocode = [...unresolved].sort((a, b) => b.id - a.id).slice(0, 5);
    (async () => {
      for (const place of toGeocode) {
        let coords: { lat: number; lng: number } | null = null;
        for (const query of buildQueries(place.name, place.address, place.city)) {
          coords = await nominatim(query);
          if (coords) break;
        }
        if (coords) {
          await db.update(places).set({ lat: coords.lat, lng: coords.lng }).where(eq(places.id, place.id));
        }
      }
    })().catch(() => {});
  }

  return Response.json(rows);
}
