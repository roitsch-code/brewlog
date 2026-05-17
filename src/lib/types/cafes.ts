export interface CafeSummary {
  name: string;
  location?: string;
  visits: number;
  avgRating: number | null;
  coffees: string[];
  lastVisitedMs: number;
}

export interface Place {
  id: number;
  name: string;
  address: string | null;
  city: string;
  lat: number | null;
  lng: number | null;
}

// Visit-only café record without an attached brew session. Rating is
// binary: did the user enjoy being there enough to return.
export type CafeVisitRating = "come-back" | "wont-return";

export interface CafeVisit {
  id: string;
  cafeName: string;
  location?: string;
  rating: CafeVisitRating;
  notes?: string;
  visitedAt: string;       // ISO timestamp
  visitedAtMs: number;
}
