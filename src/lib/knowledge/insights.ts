import { getAdminDb } from "@/lib/firebase/admin";

const COLLECTION = "knowledge";
const DOC = "insights";

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
    const db = getAdminDb();
    const doc = await db.collection(COLLECTION).doc(DOC).get();
    if (doc.exists) {
      const data = doc.data() as { items: InsightItem[]; updatedAt: string };
      if (Array.isArray(data.items)) {
        const shuffled = [...data.items].sort(() => Math.random() - 0.5);
        return limit ? shuffled.slice(0, limit) : shuffled;
      }
    }
  } catch (err) {
    console.error("getInsights: Firestore error:", err);
  }
  return [];
}

export async function saveInsights(items: InsightItem[]): Promise<void> {
  const db = getAdminDb();
  await db.collection(COLLECTION).doc(DOC).set({
    items,
    updatedAt: new Date().toISOString(),
  });
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
