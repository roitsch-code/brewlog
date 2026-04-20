// One-time migration: Firestore → Postgres
// Run from your local machine (needs both FIREBASE_SERVICE_ACCOUNT_B64 and DATABASE_URL):
//   node scripts/migrate-firestore-to-postgres.mjs
// Idempotent: safe to re-run. Uses INSERT ... ON CONFLICT DO UPDATE.

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import pg from "pg";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

// ── Firebase init ─────────────────────────────────────────────────────────────
const raw = process.env.FIREBASE_SERVICE_ACCOUNT_B64
  ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64.trim(), "base64").toString("utf8")
  : process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

if (!raw) {
  console.error("Missing FIREBASE_SERVICE_ACCOUNT_B64 or FIREBASE_SERVICE_ACCOUNT_JSON");
  process.exit(1);
}

const sa = JSON.parse(raw);
sa.private_key = sa.private_key.replace(/\\n/g, "\n");
initializeApp({ credential: cert(sa) });
const firestore = getFirestore(process.env.FIRESTORE_DATABASE_ID || "(default)");

// ── Postgres init ─────────────────────────────────────────────────────────────
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function migrateSessions() {
  const snap = await firestore.collection("sessions").get();
  console.log(`sessions: ${snap.size} docs`);
  let count = 0;
  for (const doc of snap.docs) {
    const d = doc.data();
    const createdAtIso = d.createdAt ?? new Date().toISOString();
    // Always derive ms from createdAt so the two columns stay in sync —
    // some old Firestore docs predate the createdAtMs field.
    const createdAtMs = d.createdAtMs ?? new Date(createdAtIso).getTime();
    await pool.query(
      `INSERT INTO sessions (id, type, mode, created_at, created_at_ms, coffee, place, context, recommendation, brew, result)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO UPDATE SET
         type=EXCLUDED.type, mode=EXCLUDED.mode, created_at=EXCLUDED.created_at,
         created_at_ms=EXCLUDED.created_at_ms, coffee=EXCLUDED.coffee, place=EXCLUDED.place,
         context=EXCLUDED.context, recommendation=EXCLUDED.recommendation,
         brew=EXCLUDED.brew, result=EXCLUDED.result`,
      [
        doc.id,
        d.type ?? null,
        d.mode ?? null,
        createdAtIso,
        createdAtMs,
        JSON.stringify(d.coffee ?? {}),
        JSON.stringify(d.place ?? null),
        JSON.stringify(d.context ?? null),
        JSON.stringify(d.recommendation ?? null),
        JSON.stringify(d.brew ?? null),
        JSON.stringify(d.result ?? null),
      ]
    );
    count++;
  }
  console.log(`✓ sessions: ${count} upserted`);
}

async function migrateCoffees() {
  const snap = await firestore.collection("coffees").get();
  console.log(`coffees: ${snap.size} docs`);
  let count = 0;
  for (const doc of snap.docs) {
    const d = doc.data();
    await pool.query(
      `INSERT INTO coffees (id, roaster, name, origin, process, fermentation_style, cupping_score,
         first_seen_at, session_count, session_ids, bag_photo_url, latest_roast_date,
         rating_sum, rating_count, avg_rating, personal_notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (id) DO UPDATE SET
         roaster=EXCLUDED.roaster, name=EXCLUDED.name, origin=EXCLUDED.origin,
         process=EXCLUDED.process, fermentation_style=EXCLUDED.fermentation_style,
         cupping_score=EXCLUDED.cupping_score, first_seen_at=EXCLUDED.first_seen_at,
         session_count=EXCLUDED.session_count, session_ids=EXCLUDED.session_ids,
         bag_photo_url=EXCLUDED.bag_photo_url, latest_roast_date=EXCLUDED.latest_roast_date,
         rating_sum=EXCLUDED.rating_sum, rating_count=EXCLUDED.rating_count,
         avg_rating=EXCLUDED.avg_rating, personal_notes=EXCLUDED.personal_notes`,
      [
        doc.id,
        d.roaster ?? null,
        d.name ?? null,
        d.origin ?? null,
        d.process ?? null,
        d.fermentationStyle ?? null,
        d.cuppingScore != null ? String(d.cuppingScore) : null,
        d.firstSeenAt ?? new Date().toISOString(),
        d.sessionCount ?? 0,
        JSON.stringify(d.sessionIds ?? []),
        d.bagPhotoUrl ?? null,
        d.latestRoastDate ?? null,
        d.ratingSum != null ? String(d.ratingSum) : "0",
        d.ratingCount ?? 0,
        d.avgRating != null ? String(d.avgRating) : null,
        d.personalNotes ?? null,
      ]
    );
    count++;
  }
  console.log(`✓ coffees: ${count} upserted`);
}

