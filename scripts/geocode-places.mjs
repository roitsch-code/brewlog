// Re-geocode all places missing coordinates.
// Run from VPS: docker cp scripts brewlog-app-1:/app/ && docker compose exec app node scripts/geocode-places.mjs
// Takes ~2 hours for 6000+ places due to Nominatim 1 req/sec rate limit.
// Safe to interrupt and re-run — skips places that already have coords.

import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

function buildQueries(name, address, city) {
  if (address) return [
    `${name}, ${address}, ${city}`,
    `${address}, ${city}`,
  ];

  const queries = [];
  const seen = new Set();
  const add = (q) => { if (!seen.has(q)) { seen.add(q); queries.push(q); } };

  const stripped = name
    .replace(/\s+(Specialty Coffee Shop|Coffee Shop|Coffee|Kaffee|Kaffeebar|Kafferösterei|Rösterei|Röstfabrik|company)\s*$/i, "")
    .trim();

  if (stripped !== name && stripped.length > 2) add(`${stripped}, ${city}`);
  add(`${name}, ${city}`);
  if (/\bCoffe\b/.test(name)) add(`${name.replace(/\bCoffe\b/g, "Coffee")}, ${city}`);
  const first = name.split(/\s+/)[0];
  if (first.length > 3) add(`${first}, ${city}`);

  return queries;
}

let lastNominatimMs = 0;

async function nominatim(q) {
  const wait = Math.max(0, lastNominatimMs + 1100 - Date.now());
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastNominatimMs = Date.now();
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`,
      { headers: { "User-Agent": "BrewLog-Geocode/1.0" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch { /* network error */ }
  return null;
}

const { rows } = await pool.query(
  "SELECT id, name, address, city FROM places WHERE lat IS NULL ORDER BY id"
);

console.log(`${rows.length} places to geocode`);

let resolved = 0;
let failed = 0;

for (let i = 0; i < rows.length; i++) {
  const place = rows[i];
  let coords = null;

  for (const q of buildQueries(place.name, place.address, place.city)) {
    coords = await nominatim(q);
    if (coords) break;
  }

  if (coords) {
    await pool.query(
      "UPDATE places SET lat = $1, lng = $2 WHERE id = $3",
      [coords.lat, coords.lng, place.id]
    );
    resolved++;
  } else {
    failed++;
  }

  if ((i + 1) % 100 === 0) {
    console.log(`${i + 1}/${rows.length} — resolved: ${resolved}, failed: ${failed}`);
  }
}

console.log(`Done. Resolved: ${resolved}, failed: ${failed}`);
await pool.end();
