export interface CafeSummary {
  name: string;
  location?: string;
  visits: number;
  avgRating: number | null;
  coffees: string[];
  lastVisitedMs: number;
}
