import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { knowledge } from "@/lib/db/schema";

export type NewsItemType = "article" | "video" | "instagram" | "podcast" | "research" | "social";

export interface NewsItem {
  id: string;
  title: string;
  excerpt: string;
  url: string;
  type: NewsItemType;
  source: string;
  savedAt: string;
}

const KIND = "news";

export async function getNews(limit = 30): Promise<NewsItem[]> {
  try {
    const rows = await db.select().from(knowledge).where(eq(knowledge.kind, KIND)).limit(1);
    const data = rows[0]?.data as { items?: NewsItem[] } | undefined;
    const items = Array.isArray(data?.items) ? data!.items! : [];
    return items.slice(0, limit);
  } catch (err) {
    console.error("getNews error:", err);
    return [];
  }
}

export async function saveNews(items: NewsItem[]): Promise<void> {
  const data = { items, updatedAt: new Date().toISOString() };
  await db
    .insert(knowledge)
    .values({ kind: KIND, data })
    .onConflictDoUpdate({ target: knowledge.kind, set: { data } });
}

export async function addNewsItems(newItems: Omit<NewsItem, "id" | "savedAt">[]): Promise<number> {
  const existing = await getNews(100);
  const existingUrls = new Set(existing.map(n => n.url.toLowerCase()));

  const toAdd: NewsItem[] = newItems
    .filter(n => n.url && !existingUrls.has(n.url.toLowerCase()))
    .map(n => ({
      ...n,
      id: `news_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      savedAt: new Date().toISOString(),
    }));

  if (toAdd.length === 0) return 0;

  const combined = [...toAdd, ...existing].slice(0, 60);
  await saveNews(combined);
  return toAdd.length;
}
