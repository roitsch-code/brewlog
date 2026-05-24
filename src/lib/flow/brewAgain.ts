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
import type { CoffeeIdentity } from "@/lib/types/session";
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
