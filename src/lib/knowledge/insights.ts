import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { knowledge } from "@/lib/db/schema";

const KIND = "insights";

export interface InsightItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url?: string;
  tags: string[];
  savedAt: string;
}

export async function getInsights(limit?: number): Promise<InsightItem[]> {
  try {
    const rows = await db.select().from(knowledge).where(eq(knowledge.kind, KIND)).limit(1);
    console.log("[getInsights] rows:", JSON.stringify(rows).slice(0, 500));
    const data = rows[0]?.data as { items?: InsightItem[] } | undefined;
    console.log("[getInsights] data keys:", data ? Object.keys(data) : "null", "items len:", data?.items?.length);
    if (data && Array.isArray(data.items)) {
      const shuffled = [...data.items].sort(() => Math.random() - 0.5);
      return limit ? shuffled.slice(0, limit) : shuffled;
    }
  } catch (err) {
    console.error("getInsights: db error:", err);
  }
  return [];
}

export async function saveInsights(items: InsightItem[]): Promise<void> {
  const data = { items, updatedAt: new Date().toISOString() };
  await db
    .insert(knowledge)
    .values({ kind: KIND, data })
    .onConflictDoUpdate({ target: knowledge.kind, set: { data } });
}

export async function addInsight(
  item: Omit<InsightItem, "id" | "savedAt">
): Promise<void> {
  const existing = await getInsights();
  const newItem: InsightItem = {
    ...item,
    id: `insight_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    savedAt: new Date().toISOString(),
  };
  await saveInsights([newItem, ...existing]);
}
