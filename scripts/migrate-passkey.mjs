// One-off: migrate passkey from Firestore auth/credential doc to Postgres auth_credentials table
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import pg from "pg";

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!raw) { console.error("Missing FIREBASE_SERVICE_ACCOUNT_JSON"); process.exit(1); }

const sa = JSON.parse(raw);
sa.private_key = sa.private_key.replace(/\\n/g, "\n");
initializeApp({ credential: cert(sa) });
const firestore = getFirestore(process.env.FIRESTORE_DATABASE_ID || "(default)");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const doc = await firestore.collection("auth").doc("credential").get();
  if (!doc.exists) { console.log("No passkey document found at auth/credential"); return; }
  const d = doc.data();
  console.log("Migrating credential id:", d.id);
  await pool.query(
    `INSERT INTO auth_credentials (id, public_key, counter, transports, created_at)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (id) DO UPDATE SET public_key=EXCLUDED.public_key, counter=EXCLUDED.counter, transports=EXCLUDED.transports`,
    [d.id, d.publicKey, d.counter ?? 0, JSON.stringify(d.transports ?? []), new Date(d.createdAt || Date.now())]
  );
  console.log("✓ Passkey migrated");
  await pool.end();
}

run().catch(e => { console.error(e); process.exit(1); });
