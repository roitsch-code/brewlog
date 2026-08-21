/**
 * Shared recipe validator — the checks `/recommend` performs, expressed as
 * QUESTIONS instead of corrections, so a second surface can use them.
 *
 * Why this exists: `/recommend` runs ten deterministic guards over a generated
 * recipe. The home chat's `start_brew` ran exactly one (step sanitation), so a
 * chat-authored recipe reached the brew timer with nothing checking whether its
 * numbers were physically possible. The owner was handed a 450 ml recipe whose
 * final pour was 225 g — half the water — in the 15 s the clock had left, with a
 * two-and-a-half-minute dead gap before it. `/recommend` would never have
 * emitted that: its prompt carries the ~4 g/s pourability rule and its guards
 * would have caught the rest. The chat had neither.
 *
 * The split in behaviour is deliberate and is the reason this module VALIDATES
 * rather than repairs:
 *
 *   - `/recommend` keeps correcting in place. It is measured, it works, and the
 *     user never sees the model's draft — only the corrected result. Nothing
 *     here changes it.
 *   - The chat shows its reasoning in prose and THEN hands the recipe to the
 *     timer. Silently rewriting the numbers would make the message and the timer
 *     disagree, which is a defect this repo has already shipped once (#198). So
 *     the chat asks the model to fix its own recipe, and the prose gets fixed
 *     with it.
 *
 * Everything is checked against the RENDERED timeline (`buildBrewTimeline`), not
 * the model's authored steps. That distinction is the whole point: the dead gap
 * in the reported recipe was never written by the model — it was DERIVED, because
 * three pours spread across a 3:30 clock leaves a hole. Only the timeline shows
 * what the user will actually be asked to do.
 */
import { buildBrewTimeline, type TimelineStep } from "@/lib/brew/timeline";
import { reconcileToReference } from "@/lib/claude/recipeFidelity";
import { NICHE_GRIND_SETTINGS } from "@/lib/constants/grindSettings";
import { LONG_DESIGNED_WAIT_SEC } from "@/lib/knowledge/recipes/helpers";
import type { BrewRecipe } from "@/lib/types/session";
import { DRIP_ASSIST_GRIND_OFFSET_DEG, isDripAssistMethod } from "@/lib/utils/dripAssist";
import { isComandante, nicheToClicks, normalizeGrindToGrinder } from "@/lib/utils/grindUnit";
import { PACE_RATE_MAX_GPS } from "@/lib/utils/pourSequence";
import { vesselOverflow } from "@/lib/utils/vesselCapacity";

export type RecipeProblemCode =
  | "pour-too-fast"
  | "dead-gap"
  | "grind-unit"
  | "drip-assist-grind"
  | "reference-drift"
  | "vessel-overflow";

export interface RecipeProblem {
  code: RecipeProblemCode;
  /** Written for the MODEL to act on: the measured value, the limit, and the fix. */
  message: string;
}

export interface RecipeValidationContext {
  /** Full method string as the timer will show it, e.g. "Orea V4 Classic + Drip Assist". */
  method?: string;
  /** The reference the recipe claims to adapt, or "Own experiment". */
  basedOn?: string;
  /** The grinder in the user's hand, when known ("Comandante C40" / "Niche Zero"). */
  grinder?: string;
  roastDate?: string;
  now?: number;
}

/**
 * The fastest anyone pours by hand. Deliberately the repo's own upper bound for
 * a *sane* pour rather than a tighter "gentle" figure: the corpus genuinely
 * spans ~3–10 g/s (median 5.2), so a stricter limit would reject real published
 * recipes. Anything past this is not a pour, it is arithmetic that never
 * imagined a kettle.
 */
const MAX_POURABLE_RATE_GPS = PACE_RATE_MAX_GPS;

/** Water-adding steps, in timeline order. */
function waterSteps(steps: TimelineStep[]): TimelineStep[] {
  return steps.filter((s) => !s.isAgitation && (s.pourGrams ?? 0) > 0);
}

function fmtClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Every pour needs enough room to physically happen. For a mid-brew pour that
 * room is the gap to the next step; for the final pour it is whatever the clock
 * has left, because a recipe that promises to be finished before its own last
 * pour could end is inconsistent no matter where the drawdown sits.
 */
