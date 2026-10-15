import type { DraftSession } from "@/lib/types/session";
import type { FieldZones } from "@/lib/field/types";

/** One row of GET /api/pending-brews — enough to render the Home card and the
 * /brew/unrated list without shipping every draft's recipe JSON. */
export interface PendingBrewSummary {
  id: string;
  createdAt: string;
  dismissedAt: string | null;
  coffeeName: string;
  roaster: string;
  method: string | null;
  bagPhotoUrl: string | null;
}

/** GET /api/pending-brews/[id] — the full draft, to resume the Log screen. */
export interface PendingBrewDetail {
  id: string;
  createdAt: string;
  dismissedAt: string | null;
  draft: DraftSession;
  fieldZones: FieldZones | null;
}
