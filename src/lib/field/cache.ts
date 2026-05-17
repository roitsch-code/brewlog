"use client";

import type { FieldZones } from "./types";

/**
 * Cross-page Field cache — bridges the visible flash between
 * /coffees/[id] (which owns the coffee record + its fieldZones) and
 * /brew/[id] (which only learns the coffeeId after its session fetch
 * resolves, so without a hint it falls back to the Default Field for
 * ~300ms until the coffee fetch lands).
 *
 * Stored in sessionStorage keyed by session id. CoffeeDetail
 * pre-warms entries for all its sessions when it loads; BrewDetail
 * reads synchronously on mount and applies the cached zones via
 * useFieldConfig immediately — by the time the coffee fetch returns,
 * the Field has already been painting in the cup's colours.
 *
 * sessionStorage chosen over a module-level Map so the cache survives
 * service-worker-backed back/forward navigation in the PWA (where the
 * JS heap can be reset). Cleared on tab close, which is fine — the
 * cache is purely a paint-priming hint, not a source of truth.
 */

const KEY_PREFIX = "brewlog.fieldZones.bySession.";

export function rememberSessionField(sessionId: string, zones: FieldZones | null | undefined): void {
  if (typeof window === "undefined") return;
  if (!sessionId || !zones) return;
  try {
    sessionStorage.setItem(KEY_PREFIX + sessionId, JSON.stringify(zones));
  } catch {
    // sessionStorage may be disabled or quota-exceeded — silent fail
    // is fine, the cache is a hint, not a contract.
  }
}

export function recallSessionField(sessionId: string | undefined | null): FieldZones | null {
  if (typeof window === "undefined") return null;
  if (!sessionId) return null;
  try {
    const raw = sessionStorage.getItem(KEY_PREFIX + sessionId);
    if (!raw) return null;
    return JSON.parse(raw) as FieldZones;
  } catch {
    return null;
  }
}
