export type SessionMode = "home" | "external" | "match";
export type SessionType = "coffee" | "wine";

export interface CoffeeIdentity {
  roaster: string;
  name: string;
  origin: string;
  region?: string;
  variety?: string;
  process: string; // Natural | Washed | Honey | Anaerobic | Other
  fermentationStyle?: string; // e.g. "Spontaneous Anaerobic", "Starter-culture Natural", "Thermal-shock Washed"
  roastLevel: string; // Light | Medium-Light | Medium | Dark
  roastDate?: string; // ISO date string
  cuppingScore?: number; // SCA / Q-grade, e.g. 87.5
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
  waterSource?: string; // "tap" | "diluted" — tap = ~300ppm, diluted = 1:1 tap+distilled = ~150ppm
  preferredMethod?: string; // optional method lock-in: "V60 + Drip Assist" | "Orea Fast" | etc.
  dripAssist?: boolean; // Hario Drip Assist disc in use; orthogonal to preferredMethod — applies to any pour-over brewer
  intent?: string;
  // "explore" | "safest" | "high-clarity" | "sweetness-forward"
  // | "body-forward" | "educational" | "repeat-best" | "compare" | "troubleshoot"
}

export interface BrewRecipe {
  doseGrams: number;
  waterGrams: number;
  waterTempC: number;
  grindSize: string;
  targetTimeSec: number;
  pourSequence?: string;
}

export type CandidateRole =
  | "anchor"
  | "adjacent"
  | "contrast"
  | "sweetness-probe"
  | "clarity-probe"
  | "body-probe"
  | "wildcard";

export type CandidateConfidence = "high" | "moderate" | "low" | "exploratory";

export interface RecommendationCandidate {
  method: string;
  recipe: BrewRecipe;
  role: CandidateRole;
  title: string;
  whyChosen: string;
  hypothesis: string;
  predictedCupProfile: string;
  primaryVariable: string;
  whatToObserve: string;
  confidence: CandidateConfidence;
  confidenceReason: string;
  learningValue: string;
  brewingLesson?: string;
  // Deprecated — moved to post-brew adaptive feedback in brew-insight
  nextIfWeak?: string;
  nextIfBitter?: string;
  nextIfSour?: string;
}

export interface Recommendation {
  candidates: RecommendationCandidate[]; // 2–4 entries
  primaryMethod: string;                 // = candidates[0].method (backward compat)
  primaryRecipe: BrewRecipe;             // = candidates[0].recipe (backward compat)
  alternativeMethod?: string;            // = candidates[1]?.method (backward compat)
  alternativeRecipe?: BrewRecipe;        // = candidates[1]?.recipe (backward compat)
  reasoning: string;
  sessionObjective?: string;
  coffeeAssessment?: string;
  generatedAt: string; // ISO timestamp
}

export interface BrewLog {
  methodUsed?: string;
  doseGrams?: number;   // dose used (external sessions; home sessions use recommendation)
  waterGrams?: number;  // water used (external sessions; home sessions use recommendation)
  dripAssist?: boolean; // mirrors SessionContext.dripAssist — logs whether the Assist was actually used
  followedRecipe?: boolean;
  modifications?: string;
  actualTimeSec?: number;
  flow?: "too-fast" | "perfect" | "too-slow" | "na";
  timing?: "as-expected" | "faster" | "slower";
  grindSettingUsed?: string;         // actual grind used (pre-filled from recommendation)
  actualTempC?: number;              // actual temp used (pre-filled, editable)
  followedAgitation?: "yes" | "partially" | "no";
  agitationNote?: string;            // free text: what I actually did
}

export interface TasteResult {
  rating: number; // 1–5, half-star
  flavorNotes: string[];
  body: string; // light | medium | full
  acidity: string; // low | medium | high | bright
  freeNotes?: string;
  wouldBrewAgain?: boolean; // full combination: this coffee + roaster + recipe + occasion
  attribution?: "brew" | "bean" | "roaster"; // only set for low-rated sessions (≤3★)
  craft?: "off" | "solid" | "exceptional";   // execution quality, independent of taste
  fit?: "not-my-style" | "neutral" | "my-kind"; // style alignment, independent of craft
  roastQuality?: "poor" | "fine" | "exceptional"; // assessment of the raw material
  // Extended sensory fields (all optional — backward compatible)
  sweetness?: "low" | "medium" | "high";
  clarity?: "muddy" | "cloudy" | "clean" | "crystal";
  bitterness?: "none" | "pleasant" | "harsh";
  astringency?: "none" | "light" | "notable";
  finish?: "short" | "medium" | "long";
  balance?: "unbalanced" | "decent" | "harmonious";
  improvedWhileCooling?: boolean;
  matchedIntention?: boolean;
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