function checkPourability(steps: TimelineStep[], targetTimeSec: number): RecipeProblem[] {
  const problems: RecipeProblem[] = [];
  const pours = waterSteps(steps);

  for (let i = 0; i < pours.length; i++) {
    const pour = pours[i];
    const grams = pour.pourGrams ?? 0;
    const next = pours[i + 1];
    const availableSec = (next ? next.startSec : targetTimeSec) - pour.startSec;
    if (availableSec <= 0) continue;

    const minSec = grams / MAX_POURABLE_RATE_GPS;
    if (minSec > availableSec) {
      problems.push({
        code: "pour-too-fast",
        message:
          `"${pour.label}" pours ${Math.round(grams)}g but only has ${Math.round(availableSec)}s ` +
          `before ${next ? `the next pour at ${fmtClock(next.startSec)}` : `the brew ends at ${fmtClock(targetTimeSec)}`} ` +
          `— that is ${(grams / availableSec).toFixed(1)} g/s. Nobody pours faster than ~${MAX_POURABLE_RATE_GPS} g/s, ` +
          `and a gentle pour is ~4 g/s. Split this into more pours, or give it more time.`,
      });
    }
  }
  return problems;
}

/**
 * A hole in the middle of a brew. The threshold is the repo's own researched
 * one: normal pulse pouring tops out around a 55–60s bloom rest and the next
 * tier of real designs starts at 80s+, so 75s sits in the gap between "a rest"
 * and "you left the kitchen".
 */
function checkDeadGaps(steps: TimelineStep[]): RecipeProblem[] {
  const problems: RecipeProblem[] = [];
  const pours = waterSteps(steps);

  for (let i = 0; i < pours.length - 1; i++) {
    const pour = pours[i];
    const next = pours[i + 1];
    // When the pour finishes, at the recipe's own intended rate.
    const poursUntil = pour.startSec + (pour.pourDurationSec ?? (pour.pourGrams ?? 0) / 4);
    const gap = next.startSec - poursUntil;
    if (gap > LONG_DESIGNED_WAIT_SEC) {
      problems.push({
        code: "dead-gap",
        message:
          `Nothing happens between ${fmtClock(poursUntil)} and ${fmtClock(next.startSec)} — a ${Math.round(gap)}s ` +
          `wait with the bed draining. Over ${LONG_DESIGNED_WAIT_SEC}s that is not a rest, it is a stalled brew. ` +
          `Use more, smaller pours across the same clock.`,
      });
    }
  }
  return problems;
}

/** Degrees handed to a clicks grinder, or the reverse. */
function checkGrindUnit(recipe: BrewRecipe, grinder?: string): RecipeProblem[] {
  if (!grinder || !recipe.grindSize) return [];
  const converted = normalizeGrindToGrinder(recipe.grindSize, grinder);
  if (!converted || converted === recipe.grindSize) return [];
  return [
    {
      code: "grind-unit",
      message:
        `Grind "${recipe.grindSize}" is in the wrong unit for the ${grinder}. ` +
        `That setting is ${converted} on their grinder — state it that way, in the recipe and in your message.`,
    },
  ];
}

