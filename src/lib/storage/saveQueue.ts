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

export interface FlushResult {
  flushed: number;
  remaining: number;
  /** Reason the queue still has entries, for surfacing in the UI. */
  lastError?: string;
}

/** POST every queued session. Stops at the first failure (network or
 * non-2xx) and leaves the rest queued — a brew is never silently dropped,
 * so a stuck item stays visible and retryable rather than vanishing. */
export async function flushQueue(): Promise<FlushResult> {
  if (flushing) return { flushed: 0, remaining: await pendingCount() };
  flushing = true;
  let flushed = 0;
  let lastError: string | undefined;
  try {
    const pending = await getPendingSessions();
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
        } else {
          const text = await res.text().catch(() => "");
          lastError = `HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`;
          break;
        }
      } catch (e) {
        lastError = e instanceof Error ? e.message : "network error";
        break;
      }
    }
  } finally {
    flushing = false;
  }
  return { flushed, remaining: await pendingCount(), lastError };
}
