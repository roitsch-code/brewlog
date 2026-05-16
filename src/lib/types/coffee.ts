import type { FieldZones } from "@/lib/field/types";

export interface Coffee {
  id: string;
  roaster: string;
  name: string;
  origin: string;
  process: string;
  firstSeenAt: string;
  sessionCount: number;
  sessionIds: string[];
  bestMethod?: string;
  avgRating?: number;
  ratingSum?: number;
  ratingCount?: number;
  bagPhotoUrl?: string;
  latestRoastDate?: string;
  writtenSummary?: string;
  lastSummarizedAt?: string;
  commonNotes?: string[];
  whatToExplore?: string;
  personalNotes?: string; // free-text notes written by the user
  /** Generative Field v1.1 composition for this coffee. `null` until
   * mapped from tasting notes; rendering falls back to Default in that
   * case. See specs/design-system-v1.1-generative-field.md §10. */
  fieldZones?: FieldZones | null;
  /** User-marked "currently in rotation" flag. Surfaced in the
   * /api/greeting library snapshot so the daily Haiku starter
   * prioritises rotation bags. */
  inRotation?: boolean;
}
