import type { Session } from "../types/session";
import { resolveBrewedRecipe } from "../utils/resolveRecipe";

// ─── Output type ─────────────────────────────────────────────────────────────

export interface BrewSignature {
  sessionId: string;
  coffeeKey: string;          // "Name (Roaster)"
  coffeeTypeCluster: string;  // "east-africa-natural-v60"
  originRegion: string;
  process: string;            // washed | natural | honey | anaerobic | other
  method: string;             // v60-drip-assist | v60 | orea | clever | kalita | aeropress | chemex | moccamaster | other
  grindSetting: string;       // raw string (actual used)
  grindNumeric: number | null;
  waterPpm: number;           // BWT-filtered daily=220, diluted(legacy)=150, clarity blend=73
  tempC: number | null;       // actual temp
  ratio: number | null;       // dose / water
  freshnessZone: string;      // too-fresh | peak | past-peak | stale | unknown
  agitationProfile: string;   // followed | partially | skipped | unknown
  occasion: string;
  craft: string;              // off | solid | exceptional | unknown
  fit: string;                // not-my-style | neutral | my-kind | unknown
  roastQuality: string;       // poor | fine | exceptional | unknown
  ratingWeight: number;       // adjusted for craft + fit (not raw)
  rawRating: number;
  sensoryProfile: string[];
  flowOutcome: string;        // too-fast | perfect | too-slow | na | unknown
  wouldBrewAgain?: boolean;
  freeNotes?: string;
  agitationNote?: string;
}

// ─── Classification helpers ───────────────────────────────────────────────────

const EAST_AFRICA = ["ethiopia", "kenya", "rwanda", "burundi", "tanzania", "uganda", "malawi", "yirgacheffe", "sidama"];
const CENTRAL_AMERICA = ["guatemala", "costa rica", "honduras", "el salvador", "mexico", "nicaragua", "panama"];
const SOUTH_AMERICA = ["colombia", "brazil", "peru", "bolivia", "ecuador"];
const INDONESIA = ["indonesia", "sumatra", "java", "sulawesi", "bali", "flores", "timor"];

function classifyOriginRegion(origin: string): string {
  const o = (origin || "").toLowerCase();
  if (EAST_AFRICA.some(r => o.includes(r))) return "east-africa";
  if (CENTRAL_AMERICA.some(r => o.includes(r))) return "central-america";
  if (SOUTH_AMERICA.some(r => o.includes(r))) return "south-america";
  if (INDONESIA.some(r => o.includes(r))) return "indonesia";
  return "other";
}

function normalizeProcess(process: string): string {
  const p = (process || "").toLowerCase();
  if (p.includes("washed") || p.includes("wet")) return "washed";
  if (p.includes("natural") || p.includes("dry")) return "natural";
  if (p.includes("honey")) return "honey";
  if (p.includes("anaerobic")) return "anaerobic";
  return "other";
}

function normalizeMethod(method: string): string {
  const m = (method || "").toLowerCase();
  if (m.includes("drip assist")) return "v60-drip-assist";
  if (m.includes("v60")) return "v60";
  if (m.includes("orea")) return "orea";
  if (m.includes("clever")) return "clever";
  if (m.includes("kalita")) return "kalita";
  if (m.includes("aeropress")) return "aeropress";
  if (m.includes("chemex")) return "chemex";
  if (m.includes("moccamaster")) return "moccamaster";
  return "other";
}

function classifyFreshnessZone(roastDate?: string): string {
  if (!roastDate) return "unknown";
  const days = Math.floor((Date.now() - new Date(roastDate).getTime()) / 86_400_000);
  if (days < 5) return "too-fresh";
  if (days <= 21) return "peak";
  if (days <= 34) return "past-peak";
  return "stale";
}

