/**
 * The physics a brew recipe has to satisfy before it reaches the timer.
 *
 * `/recommend` runs a chain of deterministic guards over what the model returns,
 * and until Sep 2026 none of them checked whether the recipe's own arithmetic
 * held together. It could not: the renderer threw the authored timings away and
 * re-derived every pour start from `targetTimeSec`, so "does this add up" had no
 * meaning. Cadence-first, it does — the schedule IS the recipe's numbers — and
 * these are the checks that make a rendered brew physically possible:
 *
 *   1. water milestones strictly increase (a pour can't remove water);
 *   2. the headline `waterGrams` equals what the pour plan actually pours;
 *   3. no pour is scheduled faster than anyone pours (MAX_POUR_RATE_GPS);
 *   4. an immersion recipe's own step durations sum to its clock;
 *   5. the clock leaves at least the drawdown floor after the last pour;
 *   6. the clock isn't padded with a drawdown longer than any published one.
 *
 * This REPAIRS in place, which is right for `/recommend` (the user never sees
 * the model's draft, only the corrected result) and deliberately unlike the chat,
 * where `validateRecipe` asks the same questions and the model fixes its own
 * recipe so its prose and the timer can't disagree (#198).
 */
import { reconcileWaterToPourPlan } from "@/lib/claude/recipeFidelity";
import type { BrewPourStep, BrewRecipe } from "@/lib/types/session";
import {
  MAX_POUR_RATE_GPS,
  defaultDuration,
  isSetupAction,
  maxDrawdownSec,
  maxTargetTimeSec,
  minDrawdownSec,
  pourScheduleFor,
} from "@/lib/utils/pourSequence";

const WATER_ACTIONS = new Set(["bloom", "pour", "final", "melodrip"]);

export interface PhysicsResult {
  recipe: BrewRecipe;
  /** True when the recipe is unbrewable in a way no repair can fix honestly. */
  dropped: boolean;
  /** Human-readable log of every correction made. */
  changes: string[];
}

const isWater = (s: BrewPourStep) =>
  WATER_ACTIONS.has(s.action) && typeof s.waterGramsAtEnd === "number";

/** A cold steep or an iced/bypass build isn't a pour-over clock — leave it be. */
function isOutOfScope(recipe: BrewRecipe): boolean {
  if (typeof recipe.targetTimeSec !== "number" || !(recipe.targetTimeSec > 0)) return true;
  if (recipe.targetTimeSec >= 3600) return true;
  if (typeof recipe.iceGrams === "number" && recipe.iceGrams > 0) return true;
  return false;
}

/**
 * Check and repair a recipe's physics. Never throws; returns the recipe
 * unchanged when it is already sound or out of scope.
 */
export function enforceRecipePhysics(
  recipe: BrewRecipe,
  ctx: { method?: string; roastDate?: string; now?: number } = {},
): PhysicsResult {
  const changes: string[] = [];
  if (isOutOfScope(recipe)) return { recipe, dropped: false, changes };

  let out: BrewRecipe = recipe;
  const now = ctx.now ?? Date.now();

  // 1. Milestones must strictly increase. A plan that goes 250 → 180 describes a
  //    brew that removes water; there is no honest repair, so the candidate goes.
  const steps = Array.isArray(out.pourSteps) ? out.pourSteps : null;
  if (steps) {
    let prev = 0;
    for (const s of steps) {
      if (!isWater(s)) continue;
      const g = s.waterGramsAtEnd as number;
      if (g <= prev) {
        return {
          recipe: out,
          dropped: true,
          changes: [`milestone ${g}g does not increase on the previous ${prev}g`],
        };
      }
      prev = g;
    }
  }

  // 2. The headline water must be what the plan pours.
  const reconciled = reconcileWaterToPourPlan(out);
  if (reconciled !== out) {
    changes.push(`waterGrams ${out.waterGrams}g → ${reconciled.waterGrams}g (matches the pour plan)`);
    out = reconciled;
  }

  // 3. No pour faster than anyone pours. The authored duration is what the
  //    renderer trusts, so raising it here keeps the recipe and the render in
  //    agreement instead of leaving the renderer to silently stretch it.
  if (Array.isArray(out.pourSteps)) {
    let prevGrams = 0;
    let touched = false;
    const fixed = out.pourSteps.map((s) => {
      if (!isWater(s)) return s;
      const grams = Math.max(0, (s.waterGramsAtEnd as number) - prevGrams);
      prevGrams = s.waterGramsAtEnd as number;
      const need = Math.ceil(grams / MAX_POUR_RATE_GPS);
      if (grams > 0 && typeof s.durationSec === "number" && s.durationSec > 0 && s.durationSec < need) {
        touched = true;
        changes.push(
          `"${s.label}" poured ${grams}g in ${s.durationSec}s (${(grams / s.durationSec).toFixed(1)} g/s) → ${need}s`,
        );
        return { ...s, durationSec: need };
      }
      return s;
    });
    if (touched) out = { ...out, pourSteps: fixed };
  }

  // 4. Immersion: the steps ARE the clock, so their sum must be the clock.
  const schedule = pourScheduleFor(out, ctx.roastDate, now, ctx.method);
  if (!schedule) {
    if (Array.isArray(out.pourSteps) && out.pourSteps.length > 0) {
      const timed = out.pourSteps.filter((s) => !isSetupAction(s.action, s.label ?? ""));
      const sum = timed.reduce(
        (acc, s) => acc + (typeof s.durationSec === "number" ? s.durationSec : defaultDuration(s.action)),
        0,
      );
      if (sum > 0 && Math.abs(sum - out.targetTimeSec) > 5) {
        changes.push(`immersion clock ${out.targetTimeSec}s → ${sum}s (its own steps sum to that)`);
        out = { ...out, targetTimeSec: sum };
      }
    }
    return { recipe: out, dropped: false, changes };
  }

  // 5/6. The clock has to hold the pour phase plus a real drawdown, and must not
  //      be padded with a drawdown longer than any published recipe's.
  const floor = minDrawdownSec(ctx.method);
  const needed = schedule.pourPhaseEndSec + floor;
  if (out.targetTimeSec < needed) {
    changes.push(
      `clock ${out.targetTimeSec}s → ${needed}s (pours run to ${schedule.pourPhaseEndSec}s, drawdown needs ${floor}s)`,
    );
    out = { ...out, targetTimeSec: needed };
  } else {
    const drawdown = out.targetTimeSec - schedule.pourPhaseEndSec;
    if (drawdown > maxDrawdownSec(out.targetTimeSec)) {
      const trimmed = maxTargetTimeSec(schedule.pourPhaseEndSec);
      changes.push(
        `clock ${out.targetTimeSec}s → ${trimmed}s (a ${drawdown}s drawdown is padding, not draining)`,
      );
      out = { ...out, targetTimeSec: trimmed };
    }
  }

  return { recipe: out, dropped: false, changes };
}
