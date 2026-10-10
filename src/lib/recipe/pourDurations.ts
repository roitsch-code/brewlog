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
 * The PAUSES the recipe wrote are kept (owner decision, 2026-10-10): a pour
 * that gets longer at the owner's pace pushes the next pour later — it never
 * eats the rest after it. Until then the rest absorbed the difference, clamped
 * at zero: Hoffmann's "10 s pour, 10 s pause" became a 20 s pour with NO
 * pause, and three pulses merged into one continuous pour (the SEY V60 of
 * 10-10 lost its 35 s bloom rest to a 10 s one the same way). A pour that
 * gets SHORTER still hands the spare seconds to the rest, so the next pour
 * starts where the recipe put it.
 */
import { referenceAppliesAtBatch, resolveReference } from "@/lib/claude/recipeFidelity";
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
  // A reference's own pour times are only its own within ±20 % of its
  // published water (REFERENCE_BATCH_WINDOW); beyond that the pace is the owner's.
  if (!referenceAppliesAtBatch(ref, recipe.waterGrams)) return null;
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
  ctx: { basedOn?: string; method?: string; pourRateGPS?: number } = {},
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
    const next = ref ? ref.times[n] : housePourSec(grams, ctx.pourRateGPS);
    const old = typeof s.durationSec === "number" && s.durationSec > 0 ? s.durationSec : undefined;
    if (old === next) return;
    s.durationSec = next;
    changes.push(
      `"${s.label}" ${grams}g: ${old ?? "?"}s → ${next}s (${ref ? `${ref.name}, scaled` : "house pour time"})`,
    );
    // A shorter pour gives its spare seconds to the first rest before the
    // next pour (the next pour starts where the recipe put it). A LONGER pour
    // never takes them back: the rest keeps its authored length and the next
    // pour starts later.
    if (old === undefined || n === waterIdx.length - 1 || old <= next) return;
    for (let j = idx + 1; j < waterIdx[n + 1]; j++) {
      if (out[j].action !== "wait") continue;
      out[j].durationSec = (out[j].durationSec ?? 0) + (old - next);
      break;
    }
  });

  if (changes.length === 0) {
    return { recipe, source: ref ? "reference" : "house", changes };
  }
  return { recipe: { ...recipe, pourSteps: out }, source: ref ? "reference" : "house", changes };
}