function extractGrindNumeric(grindSetting: string): number | null {
  const match = (grindSetting || "").match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

function computeRatingWeight(rawRating: number, craft?: string, fit?: string): number {
  let weight = rawRating;
  if (craft === "exceptional") weight += 0.3;
  if (craft === "off") weight -= 0.5;
  if (fit === "my-kind") weight += 0.2;
  if (fit === "not-my-style") weight -= 0.2;
  return Math.min(5, Math.max(1, weight));
}

function waterPpmFromSource(source?: string): number {
  if (source === "championship") return 73; // 1:2 BWT-filtered + distilled clarity blend
  if (source === "diluted") return 150;     // legacy value
  return 220; // BWT-filtered daily water
}

// ─── Main builders ────────────────────────────────────────────────────────────

export function buildSignature(session: Session): BrewSignature | null {
  const rating = session.result?.rating;
  if (rating == null) return null;

  const method = session.brew?.methodUsed ?? session.recommendation?.primaryMethod ?? "";
  const process = session.coffee?.process ?? "";
  const origin = session.coffee?.origin ?? "";

  // A blend has no single growing region — bucketing it by its first-listed
  // origin keyword would mis-file it with single-origins (a Brazil/Ethiopia
  // blend read as pure "east-africa"). Give blends their own region bucket so
  // pattern detection keeps them distinct.
  const isBlendCoffee = (session.coffee?.components?.length ?? 0) >= 2;
  const originRegion = isBlendCoffee ? "blend" : classifyOriginRegion(origin);
  const normalizedProcess = normalizeProcess(process);
  const normalizedMethod = normalizeMethod(method);

  // Actual grind used takes precedence over recommended
  type BrewCompat = typeof session.brew & { grindSettingUsed?: string; actualTempC?: number; followedAgitation?: string; agitationNote?: string };
  const brew = session.brew as BrewCompat | undefined;
  // Read the recipe the user actually brewed (selected candidate), not primary.
  const recipe = resolveBrewedRecipe(session).recipe;
  const grindSetting = brew?.grindSettingUsed ?? recipe?.grindSize ?? "";

  const waterPpm = waterPpmFromSource(session.context?.waterSource);
  const tempC = brew?.actualTempC ?? recipe?.waterTempC ?? null;
  const ratio = recipe ? recipe.doseGrams / recipe.waterGrams : null;

  const coffeeKey = [session.coffee?.name, session.coffee?.roaster]
    .filter(Boolean)
    .join(" (") + (session.coffee?.roaster ? ")" : "");

  type ResultCompat = typeof session.result & { roastQuality?: string; wouldBrewAgain?: boolean; wouldUseMethodAgain?: boolean };
  const result = session.result as ResultCompat | undefined;

  const wouldBrewAgain = result?.wouldBrewAgain ?? result?.wouldUseMethodAgain;

  return {
    sessionId: session.id,
    coffeeKey,
    coffeeTypeCluster: `${originRegion}-${normalizedProcess}`,
    originRegion,
    process: normalizedProcess,
    method: normalizedMethod,
    grindSetting,
    grindNumeric: extractGrindNumeric(grindSetting),
    waterPpm,
    tempC,
    ratio,
    freshnessZone: classifyFreshnessZone(session.coffee?.roastDate),
    agitationProfile: brew?.followedAgitation ?? "unknown",
    occasion: session.context?.occasion ?? "unknown",
    craft: session.result?.craft ?? "unknown",
    fit: session.result?.fit ?? "unknown",
    roastQuality: result?.roastQuality ?? "unknown",
    ratingWeight: computeRatingWeight(rating, session.result?.craft, session.result?.fit),
    rawRating: rating,
    sensoryProfile: session.result?.flavorNotes ?? [],
    flowOutcome: session.brew?.flow ?? "unknown",
    ...(wouldBrewAgain != null ? { wouldBrewAgain } : {}),
    ...(session.result?.freeNotes ? { freeNotes: session.result.freeNotes } : {}),
    ...(brew?.agitationNote ? { agitationNote: brew.agitationNote } : {}),
  };
}

export function buildSignatures(sessions: Session[]): BrewSignature[] {
  return sessions.flatMap(s => {
    const sig = buildSignature(s);
    return sig ? [sig] : [];
  });
}
