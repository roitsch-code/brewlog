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
}
