import { desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sessions } from "@/lib/db/schema";
import { rowToSession } from "@/lib/db/helpers";
import type { Session } from "@/lib/types/session";

/**
 * Server-side read of the most recent brews.
 *
 * The chat used to work purely from the array the client POSTs with every
 * turn, which capped its history at whatever the home page had fetched (5) —
 * so with 184 brews logged it reasoned about the last 2.7% of them, and the
 * roaster / variety prior blocks it derives from that array saw at most five
 * bags. Raising the client's array instead would have re-uploaded every extra
 * session on every single turn; reading them here costs one indexed query
 * against createdAtMs and keeps the request small.
 *
 * Returns [] on any failure — the caller falls back to the client's array, so
 * a DB hiccup degrades the chat's memory rather than breaking the turn.
 */
export async function loadRecentSessions(limit = 20): Promise<Session[]> {
  try {
    const rows = await db
      .select()
      .from(sessions)
      .orderBy(desc(sessions.createdAtMs))
      .limit(limit);
    return rows.map(rowToSession);
  } catch (err) {
    console.error("loadRecentSessions error:", err);
    return [];
  }
}