async function migrateRoasters() {
  const snap = await firestore.collection("roasters").get();
  console.log(`roasters: ${snap.size} docs`);
  let count = 0;
  for (const doc of snap.docs) {
    const d = doc.data();
    await pool.query(
      `INSERT INTO roasters (slug, name, region, style_summary, confidence, aliases, data, saved_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (slug) DO UPDATE SET
         name=EXCLUDED.name, region=EXCLUDED.region, style_summary=EXCLUDED.style_summary,
         confidence=EXCLUDED.confidence, aliases=EXCLUDED.aliases, data=EXCLUDED.data,
         saved_at=EXCLUDED.saved_at`,
      [
        doc.id,
        d.name ?? null,
        d.region ?? null,
        d.styleSummary ?? null,
        d.confidence ?? null,
        JSON.stringify(d.aliases ?? []),
        JSON.stringify(d),
        d.savedAt ?? new Date().toISOString(),
      ]
    );
    count++;
  }
  console.log(`✓ roasters: ${count} upserted`);
}

async function migratePreferences() {
  const doc = await firestore.collection("preferences").doc("default").get();
  if (!doc.exists) { console.log("preferences: none"); return; }
  await pool.query(
    `INSERT INTO preferences (key, data) VALUES ('default', $1)
     ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data`,
    [JSON.stringify(doc.data())]
  );
  console.log("✓ preferences: upserted");
}

async function migrateKnowledge() {
  const kinds = ["insights", "hints", "news", "starterQuestions"];
  for (const kind of kinds) {
    const doc = await firestore.collection("knowledge").doc(kind).get();
    if (!doc.exists) { console.log(`knowledge/${kind}: none`); continue; }
    const pgKind = kind === "starterQuestions" ? "questions" : kind;
    await pool.query(
      `INSERT INTO knowledge (kind, data) VALUES ($1, $2)
       ON CONFLICT (kind) DO UPDATE SET data = EXCLUDED.data`,
      [pgKind, JSON.stringify(doc.data())]
    );
    console.log(`✓ knowledge/${kind} → ${pgKind}`);
  }
}

async function migrateAuth() {
  // Passkey credential
  const credSnap = await firestore.collection("auth_credentials").get();
  for (const doc of credSnap.docs) {
    const d = doc.data();
    await pool.query(
      `INSERT INTO auth_credentials (id, public_key, counter, transports, created_at)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO UPDATE SET
         public_key=EXCLUDED.public_key, counter=EXCLUDED.counter,
         transports=EXCLUDED.transports`,
      [
        doc.id,
        d.publicKey ?? "",
        d.counter ?? 0,
        JSON.stringify(d.transports ?? []),
        d.createdAt ?? new Date().toISOString(),
      ]
    );
    console.log(`✓ auth_credential: ${doc.id}`);
  }
}

async function main() {
  console.log("Starting Firestore → Postgres migration...\n");
  await migrateSessions();
  await migrateCoffees();
  await migrateRoasters();
  await migratePreferences();
  await migrateKnowledge();
  await migrateAuth();
  console.log("\nMigration complete.");
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
