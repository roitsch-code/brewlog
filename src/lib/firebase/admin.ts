import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];

  // Prefer base64-encoded var (avoids all JSON escaping issues on Vercel)
  let raw: string | undefined;
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (b64) {
    try {
      raw = Buffer.from(b64.trim(), "base64").toString("utf8");
    } catch {
      console.error("Firebase Admin: failed to decode B64 env var");
    }
  }
  if (!raw) {
    raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  }

  if (!raw || raw.startsWith('{"type":"service_account",...')) {
    // Placeholder or missing — skip init during build
    return null;
  }
  try {
    const serviceAccount = JSON.parse(raw);
    // Normalize any double-escaped newlines in private key
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
    }
    return initializeApp({
      credential: cert(serviceAccount),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  } catch (err) {
    console.error("Firebase Admin init failed:", err);
    return null;
  }
}

export function getAdminDb() {
  const app = getAdminApp();
  const dbId = (process.env.FIRESTORE_DATABASE_ID || "(default)").trim();
  return app ? getFirestore(app, dbId) : getFirestore();
}

export function getAdminStorage() {
  getAdminApp();
  return getStorage();
}

// Keep named export for backwards compat
export const adminDb = { _lazy: true };
