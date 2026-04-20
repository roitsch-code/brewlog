// One-time migration: Firebase Storage bags/ → Hetzner Object Storage
// Run from your local machine:
//   node scripts/migrate-storage-to-s3.mjs
// Idempotent: skips files that already exist in the target bucket.
// After copying, updates coffees.bag_photo_url + sessions.coffee->>'bagPhotoUrl' in Postgres.

import { initializeApp, cert } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
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
initializeApp({
  credential: cert(sa),
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
});
const bucket = getStorage().bucket();

// ── S3 (Hetzner) init ─────────────────────────────────────────────────────────
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
  forcePathStyle: false,
});
const S3_BUCKET = process.env.S3_BUCKET;
const PUBLIC_PREFIX = process.env.NEXT_PUBLIC_S3_PUBLIC_URL_PREFIX;

// ── Postgres init ─────────────────────────────────────────────────────────────
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function fileExistsInS3(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function copyFile(file) {
  const key = file.name; // e.g. bags/abc123.jpg
  if (await fileExistsInS3(key)) {
    console.log(`  skip (exists): ${key}`);
    return `${PUBLIC_PREFIX}/${key}`;
  }
  const [buffer] = await file.download();
  const [metadata] = await file.getMetadata();
  const contentType = metadata.contentType ?? "image/jpeg";
  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  }));
  const newUrl = `${PUBLIC_PREFIX}/${key}`;
  console.log(`  copied: ${key} → ${newUrl}`);
  return newUrl;
}

async function updatePostgresUrls(oldUrl, newUrl) {
  // Update coffees table
  await pool.query(
    `UPDATE coffees SET bag_photo_url = $1 WHERE bag_photo_url = $2`,
    [newUrl, oldUrl]
  );
  // Update sessions.coffee jsonb
  await pool.query(
    `UPDATE sessions
     SET coffee = jsonb_set(coffee, '{bagPhotoUrl}', to_json($1::text)::jsonb)
     WHERE coffee->>'bagPhotoUrl' = $2`,
    [newUrl, oldUrl]
  );
}

async function main() {
  console.log("Listing Firebase Storage bags/ ...");
  const [files] = await bucket.getFiles({ prefix: "bags/" });
  console.log(`Found ${files.length} files\n`);

  for (const file of files) {
    try {
      // Get old public URL (download token URL from Firebase)
      const [metadata] = await file.getMetadata();
      const token = metadata.metadata?.firebaseStorageDownloadTokens;
      const oldUrl = token
        ? `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(file.name)}?alt=media&token=${token}`
        : null;

      const newUrl = await copyFile(file);

      if (oldUrl) {
        await updatePostgresUrls(oldUrl, newUrl);
      }
      // Also update by matching path suffix for robustness
      await pool.query(
        `UPDATE coffees SET bag_photo_url = $1 WHERE bag_photo_url LIKE $2`,
        [newUrl, `%${file.name}`]
      );
      await pool.query(
        `UPDATE sessions
         SET coffee = jsonb_set(coffee, '{bagPhotoUrl}', to_json($1::text)::jsonb)
         WHERE coffee->>'bagPhotoUrl' LIKE $2`,
        [newUrl, `%${file.name}`]
      );
    } catch (err) {
      console.error(`  ERROR on ${file.name}:`, err.message);
    }
  }

  console.log("\nStorage migration complete.");
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
