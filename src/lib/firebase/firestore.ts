import { getFirestore, collection, doc, getDoc, getDocs, getDocFromServer, getDocsFromServer, addDoc, setDoc, updateDoc, deleteDoc, query, orderBy, limit, onSnapshot, Unsubscribe } from "firebase/firestore";
import app from "./config";
import type { Session } from "../types/session";
import type { Coffee } from "../types/coffee";
import type { UserPreferences } from "../types/preferences";

export const db = getFirestore(app, process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID || "brewlog-database");

// Sessions
export async function createSession(data: Omit<Session, "id">): Promise<string> {
  const ref = await addDoc(collection(db, "sessions"), data);
  return ref.id;
}

export async function getSession(id: string): Promise<Session | null> {
  const snap = await getDoc(doc(db, "sessions", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Session;
}

export async function updateSession(id: string, data: Partial<Session>): Promise<void> {
  await updateDoc(doc(db, "sessions", id), data as Record<string, unknown>);
}

export async function deleteSession(id: string): Promise<void> {
  await deleteDoc(doc(db, "sessions", id));
}

export async function getRecentSessions(count = 10): Promise<Session[]> {
  const q = query(collection(db, "sessions"), orderBy("createdAt", "desc"), limit(count));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Session));
}

export function subscribeToSessions(
  callback: (sessions: Session[]) => void,
  count = 20
): Unsubscribe {
  const q = query(collection(db, "sessions"), orderBy("createdAt", "desc"), limit(count));
  return onSnapshot(q, (snap) => {
    const sessions = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Session));
    callback(sessions);
  });
}

export async function getSessionsByIds(ids: string[]): Promise<Session[]> {
  if (ids.length === 0) return [];
  const results = await Promise.all(ids.map(id => getDocFromServer(doc(db, "sessions", id))));
  return results
    .filter(d => d.exists())
    .map(d => ({ id: d.id, ...d.data() } as Session))
    .sort((a, b) => {
      const ta = typeof a.createdAt === "string" ? a.createdAt : "";
      const tb = typeof b.createdAt === "string" ? b.createdAt : "";
      return tb.localeCompare(ta);
    });
}

// Coffees
export async function upsertCoffee(data: Omit<Coffee, "id">, id?: string): Promise<string> {
  if (id) {
    await setDoc(doc(db, "coffees", id), data, { merge: true });
    return id;
  }
  const ref = await addDoc(collection(db, "coffees"), data);
  return ref.id;
}

export async function getCoffees(): Promise<Coffee[]> {
  const snap = await getDocsFromServer(collection(db, "coffees"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Coffee));
}

// Preferences
export async function getPreferences(): Promise<UserPreferences | null> {
  const snap = await getDoc(doc(db, "preferences", "default"));
  if (!snap.exists()) return null;
  return snap.data() as UserPreferences;
}

export async function savePreferences(data: UserPreferences): Promise<void> {
  await setDoc(doc(db, "preferences", "default"), data);
}
