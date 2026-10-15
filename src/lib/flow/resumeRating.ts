import { useFlowStore } from "@/store/flowStore";
import { getPendingSessions } from "@/lib/storage/saveQueue";
import type { PendingBrewDetail, PendingBrewSummary } from "@/lib/types/pendingBrew";

/**
 * Loads a parked, unrated brew from /api/pending-brews/[id] and puts it back
 * on the Log screen. Returns false when it could not be loaded (offline, or
 * already rated elsewhere) — the caller stays where it is.
 */
export async function resumePendingBrew(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/pending-brews/${id}`, { cache: "no-store" });
    if (!res.ok) return false;
    const p = (await res.json()) as PendingBrewDetail;
    useFlowStore.getState().resumeForRating({
      id: p.id,
      brewedAt: p.createdAt,
      draft: p.draft,
      fieldZones: p.fieldZones,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * GET /api/pending-brews minus any brew already rated on this phone whose save
 * still sits in the offline queue — the server row is only dropped when that
 * save flushes, and without this filter the card would ask to rate it twice.
 */
export async function fetchPendingBrews(all = false): Promise<PendingBrewSummary[]> {
  const res = await fetch(`/api/pending-brews${all ? "?all=true" : ""}`, { cache: "no-store" });
  if (!res.ok) return [];
  const rows = (await res.json()) as PendingBrewSummary[];
  if (!Array.isArray(rows)) return [];
  let queued = new Set<string>();
  try {
    const q = await getPendingSessions();
    queued = new Set(
      q
        .map((p) => (p.body as { pendingBrewId?: unknown } | null)?.pendingBrewId)
        .filter((v): v is string => typeof v === "string"),
    );
  } catch {
    // IndexedDB unavailable — show the server list as is.
  }
  return rows.filter((r) => !queued.has(r.id));
}
