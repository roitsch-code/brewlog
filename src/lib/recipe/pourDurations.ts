/**
 * Pour TIMES are the app's job, not the model's.
 *
 * Until Oct 2026 the model authored a `durationSec` for every pour and the
 * timer trusted it whenever it read as 2–8 g/s. That is how a 55 g bloom came
 * out as "10 s" (5.5 g/s): the swirl card arrived while the owner was still
 * pouring, and the coach — grading the opening surge — said "Slower" in the
 * same breath (Vanilla Gorilla, Origami wave, 2 Oct 2026). His own scale curve
 * for that brew shows him pouring at 3.5–4.4 g/s throughout.
 *
 * So the rule is:
 *  - the model supplies GRAMS and CADENCE (which pours, the rests between them);
 *  - when the candidate is based on a VERIFIED corpus recipe whose pour plan has
 *    the same number of pours, the reference's own published pour times, scaled
 *    to this batch (scaleRecipe), are used — we do not falsify recipes;
 *  - otherwise every pour gets the house time (housePourSec: the owner's
 *    measured ~4 g/s in whole 5-second steps).
 *
 * The cadence the model wrote is kept: a pour that gets longer borrows the
 * difference from the rest that follows it, a pour that gets shorter gives it
 * back, so the NEXT pour still starts when the recipe said it would.
 */
import { resolveReference } from "@/lib/claude/recipeFidelity";
import { scaleRecipe } from "@/lib/recipe/scaleRecipe";
import type { BrewPourStep, BrewRecipe } from "@/lib/types/session";
import { hasImmersionShape, housePourSec } from "@/lib/utils/pourSequence";

const isWater = (s: BrewPourStep) => typeof s.waterGramsAtEnd === "number";

export interface PourDurationResult {
  recipe: BrewRecipe;
  /** Where the pour times came from. "none" = out of scope, left untouched. */
  source: "reference" | "house" | "none";
  changes: string[];
}

/** The scaled pour times of a verified reference, when they map 1:1 onto this
 * recipe's pours. Null when there is no such reference. */
function referencePourTimes(
  recipe: BrewRecipe,
  basedOn: string | undefined,
  method: string | undefined,
  waterSteps: number,
): { times: number[]; name: string } | null {
  const ref = resolveReference(basedOn);
  if (!ref || !ref.verified) return null;
  const scaled = scaleRecipe(ref, recipe.waterGrams, { method });
  if (!scaled || scaled.shape !== "percolation") return null;
  const times = scaled.pourSteps
    .filter(isWater)
    .map((s) => s.durationSec)
    .filter((d): d is number => typeof d === "number" && d > 0);
  if (times.length !== waterSteps) return null;
  return { times, name: ref.shortName || ref.name };
}

export function applyPourDurations(
  recipe: BrewRecipe,
  ctx: { basedOn?: string; method?: string } = {},
): PourDurationResult {
  const steps = recipe.pourSteps;
  if (!Array.isArray(steps) || steps.length === 0) return { recipe, source: "none", changes: [] };
  if (!(recipe.targetTimeSec > 0) || recipe.targetTimeSec >= 3600) {
    return { recipe, source: "none", changes: [] };
  }
  // Immersion: the authored steps are the steep. Filling a Clever isn't pouring
  // onto a bed, and its durations sum to the clock — leave them.
  if (hasImmersionShape(recipe)) return { recipe, source: "none", changes: [] };

  const waterIdx = steps.map((s, i) => (isWater(s) ? i : -1)).filter((i) => i >= 0);
  if (waterIdx.length < 2) return { recipe, source: "none", changes: [] };

  const ref = referencePourTimes(recipe, ctx.basedOn, ctx.method, waterIdx.length);
  const out: BrewPourStep[] = steps.map((s) => ({ ...s }));
  const changes: string[] = [];

  let prevGrams = 0;
  waterIdx.forEach((idx, n) => {
    const s = out[idx];
    const grams = Math.max(0, (s.waterGramsAtEnd as number) - prevGrams);
    prevGrams = s.waterGramsAtEnd as number;
    const next = ref ? ref.times[n] : housePourSec(grams);
    const old = typeof s.durationSec === "number" && s.durationSec > 0 ? s.durationSec : undefined;
    if (old === next) return;
    s.durationSec = next;
    changes.push(
      `"${s.label}" ${grams}g: ${old ?? "?"}s → ${next}s (${ref ? `${ref.name}, scaled` : "house pour time"})`,
    );
    // Keep the cadence: the first rest before the next pour absorbs the change.
    if (old === undefined || n === waterIdx.length - 1) return;
    for (let j = idx + 1; j < waterIdx[n + 1]; j++) {
      if (out[j].action !== "wait") continue;
      const before = out[j].durationSec ?? 0;
      out[j].durationSec = Math.max(0, before + (old - next));
      break;
    }
  });

  if (changes.length === 0) {
    return { recipe, source: ref ? "reference" : "house", changes };
  }
  return { recipe: { ...recipe, pourSteps: out }, source: ref ? "reference" : "house", changes };
}
