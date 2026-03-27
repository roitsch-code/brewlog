import { getAdminDb } from "@/lib/firebase/admin";

export type NewsItemType = "article" | "video" | "instagram" | "podcast" | "research" | "social";

export interface NewsItem {
  id: string;
  title: string;
  excerpt: string; // 1–2 sentences
  url: string;
  type: NewsItemType;
  source: string; // e.g. "James Hoffmann", "Barista Hustle", "SCA"
  savedAt: string;
}

const COLLECTION = "knowledge";
const DOC = "news";

export async function getNews(limit = 30): Promise<NewsItem[]> {
  try {
    const db = getAdminDb();
    const snap = await db.collection(COLLECTION).doc(DOC).get();
    if (!snap.exists) return [];
    const data = snap.data() as { items?: NewsItem[] };
    const items = Array.isArray(data?.items) ? data.items : [];
    return items.slice(0, limit);
  } catch (err) {
    console.error("getNews error:", err);
    return [];
  }
}

export async function saveNews(items: NewsItem[]): Promise<void> {
  const db = getAdminDb();
  await db.collection(COLLECTION).doc(DOC).set({ items, updatedAt: new Date().toISOString() });
}

export async function addNewsItems(newItems: Omit<NewsItem, "id" | "savedAt">[]): Promise<number> {
  const existing = await getNews();
  const existingUrls = new Set(existing.map(n => n.url.toLowerCase()));

  const toAdd: NewsItem[] = newItems
    .filter(n => n.url && !existingUrls.has(n.url.toLowerCase()))
    .map(n => ({
      ...n,
      id: `news_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      savedAt: new Date().toISOString(),
    }));

  if (toAdd.length === 0) return 0;

  const combined = [...toAdd, ...existing].slice(0, 60); // Keep max 60 items
  await saveNews(combined);
  return toAdd.length;
}
