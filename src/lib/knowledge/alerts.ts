import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "@/lib/db/client";
import { coffeeAlerts } from "@/lib/db/schema";

export interface CoffeeAlert {
  id: string;
  roaster: string;
  coffeeName: string;
  origin: string;
  process?: string;
  score: number;
  summary: string;
  url?: string;
  alertedAt: string;
  read: boolean;
}

function rowToAlert(row: typeof coffeeAlerts.$inferSelect): CoffeeAlert {
  return { id: row.id, ...(row.data as Omit<CoffeeAlert, "id">) };
}

export async function getAlerts(limit?: number): Promise<CoffeeAlert[]> {
  try {
    const q = db.select().from(coffeeAlerts).orderBy(desc(coffeeAlerts.createdAt));
    const rows = limit ? await q.limit(limit) : await q;
    return rows.map(rowToAlert);
  } catch (err) {
    console.error("getAlerts: db error:", err);
    return [];
  }
}

export async function saveAlert(alert: Omit<CoffeeAlert, "id">): Promise<string> {
  const id = randomUUID();
  await db.insert(coffeeAlerts).values({ id, data: alert });
  return id;
}

export async function markRead(id: string): Promise<void> {
  const rows = await db.select().from(coffeeAlerts).where(eq(coffeeAlerts.id, id)).limit(1);
  const existing = rows[0];
  if (!existing) return;
  const data = { ...(existing.data as CoffeeAlert), read: true };
  await db.update(coffeeAlerts).set({ data }).where(eq(coffeeAlerts.id, id));
}
