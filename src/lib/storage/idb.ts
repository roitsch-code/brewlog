/**
 * Minimal promise-based IndexedDB wrapper for the offline brew feature.
 *
 * One database, two object stores:
 *   - `brewable`        — cached coffees + their re-brewable recipes (offlineLibrary.ts)
 *   - `pendingSessions` — brew saves queued while offline (saveQueue.ts)
 *
 * No external dependency — the surface we need is tiny. All reads fail
 * soft (callers wrap in try/catch) because IndexedDB is unavailable in
 * SSR and can be blocked by private-mode quirks.
 */

const DB_NAME = "brewlog-offline";
const DB_VERSION = 1;

export const STORE_BREWABLE = "brewable";
export const STORE_QUEUE = "pendingSessions";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_BREWABLE)) {
          db.createObjectStore(STORE_BREWABLE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_QUEUE)) {
          db.createObjectStore(STORE_QUEUE, { keyPath: "clientId" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function request<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      }),
  );
}

export function idbGetAll<T>(store: string): Promise<T[]> {
  return request<T[]>(store, "readonly", (s) => s.getAll());
}

export function idbGet<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
  return request<T | undefined>(store, "readonly", (s) => s.get(key));
}

export function idbPut<T>(store: string, value: T): Promise<void> {
  return request<void>(store, "readwrite", (s) => s.put(value as unknown as Record<string, unknown>));
}

export function idbDelete(store: string, key: IDBValidKey): Promise<void> {
  return request<void>(store, "readwrite", (s) => s.delete(key));
}

/** Replace the entire contents of a store in a single transaction. */
export async function idbReplaceAll<T>(store: string, values: T[]): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
    const os = tx.objectStore(store);
    os.clear();
    for (const v of values) os.put(v as unknown as Record<string, unknown>);
  });
}
