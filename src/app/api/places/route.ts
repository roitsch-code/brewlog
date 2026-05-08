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
  const q = searchParams.get("q")?.trim() ?? "";

  // Split on whitespace so a search like "Kolo Berlin" requires BOTH "Kolo"
  // AND "Berlin" to appear somewhere in name/city/address — instead of
  // looking for the literal string "Kolo Berlin" in a single column.
  const tokens = q.split(/\s+/).filter(Boolean);

  const rows = tokens.length > 0
    ? await db.select().from(places).where(
        sql.join(
          tokens.map((t) => {
            const pat = `%${t}%`;
            return sql`(${places.name} ILIKE ${pat} OR ${places.city} ILIKE ${pat} OR ${places.address} ILIKE ${pat})`;
          }),
          sql` AND `,
        ),
      ).orderBy(asc(places.city), asc(places.name))
    : await db.select().from(places).orderBy(asc(places.city), asc(places.name));
  const unresolved = rows.filter(p => p.lat == null || p.lng == null);

  // Geocode any unresolved places in the background — newest IDs first so
  // recently-added cities get coords on the next load without delaying this response.
  // Previously this was synchronous (5 × 1.1s = 5.5s+ delay), which meant
  // locate-me fired before places were loaded and showed "No cafés in this area".
  if (unresolved.length > 0) {
    const toGeocode = [...unresolved].sort((a, b) => b.id - a.id).slice(0, 5);
    (async () => {
      for (const place of toGeocode) {
        let coords: { lat: number; lng: number } | null = null;
        for (const q of buildQueries(place.name, place.address, place.city)) {
          coords = await nominatim(q);
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
