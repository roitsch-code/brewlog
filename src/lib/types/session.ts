export type SessionMode = "home" | "external";
export type SessionType = "coffee" | "wine";

export interface CoffeeIdentity {
  roaster: string;
  name: string;
  origin: string;
  region?: string;
  variety?: string;
  process: string; // Natural | Washed | Honey | Anaerobic | Other
  roastLevel: string; // Light | Medium-Light | Medium | Dark
  roastDate?: string; // ISO date string
  bagPhotoUrl?: string;
  bagPhotoPath?: string;
  aiExtracted: boolean;
  tastingNotesFromBag?: string[];
  coffeeId?: string; // ref to coffees collection
}

export interface SessionContext {
  occasion: string; // morning-ritual | focus | experiment | after-dinner | social
  amount: string; // small | big | batch | custom | surprise
  customWaterMl?: number; // used when amount === "custom"
  timeAvailable: string; // quick | normal | unhurried
  moodPreference: string; // strong | balanced | light | sweet | curious
  grinder?: string; // e.g. "Niche Zero" | "Comandante C40" — determines ° vs clicks in recommendation
}

export interface BrewRecipe {
  doseGrams: number;
  waterGrams: number;
  waterTempC: number;
  grindSize: string;
  targetTimeSec: number;
  pourSequence?: string;
}

export interface Recommendation {
  primaryMethod: string;
  primaryRecipe: BrewRecipe;
  alternativeMethod?: string;
  alternativeRecipe?: BrewRecipe;
  reasoning: string;
  generatedAt: string; // ISO timestamp
}

export interface BrewLog {
  methodUsed?: string;
  followedRecipe?: boolean;
  modifications?: string;
  actualTimeSec?: number;
  flow?: "too-fast" | "perfect" | "too-slow" | "na";
  timing?: "as-expected" | "faster" | "slower";
}

export interface TasteResult {
  rating: number; // 1–5, half-star
  flavorNotes: string[];
  body: string; // light | medium | full
  acidity: string; // low | medium | high | bright
  freeNotes?: string;
  wouldUseMethodAgain: boolean;
}

export interface ExternalPlace {
  name: string;
  location?: string;
  methodServed?: string;
}

export interface Session {
  id: string;
  type: SessionType;
  mode: SessionMode;
  createdAt: string; // ISO timestamp
  coffee: CoffeeIdentity;
  place?: ExternalPlace; // external only
  context?: SessionContext; // home only
  recommendation?: Recommendation; // home only
  brew?: BrewLog;
  result?: TasteResult;
}

// Partial session used during the flow (before saving)
export type DraftSession = Partial<Omit<Session, "id" | "createdAt">> & {
  type: SessionType;
  mode: SessionMode;
};
