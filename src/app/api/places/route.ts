import { db } from "@/lib/db/client";
import { places } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

async function geocodeServerSide(q: string): Promise<{ lat: number; lng: number } | null> {
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

export async function GET() {
  const rows = await db.select().from(places).orderBy(asc(places.city), asc(places.name));

  const unresolved = rows.filter(p => p.lat == null || p.lng == null);

  for (let i = 0; i < unresolved.length; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 1100));
    const place = unresolved[i];
    const q = place.address
      ? `${place.name}, ${place.address}, ${place.city}`
      : `${place.name}, ${place.city}`;
    const coords = await geocodeServerSide(q);
    if (coords) {
      await db.update(places).set({ lat: coords.lat, lng: coords.lng }).where(eq(places.id, place.id));
      const row = rows.find(r => r.id === place.id);
      if (row) { row.lat = coords.lat; row.lng = coords.lng; }
    }
  }

  return Response.json(rows);
}
