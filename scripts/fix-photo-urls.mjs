// One-off: fix remaining Firebase URLs in Postgres and migrate scans/ folder if present
import { initializeApp, cert } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import pg from "pg";

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!raw) { console.error("Missing FIREBASE_SERVICE_ACCOUNT_JSON"); process.exit(1); }

const sa = JSON.parse(raw);
sa.private_key = sa.private_key.replace(/\\n/g, "\n");
initializeApp({ credential: cert(sa), storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET });
const bucket = getStorage().bucket();

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY },
  forcePathStyle: false,
});
const S3_BUCKET = process.env.S3_BUCKET;
const PUBLIC_PREFIX = process.env.NEXT_PUBLIC_S3_PUBLIC_URL_PREFIX;
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function fileExistsInS3(key) {
  try { await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key })); return true; } catch { return false; }
}

async function copyIfMissing(file) {
  const key = file.name;
  if (await fileExistsInS3(key)) { console.log(`  skip (exists): ${key}`); return; }
  const [buffer] = await file.download();
  const [metadata] = await file.getMetadata();
  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET, Key: key, Body: buffer,
    ContentType: metadata.contentType ?? "image/jpeg",
    CacheControl: "public, max-age=31536000, immutable",
  }));
  console.log(`  copied: ${key}`);
}

async function main() {
  // 1. Migrate scans/ folder if present
  console.log("Listing Firebase Storage scans/ ...");
  const [scanFiles] = await bucket.getFiles({ prefix: "scans/" });
  console.log(`Found ${scanFiles.length} scan files`);
  for (const file of scanFiles) {
    try { await copyIfMissing(file); } catch (err) { console.error(`  ERROR ${file.name}:`, err.message); }
  }

  // 2. Re-migrate bags/ folder (idempotent — skips existing)
  console.log("\nListing Firebase Storage bags/ ...");
  const [bagFiles] = await bucket.getFiles({ prefix: "bags/" });
  console.log(`Found ${bagFiles.length} bag files`);
  for (const file of bagFiles) {
    try { await copyIfMissing(file); } catch (err) { console.error(`  ERROR ${file.name}:`, err.message); }
  }

  // 3. Fix all Firebase URLs in Postgres via regex transform
  console.log("\nFixing URLs in coffees table...");
  const coffeeRes = await pool.query(`
    UPDATE coffees
    SET bag_photo_url = $1 || '/' || replace(
      regexp_replace(bag_photo_url, '.*/o/([^?]+)\\?.*', '\\1'),
      '%2F', '/'
    )
    WHERE bag_photo_url LIKE '%firebasestorage%'
    RETURNING id, bag_photo_url
  `, [PUBLIC_PREFIX]);
  console.log(`  updated ${coffeeRes.rowCount} coffee rows`);
  coffeeRes.rows.forEach(r => console.log(`    ${r.id} → ${r.bag_photo_url}`));

  console.log("\nFixing URLs in sessions.coffee jsonb...");
  const sessionRes = await pool.query(`
    UPDATE sessions
    SET coffee = jsonb_set(
      coffee,
      '{bagPhotoUrl}',
      to_json($1::text || '/' || replace(
        regexp_replace(coffee->>'bagPhotoUrl', '.*/o/([^?]+)\\?.*', '\\1'),
        '%2F', '/'
      ))::jsonb
    )
    WHERE coffee->>'bagPhotoUrl' LIKE '%firebasestorage%'
  `, [PUBLIC_PREFIX]);
  console.log(`  updated ${sessionRes.rowCount} session rows`);

  console.log("\nDone.");
  await pool.end();
}

main().catch(async e => { console.error(e); await pool.end(); process.exit(1); });
