import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { knowledge } from "@/lib/db/schema";

const KIND = "hints";

import { COFFEE_HINTS } from "@/lib/coffeeHints";
export { COFFEE_HINTS as FALLBACK_HINTS };

export async function getHints(): Promise<string[]> {
  try {
    const rows = await db.select().from(knowledge).where(eq(knowledge.kind, KIND)).limit(1);
    const data = rows[0]?.data as { hints?: string[] } | undefined;
    if (data && Array.isArray(data.hints) && data.hints.length > 0) {
      return data.hints;
    }
  } catch (err) {
    console.error("getHints: db error:", err);
  }
  return COFFEE_HINTS;
}

export async function saveHints(hints: string[]): Promise<void> {
  const data = { hints, updatedAt: new Date().toISOString() };
  await db
    .insert(knowledge)
    .values({ kind: KIND, data })
    .onConflictDoUpdate({ target: knowledge.kind, set: { data } });
}
