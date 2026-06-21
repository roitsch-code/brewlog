import type { CoffeeIdentity, SessionContext } from "@/lib/types/session";

/**
 * Builds the ordered status walk shown on the recipe-crafting screen.
 *
 * The recipe is ONE blocking Opus call with no streamed sub-steps, so a
 * truthful progress bar isn't available. Instead we narrate the **real factors
 * that go into building the two recipes for THIS bean** — the same inputs the
 * recommender weighs (origin / process / variety / roast / freshness / mood /
 * occasion / time / water / method → recipe selection → grind+temp → pours).
 * Each line uses the coffee's OWN stored value when present (never invents one
 * — see the no-fabrication Hard Rule); a missing/placeholder value falls back
 * to a generic phrasing. Only the sequential pacing is simulated.
 *
 * `CraftingStatus` cycles this list and holds on the final entry.
 */

/** A stored string we can actually show (not empty / placeholder).
 *
 * `draft.coffee` is a Partial populated by AI bag extraction, so a field can
 * arrive as a non-string at runtime even though the type says string. This used
 * to call `.trim()` unconditionally — a non-string value threw DURING RENDER
 * (buildCraftingPhases runs in a useMemo), which crashed the whole recipe step
 * to a black "client-side exception" on a fresh scan. Guard the type at runtime. */
function real(v?: unknown): v is string {
  if (typeof v !== "string") return false;
  const s = v.trim().toLowerCase();
  return s !== "" && s !== "unknown" && s !== "other" && s !== "n/a" && s !== "none";
}

const OCCASION_LABELS: Record<string, string> = {
  "morning-ritual": "morning ritual",
  focus: "focus session",
  social: "social pour",
  experiment: "experiment",
  "summer-time": "summer cup",
  "cold-brew": "cold brew",
};

const TIME_LABELS: Record<string, string> = {
  normal: "~5-minute window",
  special: "fast shot",
  "long-steep": "long cold steep",
  // legacy tokens from older sessions
  quick: "quick window",
  unhurried: "unhurried window",
};

const WATER_LABELS: Record<string, string> = {
  championship: "clarity-blend water",
  tap: "filtered water",
};

function freshnessPhrase(roastDate?: string): string | null {
  if (!real(roastDate)) return null;
  const t = Date.parse(roastDate);
  if (Number.isNaN(t)) return null;
  const days = Math.floor((Date.now() - t) / 86_400_000);
  if (days < 0) return null; // future-dated — skip rather than show nonsense
  if (days < 7) return "Accounting for a fresh bag";
  const weeks = Math.round(days / 7);
  return `Accounting for a ${weeks}-week-rested bag`;
}

export function buildCraftingPhases(
  coffee?: Partial<CoffeeIdentity> | null,
  context?: Partial<SessionContext> | null,
): string[] {
  const phases: string[] = [];

  // 1. Origin (+ region when known)
  if (real(coffee?.region) && real(coffee?.origin)) {
    phases.push(`Analyzing ${coffee.region}, ${coffee.origin}`);
  } else if (real(coffee?.origin)) {
    phases.push(`Analyzing the ${coffee.origin} origin`);
  } else {
    phases.push("Analyzing the bean's origin");
  }

  // 2. Process
  phases.push(real(coffee?.process) ? `Reading the ${coffee.process} process` : "Reading the process");

  // 3. Variety (only when known)
  if (real(coffee?.variety)) phases.push(`Balancing the ${coffee.variety} variety`);

  // 4. Roast
  if (real(coffee?.roastLevel)) phases.push(`Factoring the ${coffee.roastLevel} roast`);

  // 5. Freshness
  const fresh = freshnessPhrase(coffee?.roastDate ?? undefined);
  if (fresh) phases.push(fresh);

  // 6. Mood
  phases.push(real(context?.moodPreference) ? `Processing your ${context.moodPreference} mood` : "Processing your mood");

  // 7. Occasion (named ones only)
  const occ = real(context?.occasion) ? OCCASION_LABELS[context.occasion] : undefined;
  if (occ) phases.push(`Reading the ${occ}`);

  // 8. Time
  const time = real(context?.timeAvailable) ? TIME_LABELS[context.timeAvailable] : undefined;
  phases.push(time ? `Sizing the ${time}` : "Considering the time");

  // 9. Water (when chosen)
  const water = real(context?.waterSource) ? WATER_LABELS[context.waterSource] : undefined;
  if (water) phases.push(`Matching your ${water}`);

  // 10. Method
  phases.push(real(context?.preferredMethod) ? `Building it for your ${context.preferredMethod}` : "Evaluating the best brewing method");

  // 11–14. The build itself — real work the engine + Opus do, in order
  phases.push("Pulling the reference recipes");
  phases.push("Dialing grind and temperature");
  phases.push("Shaping the pour sequence");
  phases.push("Adapting it to your beans");

  return phases;
}
