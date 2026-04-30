// Rebuild the coffees table from all sessions — safe to run multiple times.
// Fixes sessions that were saved before the external-mode coffees-table bug was introduced.
//
// Run on VPS:
//   docker compose exec app node scripts/rebuild-coffees-table.mjs

import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

function toCoffeeKey(roaster, name) {
  return `${roaster}__${name}`.toLowerCase().replace(/[^a-z0-9]/g, "_");
}

async function main() {
  const client = await pool.connect();
  try {
    const { rows: sessions } = await client.query(
      "SELECT id, coffee, result, created_at FROM sessions ORDER BY created_at_ms ASC"
    );

    console.log(`Processing ${sessions.length} sessions…`);

    const coffeeMap = new Map();

    for (const session of sessions) {
      const coffee = session.coffee;
      if (!coffee?.name || !coffee?.roaster) continue;

      const key = toCoffeeKey(coffee.roaster, coffee.name);
      const rating = session.result?.rating;
      const hasRating = typeof rating === "number" && rating > 0;

      if (!coffeeMap.has(key)) {
        coffeeMap.set(key, {
          id: key,
          roaster: coffee.roaster,
          name: coffee.name,
          origin: coffee.origin || "",
          process: coffee.process || "",
          fermentationStyle: coffee.fermentationStyle ?? null,
          cuppingScore: coffee.cuppingScore != null ? String(coffee.cuppingScore) : null,
          firstSeenAt: session.created_at.toISOString(),
          sessionIds: [],
          bagPhotoUrl: coffee.bagPhotoUrl || null,
          latestRoastDate: coffee.roastDate ?? null,
          ratingSum: 0,
          ratingCount: 0,
        });
      }

      const entry = coffeeMap.get(key);
      entry.sessionIds.push(session.id);
      if (hasRating) {
        entry.ratingSum += rating;
        entry.ratingCount += 1;
      }
      // Keep most recent bag photo and roast date
      if (coffee.bagPhotoUrl) entry.bagPhotoUrl = coffee.bagPhotoUrl;
      if (coffee.roastDate) entry.latestRoastDate = coffee.roastDate;
    }

    console.log(`Found ${coffeeMap.size} unique coffees.`);

    for (const entry of coffeeMap.values()) {
      const avgRating = entry.ratingCount > 0
        ? String(entry.ratingSum / entry.ratingCount)
        : null;

      await client.query(
        `INSERT INTO coffees (
          id, roaster, name, origin, process, fermentation_style, cupping_score,
          first_seen_at, session_count, session_ids, bag_photo_url, latest_roast_date,
          rating_sum, rating_count, avg_rating
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        ON CONFLICT (id) DO UPDATE SET
          roaster = EXCLUDED.roaster,
          name = EXCLUDED.name,
          origin = EXCLUDED.origin,
          process = EXCLUDED.process,
          fermentation_style = EXCLUDED.fermentation_style,
          cupping_score = EXCLUDED.cupping_score,
          session_count = EXCLUDED.session_count,
          session_ids = EXCLUDED.session_ids,
          bag_photo_url = COALESCE(EXCLUDED.bag_photo_url, coffees.bag_photo_url),
          latest_roast_date = COALESCE(EXCLUDED.latest_roast_date, coffees.latest_roast_date),
          rating_sum = EXCLUDED.rating_sum,
          rating_count = EXCLUDED.rating_count,
          avg_rating = EXCLUDED.avg_rating`,
        [
          entry.id,
          entry.roaster,
          entry.name,
          entry.origin,
          entry.process,
          entry.fermentationStyle,
          entry.cuppingScore,
          entry.firstSeenAt,
          entry.sessionIds.length,
          JSON.stringify(entry.sessionIds),
          entry.bagPhotoUrl,
          entry.latestRoastDate,
          String(entry.ratingSum),
          entry.ratingCount,
          avgRating,
        ]
      );

      console.log(`  ${entry.name} (${entry.roaster}) — ${entry.sessionIds.length} session(s)`);
    }

    console.log("Done.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
