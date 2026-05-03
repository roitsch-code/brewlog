// Restore lat/lng coordinates from a JSON backup file.
// Run from VPS:
//   docker cp places.json brewlog-app-1:/tmp/places.json
//   docker compose exec app node scripts/restore-coordinates.mjs /tmp/places.json

import pg from "pg";
import { readFileSync } from "fs";

const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error("Usage: node scripts/restore-coordinates.mjs <path-to-places.json>");
  process.exit(1);
}

const places = JSON.parse(readFileSync(jsonPath, "utf8"));
console.log(`Loaded ${places.length} places from JSON`);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

let updated = 0;
let notFound = 0;
let skipped = 0;
const BATCH = 500;

for (let i = 0; i < places.length; i += BATCH) {
  const batch = places.slice(i, i + BATCH);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const p of batch) {
      if (p.lat == null || p.lng == null) {
        skipped++;
        continue;
      }
      const res = await client.query(
        "UPDATE places SET lat=$1, lng=$2 WHERE address=$3 AND lat IS NULL",
        [p.lat, p.lng, p.address]
      );
      if (res.rowCount > 0) updated++;
      else notFound++;
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  console.log(`Progress: ${Math.min(i + BATCH, places.length)}/${places.length}`);
}

await pool.end();
console.log(`Done — updated: ${updated}, not found: ${notFound}, skipped (no coords in JSON): ${skipped}`);
