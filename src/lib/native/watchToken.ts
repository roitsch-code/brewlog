/**
 * Storage for the Apple Watch's APNs push token (single-user). Kept in the
 * `preferences` key-value table so there's no migration. Read by the push
 * route, written by the register-token route.
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { preferences } from "@/lib/db/schema";

const KEY = "watch-push-token";

interface StoredToken {
  token: string;
  updatedAt: string;
}

export async function setStoredWatchToken(token: string): Promise<void> {
  const data: StoredToken = { token, updatedAt: new Date().toISOString() };
  await db
    .insert(preferences)
    .values({ key: KEY, data })
    .onConflictDoUpdate({ target: preferences.key, set: { data } });
}

export async function getStoredWatchToken(): Promise<string | null> {
  const rows = await db.select().from(preferences).where(eq(preferences.key, KEY)).limit(1);
  const data = rows[0]?.data as StoredToken | undefined;
  return data?.token ?? null;
}

export async function clearStoredWatchToken(): Promise<void> {
  await db.delete(preferences).where(eq(preferences.key, KEY));
}
