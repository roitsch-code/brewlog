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
}
