import { useFlowStore, type FlowStep } from "@/store/flowStore";

const PARKABLE_STEPS: FlowStep[] = ["brew", "log", "summary"];

/**
 * PUTs the current draft to /api/pending-brews/<id> (migration 0025) under a
 * client-made id, so an unrated brew survives the next reset(). Idempotent:
 * the id is stored in the flow store before the request, a retry upserts the
 * same row, and a synced draft is not sent again.
 *
 * `requireTimer`: only park when the brew actually has a finished timer
 * (actualTimeSec) — used by the app-start rescue, where the draft may be a
 * half-set-up flow that never brewed.
 */
export function parkCurrentBrew(opts: { requireTimer?: boolean } = {}): Promise<void> {
  const s = useFlowStore.getState();
  if (s.draft.mode !== "home" || !s.draft.brew) return Promise.resolve();
  if (opts.requireTimer && typeof s.draft.brew.actualTimeSec !== "number") return Promise.resolve();
  if (!PARKABLE_STEPS.includes(s.step)) return Promise.resolve();

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
  if (useFlowStore.getState().pendingBrewSynced) return Promise.resolve();
  if (typeof navigator !== "undefined" && !navigator.onLine) return Promise.resolve();

  const parkedId = id;
  return fetch(`/api/pending-brews/${parkedId}`, {
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
}

let rescue: Promise<void> | null = null;

/**
 * App-start rescue, once per app session: a draft left behind with a finished
 * timer (the owner brewed, then closed the app or went Home without saving) is
 * parked before anything can reset() it. This is also what recovers a brew from
 * before the Log screen parked on open — as long as its draft is still on the
 * phone. Its brew time is unknown, so it is dated to the rescue. The Home card
 * awaits this so the rescued brew shows on the first open.
 */
export function rescueOrphanBrewOnce(): Promise<void> {
  if (!rescue) rescue = parkCurrentBrew({ requireTimer: true });
  return rescue;
}
