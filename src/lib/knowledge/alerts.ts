import { getAdminDb } from "@/lib/firebase/admin";

const COLLECTION = "coffeeAlerts";

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

export async function getAlerts(limit?: number): Promise<CoffeeAlert[]> {
  try {
    const db = getAdminDb();
    let query = db
      .collection(COLLECTION)
      .orderBy("alertedAt", "desc") as FirebaseFirestore.Query;
    if (limit) {
      query = query.limit(limit);
    }
    const snap = await query.get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as CoffeeAlert));
  } catch (err) {
    console.error("getAlerts: Firestore error:", err);
    return [];
  }
}

export async function saveAlert(
  alert: Omit<CoffeeAlert, "id">
): Promise<string> {
  const db = getAdminDb();
  const ref = await db.collection(COLLECTION).add(alert);
  return ref.id;
}

export async function markRead(id: string): Promise<void> {
  const db = getAdminDb();
  await db.collection(COLLECTION).doc(id).update({ read: true });
}
