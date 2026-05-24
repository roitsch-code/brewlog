/**
 * Offline save queue — when a brew is saved without a network, the POST
 * body is parked in IndexedDB and flushed to /api/sessions once the device
 * is back online (driven by an `online` listener in LightShell).
 *
 * Background Sync is intentionally NOT used — iOS Safari PWAs don't support
 * it reliably. A `flushing` guard coalesces concurrent flushes so a queued
 * save isn't POSTed twice.
 */

import { STORE_QUEUE, idbGetAll, idbPut, idbDelete } from "./idb";

export interface PendingSession {
  clientId: string;
  body: unknown; // exact /api/sessions POST body
  queuedAt: number;
}

function newClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function enqueueSession(body: unknown): Promise<void> {
  const entry: PendingSession = { clientId: newClientId(), body, queuedAt: Date.now() };
  await idbPut(STORE_QUEUE, entry);
}

export async function getPendingSessions(): Promise<PendingSession[]> {
  try {
    return await idbGetAll<PendingSession>(STORE_QUEUE);
  } catch {
    return [];
  }
}

export async function pendingCount(): Promise<number> {
  return (await getPendingSessions()).length;
}

let flushing = false;

/** POST every queued session. Returns how many were successfully flushed.
 * Leaves entries in the queue on network/5xx errors for a later retry;
 * drops entries the server rejects as invalid (4xx) so they can't wedge
 * the queue forever. */
export async function flushQueue(): Promise<number> {
  if (flushing) return 0;
  flushing = true;
  try {
    const pending = await getPendingSessions();
    let flushed = 0;
    for (const item of pending) {
      try {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.body),
        });
        if (res.ok) {
          await idbDelete(STORE_QUEUE, item.clientId);
          flushed++;
        } else if (res.status >= 400 && res.status < 500) {
          // Permanently rejected — drop it so the queue can drain.
          await idbDelete(STORE_QUEUE, item.clientId);
        }
        // 5xx: leave queued, try again next flush.
      } catch {
        // Network error — stop; we're likely offline again.
        break;
      }
    }
    return flushed;
  } finally {
    flushing = false;
  }
}
