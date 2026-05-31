export type SessionMode = "home" | "external";
export type SessionType = "coffee" | "wine";

export interface CoffeeIdentity {
  roaster: string;
  name: string;
  origin: string;
  region?: string;
  farm?: string; // specific farm / estate, e.g. "Fazenda Passeio"
  variety?: string;
  process: string; // Natural | Washed | Honey | Anaerobic | Other
  fermentationStyle?: string; // e.g. "Spontaneous Anaerobic", "Starter-culture Natural", "Thermal-shock Washed"
  roastLevel: string; // Light | Medium-Light | Medium | Dark
  roastDate?: string; // ISO date string
  altitudeMeters?: number; // grow elevation in metres above sea level
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
  waterSource?: string; // "tap" = BWT-filtered daily ~220ppm | "championship" = 1:2 filtered+distilled clarity blend ~73ppm
  preferredMethod?: string; // optional method lock-in: "V60" | "Orea Fast" | etc.
  /** @deprecated Drip Assist support was removed; legacy sessions still reference this. Do not surface in current UI / prompts. */
  dripAssist?: boolean;
  intent?: string;
  // "explore" | "safest" | "high-clarity" | "sweetness-forward"
  // | "body-forward" | "educational" | "repeat-best" | "compare" | "troubleshoot"
}

/** Step kinds a brew guide can render. Percolation uses bloom/pour/final;
 * immersion / AeroPress / staged routines add steep (`wait`), agitation, and
 * the inverted-AeroPress handling (`invert` → `flip`/`press`) plus `bypass`
 * dilution. Self-contained here so saved sessions never import the knowledge
 * layer. Mirrors `PourAction` in src/lib/knowledge/recipes/types.ts. */
export type BrewStepAction =
  | "bloom"
  | "pour"
  | "final"
  | "stir"
  | "swirl"
  | "wait"
  | "press"
  | "invert"
  | "flip"
  | "drain"
  | "bypass"
  | "melodrip"
  | "agitate-bed";

/** One structured step of a recipe's pour/brew sequence. Preferred over the
 * legacy `pourSequence` string: it carries the per-step temperature and note
 * the timer shows, and lets immersion methods advance step-by-step. */
export interface BrewPourStep {
  label: string;
  action: BrewStepAction;
  /** Cumulative water in the brewer after this step (grams), when known. */
  waterGramsAtEnd?: number;
  /** Duration of this step in seconds (authored). */
  durationSec?: number;
  /** Per-step temperature override for staged-temperature recipes. */
  temperatureC?: number;
  /** Short, step-relevant hint (technique, agitation, what to watch). */
  notes?: string;
}

export interface BrewRecipe {
  doseGrams: number;
  waterGrams: number;
  /** Iced brews only — grams of ice the hot brew drains onto. The final
   * drink volume ≈ waterGrams + iceGrams. Undefined for hot brews. */
  iceGrams?: number;
  waterTempC: number;
  grindSize: string;
  targetTimeSec: number;
  /** Legacy cumulative-grams ("50 – 180 – 320") / prose string. Kept for old
   * saved sessions and as a fallback when `pourSteps` is absent. */
  pourSequence?: string;
  /** Structured, per-step sequence — preferred source for the brew timer. */
  pourSteps?: BrewPourStep[];
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
  /** The AI's per-brew descriptive name for this candidate. */
  title: string;
  /** Stable reference recipe this candidate adapts (e.g. "Kasuya 4:6"), or
   * "Own recipe" when it isn't based on a documented one. Populated by the
   * recommend model; shown on the brew screen and known to the chat. */
  basedOn?: string;
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
  /**
   * Index of the chosen recommendation candidate (0 = anchor, 1 = alternative,
   * …). Set when the user taps "Brew with X" on the recommend screen. The brew/
   * log/summary screens read the recipe by THIS index, not by method name — two
   * candidates can share a method (e.g. both V60), and matching by name would
   * always resolve to the first one. Legacy sessions without it fall back to
   * method-name matching, then primaryRecipe.
   */
  selectedCandidateIdx?: number;
  doseGrams?: number;   // dose used (external sessions; home sessions use recommendation)
  waterGrams?: number;  // water used (external sessions; home sessions use recommendation)
  /** @deprecated Drip Assist support was removed; legacy sessions still reference this. */
  dripAssist?: boolean;
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
