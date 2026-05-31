/**
 * Shared "Brew Again" entry — hydrates the flow store and positions it at
 * the right step. Used by the coffee library list, the coffee detail page
 * and the home Action Pill so the entry pattern lives in one place.
 *
 *   - online  → land on Step "context" (the AI generates a fresh recipe)
 *   - offline → seed a cached recipe and skip straight to Step "brew"
 *
 * Both call reset() first, so a stale in-flight draft never leaks in.
 */

import { useFlowStore } from "@/store/flowStore";
import type { CoffeeIdentity, BrewRecipe, RecommendationCandidate } from "@/lib/types/session";
import type { FieldZones } from "@/lib/field/types";
import type { BrewableRecipe } from "@/lib/storage/offlineLibrary";

export function startBrewAgain(identity: CoffeeIdentity, fieldZones: FieldZones | null): void {
  const s = useFlowStore.getState();
  s.reset();
  s.setCoffee(identity);
  s.setFieldZones(fieldZones);
  s.setMode("home");
  s.setSkipScan(true);
  s.setStep("context");
}

export function startBrewAgainOffline(
  identity: CoffeeIdentity,
  fieldZones: FieldZones | null,
  recipe: BrewableRecipe,
): void {
  const s = useFlowStore.getState();
  s.reset();
  s.setCoffee(identity);
  s.setFieldZones(fieldZones);
  s.setMode("home");
  s.setSkipScan(true);
  s.setRecommendation(recipe.recommendation);
  s.setBrew({ methodUsed: recipe.method });
  s.setStep("brew");
}

/**
 * Brew the EXACT recipe the home-screen chat just worked out — skip context +
 * recommend so it isn't re-generated into something different. The chat hands
 * over a complete recipe (often a one-off for the few grams left in a bag, not
 * worth saving to the library); we wrap it as a single-candidate recommendation
 * and jump straight to Step "brew". Mirrors startBrewAgainOffline.
 */
export function startBrewFromChat(
  identity: CoffeeIdentity,
  fieldZones: FieldZones | null,
  recipe: BrewRecipe,
  method: string,
  title?: string,
  basedOn?: string,
): void {
  const candidate: RecommendationCandidate = {
    method,
    recipe,
    role: "anchor",
    title: title ?? `${method} — from chat`,
    ...(basedOn ? { basedOn } : {}),
    whyChosen: "Worked out in the chat for this brew.",
    hypothesis: "",
    predictedCupProfile: "",
    primaryVariable: "",
    whatToObserve: "",
    confidence: "moderate",
    confidenceReason: "",
    learningValue: "",
  };
  const s = useFlowStore.getState();
  s.reset();
  s.setCoffee(identity);
  s.setFieldZones(fieldZones);
  s.setMode("home");
  s.setSkipScan(true);
  s.setRecommendation({
    candidates: [candidate],
    primaryMethod: method,
    primaryRecipe: recipe,
    reasoning: "From the chat.",
    generatedAt: new Date().toISOString(),
  });
  s.setBrew({ methodUsed: method, selectedCandidateIdx: 0 });
  s.setStep("brew");
}
