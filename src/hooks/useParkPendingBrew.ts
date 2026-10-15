"use client";

import { useEffect } from "react";
import { useFlowStore } from "@/store/flowStore";
import { useOnline } from "@/hooks/useOnline";

/**
 * Parks the brew server-side the moment the Log screen opens (migration 0025).
 *
 * Before this, a finished brew existed only in the single localStorage draft
 * until the Summary's Save — and the next New Session / Brew Again / widget
 * entry called reset() and erased it. Now the draft is PUT to
 * /api/pending-brews/<id> under a client-made id (idempotent upsert), the Home
 * card lists it until it is rated, and the Summary save sends the id so the
 * server drops the row.
 *
 * Home brews only: a café visit is logged on the spot and has no timer data to
 * lose. Offline → nothing is sent; the effect retries when the phone is back
 * online while the Log screen is still open (the local draft still holds the
 * brew meanwhile, exactly as before).
 */
export function useParkPendingBrew(): void {
  const online = useOnline();

  useEffect(() => {
    const s = useFlowStore.getState();
    if (s.draft.mode !== "home" || !s.draft.brew) return;

    let id = s.pendingBrewId;
    let brewedAt = s.brewedAt;
    if (!id || !brewedAt) {
      id =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      brewedAt = new Date().toISOString();
      s.setPendingBrew(id, brewedAt);
    }
    if (useFlowStore.getState().pendingBrewSynced || !online) return;

    const parkedId = id;
    fetch(`/api/pending-brews/${parkedId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ createdAt: brewedAt, draft: s.draft, fieldZones: s.fieldZones }),
    })
      .then((r) => {
        // Only mark synced if the store still points at this brew.
        if (r.ok && useFlowStore.getState().pendingBrewId === parkedId) {
          useFlowStore.getState().setPendingBrewSynced(true);
        }
      })
      .catch(() => {});
  }, [online]);
}
