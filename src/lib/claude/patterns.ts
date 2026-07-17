import type { Session } from "../types/session";
import { resolveBrewedRecipe } from "../utils/resolveRecipe";

// ─── Output types ────────────────────────────────────────────────────────────

export interface OscillationPattern {
  parameter: string;   // "grindSize" | "waterTempC" | etc.
  coffee: string;
  direction: string;   // human-readable description of the drift
  sessionCount: number;
}

export interface ReturnPattern {
  entity: string;
  entityType: "roaster" | "origin";
  gapDays: number;
  recurringComplaints: string[]; // shared flavor complaints across separated visits
}

export interface RatingBehaviorMismatch {
  description: string;
  evidence: string;
}

export interface CraftFitDivergence {
  coffeeName: string;
  craft: string;
  fit: string;
  rating: number;
}

export interface OccasionPreference {
  coffee: string;
  occasionA: string;
  avgA: number;
  occasionB: string;
  avgB: number;
}

export interface ParameterCorrelation {
  parameter: string;
  value: string;
  avgRating: number;
  sampleSize: number;
}

export interface VocabularyDrift {
  risingDescriptors: string[];
  fallingDescriptors: string[];
}

export interface PatternAnalysis {
  sessionCount: number;
  hasEnoughData: boolean;
  oscillation: OscillationPattern[];
  returnPatterns: ReturnPattern[];
  ratingBehaviorMismatch: RatingBehaviorMismatch[];
  craftVsFitDivergence: CraftFitDivergence[];
  occasionDependentPreference: OccasionPreference[];
  parameterPreferenceCorrelation: ParameterCorrelation[];
  vocabularyDrift: VocabularyDrift;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function coffeeKey(s: Session): string {
  const name = s.coffee?.name?.trim() || "unknown";
  const roaster = s.coffee?.roaster?.trim() || "";
  return roaster ? `${name} (${roaster})` : name;
}

// ─── Individual pattern detectors ────────────────────────────────────────────

/**
 * Oscillation: grind or temp parameter drifting without converging across
 * multiple brews of the same coffee. Requires ≥4 sessions per coffee.
 */
function detectOscillation(sessions: Session[]): OscillationPattern[] {
  // Group sessions by coffee name+roaster
  const byCoffee: Record<string, Session[]> = {};
  for (const s of sessions) {
    const key = coffeeKey(s);
    byCoffee[key] = byCoffee[key] ?? [];
    byCoffee[key].push(s);
  }

  const results: OscillationPattern[] = [];

  for (const [coffee, group] of Object.entries(byCoffee)) {
    if (group.length < 4) continue;

    // Check grind oscillation (Niche° values — extract number)
    const grindValues = group
      .map(s => {
        // The grind the user ACTUALLY brewed (selected candidate), not the
        // primary — matching resolveBrewedRecipe everywhere else.
        const g = resolveBrewedRecipe(s).recipe?.grindSize as string | undefined;
        if (!g) return null;
        const match = g.match(/(\d+(?:\.\d+)?)/);
        return match ? parseFloat(match[1]) : null;
      })
      .filter((v): v is number => v !== null);

    if (grindValues.length >= 4) {
      // Count direction reversals
      let reversals = 0;
      for (let i = 1; i < grindValues.length - 1; i++) {
        const prev = grindValues[i] - grindValues[i - 1];
        const next = grindValues[i + 1] - grindValues[i];
        if (prev !== 0 && next !== 0 && Math.sign(prev) !== Math.sign(next)) {
          reversals++;
        }
      }
      if (reversals >= 2) {
        const min = Math.min(...grindValues);
        const max = Math.max(...grindValues);
        results.push({
          parameter: "grindSize",
          coffee,
          direction: `oscillating between ${min}° and ${max}° without settling (${reversals} direction reversals across ${grindValues.length} brews)`,
          sessionCount: grindValues.length,
        });
      }
    }
  }

  return results;
}

/**
 * Return patterns: a roaster or origin that was absent ≥30 days then returned,
 * where the same complaint flavor descriptors appear on both sides of the gap.
 */
function detectReturnPatterns(sessions: Session[]): ReturnPattern[] {
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const results: ReturnPattern[] = [];

  // Per roaster
  const byRoaster: Record<string, Session[]> = {};
  for (const s of sorted) {
    const r = s.coffee?.roaster?.trim();
    if (!r) continue;
    byRoaster[r] = byRoaster[r] ?? [];
    byRoaster[r].push(s);
  }

  for (const [roaster, group] of Object.entries(byRoaster)) {
    if (group.length < 2) continue;
    for (let i = 1; i < group.length; i++) {
      const gapMs =
        new Date(group[i].createdAt).getTime() -
        new Date(group[i - 1].createdAt).getTime();
      const gapDays = gapMs / 86_400_000;
      if (gapDays >= 30) {
        const prevNotes = group[i - 1].result?.flavorNotes ?? [];
        const currNotes = group[i].result?.flavorNotes ?? [];
        const shared = prevNotes.filter(n => currNotes.includes(n));
        if (shared.length >= 1) {
          results.push({
            entity: roaster,
            entityType: "roaster",
            gapDays: Math.round(gapDays),
            recurringComplaints: shared,
          });
        }
        break; // one gap per roaster is enough
      }
    }
  }

  return results;
}

/**
 * Rating-behavior mismatch: highly-rated sessions where wouldBrewAgain is false,
 * or low-rated sessions appearing repeatedly (same coffee rated ≤3 multiple times).
 * Requires ≥2 evidence sessions per case.
 */
function detectRatingBehaviorMismatch(sessions: Session[]): RatingBehaviorMismatch[] {
  const results: RatingBehaviorMismatch[] = [];

  // High stars but explicitly would not brew again
  type ResultCompat = { wouldBrewAgain?: boolean; wouldUseMethodAgain?: boolean };
  const highButNo = sessions.filter(s => {
    const r = s.result?.rating ?? 0;
    const rc = s.result as (typeof s.result & ResultCompat) | undefined;
    const wouldAgain = rc?.wouldBrewAgain ?? rc?.wouldUseMethodAgain;
    return r >= 4 && wouldAgain === false;
  });
  if (highButNo.length >= 1) {
    const names = Array.from(new Set(highButNo.map(s => coffeeKey(s)))).join(", ");
    results.push({
      description: "high-rated sessions where you said you would not brew again",
      evidence: `${highButNo.length} session${highButNo.length > 1 ? "s" : ""}: ${names}`,
    });
  }

  // Same coffee rated low repeatedly
  const byCoffee: Record<string, number[]> = {};
  for (const s of sessions) {
    const key = coffeeKey(s);
    const r = s.result?.rating;
    if (r != null && r <= 3) {
      byCoffee[key] = byCoffee[key] ?? [];
      byCoffee[key].push(r);
    }
  }
  for (const [coffee, ratings] of Object.entries(byCoffee)) {
    if (ratings.length >= 2) {
      results.push({
        description: `${coffee} rated low repeatedly`,
        evidence: `${ratings.length} sessions averaging ${avg(ratings).toFixed(1)}★`,
      });
    }
  }

  return results;
}

/**
 * Craft-vs-fit divergence: sessions where execution quality (craft) and
 * style alignment (fit) point in opposite directions.
 */
function detectCraftVsFitDivergence(sessions: Session[]): CraftFitDivergence[] {
  return sessions
    .filter(s => {
      const { craft, fit } = s.result ?? {};
      return (
        (craft === "exceptional" && fit === "not-my-style") ||
        (craft === "off" && fit === "my-kind")
      );
    })
    .map(s => ({
      coffeeName: coffeeKey(s),
      craft: s.result!.craft!,
      fit: s.result!.fit!,
      rating: s.result!.rating,
    }));
}

/**
 * Occasion-dependent preference: same coffee scoring materially differently
 * across different occasion types. Requires ≥2 sessions per occasion per coffee.
 */
function detectOccasionPreference(sessions: Session[]): OccasionPreference[] {
  // Group by coffee × occasion
  const acc: Record<string, Record<string, number[]>> = {};
  for (const s of sessions) {
    const key = coffeeKey(s);
    const occ = s.context?.occasion;
    const r = s.result?.rating;
    if (!occ || r == null) continue;
    acc[key] = acc[key] ?? {};
    acc[key][occ] = acc[key][occ] ?? [];
    acc[key][occ].push(r);
  }

  const results: OccasionPreference[] = [];
  for (const [coffee, occasions] of Object.entries(acc)) {
    const pairs = Object.entries(occasions).filter(([, rs]) => rs.length >= 2);
    if (pairs.length < 2) continue;
    // Find the pair with the largest average gap
    let maxGap = 0;
    let bestPair: OccasionPreference | null = null;
    for (let i = 0; i < pairs.length; i++) {
      for (let j = i + 1; j < pairs.length; j++) {
        const [occA, rsA] = pairs[i];
        const [occB, rsB] = pairs[j];
        const gap = Math.abs(avg(rsA) - avg(rsB));
        if (gap > maxGap && gap >= 0.5) {
          maxGap = gap;
          bestPair = {
            coffee,
            occasionA: occA,
            avgA: parseFloat(avg(rsA).toFixed(1)),
            occasionB: occB,
            avgB: parseFloat(avg(rsB).toFixed(1)),
          };
        }
      }
    }
    if (bestPair) results.push(bestPair);
  }

  return results;
}

/**
 * Parameter-preference correlation: which sensory attributes (body, acidity, etc.)
 * correlate with the highest ratings. Requires ≥3 sessions per attribute value.
 */
function detectParameterCorrelations(sessions: Session[]): ParameterCorrelation[] {
  const acc: Record<string, number[]> = {};

  for (const s of sessions) {
    const r = s.result;
    if (!r?.rating) continue;
    const fields: Array<[string, string | undefined]> = [
      ["body", r.body],
      ["acidity", r.acidity],
      ["clarity", r.clarity],
      ["sweetness", r.sweetness],
      ["bitterness", r.bitterness],
      ["finish", r.finish],
    ];
    for (const [param, val] of fields) {
      if (!val) continue;
      const key = `${param}:${val}`;
      acc[key] = acc[key] ?? [];
      acc[key].push(r.rating);
    }
  }

  return Object.entries(acc)
    .filter(([, ratings]) => ratings.length >= 3)
    .map(([key, ratings]) => {
      const [parameter, value] = key.split(":");
      return {
        parameter,
        value,
        avgRating: parseFloat(avg(ratings).toFixed(1)),
        sampleSize: ratings.length,
      };
    })
    .sort((a, b) => b.avgRating - a.avgRating);
}

/**
 * Vocabulary drift: flavor descriptors appearing significantly more or less
 * in the most recent half of the log vs the earlier half.
 */
function detectVocabularyDrift(sessions: Session[]): VocabularyDrift {
  if (sessions.length < 6) return { risingDescriptors: [], fallingDescriptors: [] };

  const sorted = [...sessions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const half = Math.floor(sorted.length / 2);
  const early = sorted.slice(0, half);
  const recent = sorted.slice(half);

  const freq = (group: Session[]): Record<string, number> => {
    const counts: Record<string, number> = {};
    for (const s of group) {
      for (const note of s.result?.flavorNotes ?? []) {
        counts[note] = (counts[note] ?? 0) + 1;
      }
    }
    // Normalise by group size
    for (const k of Object.keys(counts)) counts[k] /= group.length;
    return counts;
  };

  const earlyFreq = freq(early);
  const recentFreq = freq(recent);
  const allWords = Array.from(new Set([...Object.keys(earlyFreq), ...Object.keys(recentFreq)]));

  const rising: string[] = [];
  const falling: string[] = [];

  for (const word of allWords) {
    const e = earlyFreq[word] ?? 0;
    const r = recentFreq[word] ?? 0;
    const delta = r - e;
    if (delta >= 0.4 && r >= 0.3) rising.push(word);
    else if (delta <= -0.4 && e >= 0.3) falling.push(word);
  }

  return { risingDescriptors: rising, fallingDescriptors: falling };
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function detectPatterns(sessions: Session[]): PatternAnalysis {
  return {
    sessionCount: sessions.length,
    hasEnoughData: sessions.length >= 5,
    oscillation: detectOscillation(sessions),
    returnPatterns: detectReturnPatterns(sessions),
    ratingBehaviorMismatch: detectRatingBehaviorMismatch(sessions),
    craftVsFitDivergence: detectCraftVsFitDivergence(sessions),
    occasionDependentPreference: detectOccasionPreference(sessions),
    parameterPreferenceCorrelation: detectParameterCorrelations(sessions),
    vocabularyDrift: detectVocabularyDrift(sessions),
  };
}