/** Normalized brewer token for matching against the grind table. */
function normalizeBrewer(method: string): string {
  return method
    .toLowerCase()
    .replace(/\+\s*drip\s*assist/g, "")
    .replace(/\bv4\b|\bdripper\b|\bzero\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** The bare-brewer Niche baseline for this method, when the table knows it. */
function baselineNicheRange(method: string): { min: number; max: number } | null {
  const brewer = normalizeBrewer(method);
  if (!brewer) return null;
  let best: { min: number; max: number } | null = null;
  let bestLen = 0;
  for (const entry of NICHE_GRIND_SETTINGS) {
    const key = normalizeBrewer(entry.method);
    if (!key || !brewer.includes(key)) continue;
    if (key.length > bestLen) {
      best = entry.niche;
      bestLen = key.length;
    }
  }
  return best;
}

/**
 * The disc adds flow resistance, so a disc recipe grinds coarser than the same
 * brewer bare. Only flags a grind that is finer than the BARE baseline — i.e.
 * one where the offset plainly wasn't applied and the setting is too fine even
 * without it. A soft positive instruction is exactly the kind this repo has
 * watched leak twice.
 */
function checkDripAssistGrind(recipe: BrewRecipe, ctx: RecipeValidationContext): RecipeProblem[] {
  const method = ctx.method;
  if (!method || !isDripAssistMethod(method) || !recipe.grindSize) return [];

  const baseline = baselineNicheRange(method);
  if (!baseline) return [];

  const m = /(\d{1,3}(?:\.\d+)?)/.exec(recipe.grindSize);
  if (!m) return [];
  const value = Number(m[1]);
  if (!Number.isFinite(value)) return [];

  const clicks = isComandante(ctx.grinder) || value <= 80;
  const floorNiche = baseline.min;
  const floor = clicks ? nicheToClicks(floorNiche) : floorNiche;
  if (value >= floor) return [];

  const suggestedNiche = baseline.min + DRIP_ASSIST_GRIND_OFFSET_DEG;
  const suggested = clicks ? `${nicheToClicks(suggestedNiche)} clicks` : `${suggestedNiche}°`;
  return [
    {
      code: "drip-assist-grind",
      message:
        `Grind "${recipe.grindSize}" is finer than the bare-brewer baseline, but this recipe uses the Drip Assist, ` +
        `which needs roughly ${DRIP_ASSIST_GRIND_OFFSET_DEG}° coarser (about 1–2 Comandante clicks) than the same ` +
        `brewer without it. Around ${suggested} or coarser.`,
    },
  ];
}

/**
 * `basedOn` names a verified corpus recipe whose numbers this recipe does not
 * actually carry. Reuses `/recommend`'s own drift logic rather than restating
 * it, so the two surfaces cannot disagree about what "drifted" means.
 *
 * The escape hatch is real and is the honest answer: a recipe of the chat's own
 * design should say so, and then this check does not apply to it at all.
 */
function checkReferenceDrift(recipe: BrewRecipe, ctx: RecipeValidationContext): RecipeProblem[] {
  if (!ctx.basedOn) return [];
  const result = reconcileToReference(recipe, ctx.basedOn, ctx.method);
  if (!result.changed || result.reasons.length === 0) return [];
  return [
    {
      code: "reference-drift",
      message:
        `Checked against "${ctx.basedOn}": ${result.reasons.join("; ")}. ` +
        `Either bring the recipe in line with those numbers, or call it your own experiment ` +
        `and say in one clause what you changed and why.`,
    },
  ];
}

function checkVessel(recipe: BrewRecipe, method?: string): RecipeProblem[] {
  if (!method) return [];
  const overflow = vesselOverflow(method, recipe.waterGrams);
  if (!overflow) return [];
  return [{ code: "vessel-overflow", message: overflow }];
}

/**
 * Check a recipe end to end. Returns every problem found; an empty array means
 * the recipe is brewable as written. Never throws and never mutates.
 */
export function validateRecipe(
  recipe: BrewRecipe,
  ctx: RecipeValidationContext = {},
): RecipeProblem[] {
  const problems: RecipeProblem[] = [];

  try {
    const timeline = buildBrewTimeline(recipe, ctx.roastDate, ctx.now ?? Date.now(), ctx.method);
    // Percolation only: an immersion steep has no pour cadence to be wrong about,
    // and its step durations are authored rather than derived.
    if (timeline.shape === "percolation") {
      problems.push(...checkPourability(timeline.steps, timeline.targetTimeSec));
      problems.push(...checkDeadGaps(timeline.steps));
    }
  } catch {
    // A recipe the timeline builder can't read is a rendering problem, not a
    // brewing one — sanitizePourSteps already guards that path. Don't block on it.
  }

  problems.push(...checkGrindUnit(recipe, ctx.grinder));
  problems.push(...checkDripAssistGrind(recipe, ctx));
  problems.push(...checkReferenceDrift(recipe, ctx));
  problems.push(...checkVessel(recipe, ctx.method));

  return problems;
}

/** One block of feedback for the model, listing every problem found. */
export function formatProblemsForModel(problems: RecipeProblem[]): string {
  return (
    `That recipe is not brewable as written. ${problems.length === 1 ? "One problem" : `${problems.length} problems`}:\n\n` +
    problems.map((p, i) => `${i + 1}. ${p.message}`).join("\n") +
    `\n\nRewrite the recipe so it holds together, then call start_brew again. ` +
    `Your message to the user must match the corrected recipe — restate it.`
  );
}
