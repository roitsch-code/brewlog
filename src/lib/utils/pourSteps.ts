/**
 * Shared pour-step sanitation — the SINGLE place that turns a model-authored
 * `pourSteps` array (from /recommend OR the home-chat `start_brew` tool) into the
 * strict, renderer-ready shape the brew timer consumes.
 *
 * Why this exists: the brew renderers (`pourStepsFromStructured`,
 * `hasImmersionShape`, `buildGuideSteps`) compare `step.action` against the exact
 * `BrewStepAction` vocabulary. A model that emits "Pour" / "rest" / "plunge"
 * never matches, so an immersion recipe mis-routes to the pour-over renderer and
 * agitation steps go undetected → the guide renders nothing. `/recommend` already
 * guarded this via `sanitizeRecipe`; the chat's `start_brew` path passed the raw
 * tool input straight through and so showed no pour guidance. This module is that
 * guard, extracted so both paths share one source of truth.
 */
import { z } from "zod";
import type { BrewPourStep, BrewStepAction } from "@/lib/types/session";

export const STEP_ACTIONS: readonly BrewStepAction[] = [
  "bloom", "pour", "final", "stir", "swirl", "wait",
  "press", "invert", "flip", "drain", "bypass", "melodrip", "agitate-bed",
];

/** Map free-text / synonym actions onto the structured vocabulary so a minor
 * wording drift ("rest", "plunge") doesn't drop the whole step array. */
export function normalizeStepAction(a: string): BrewStepAction {
  const t = a.toLowerCase().trim();
  if ((STEP_ACTIONS as string[]).includes(t)) return t as BrewStepAction;
  if (/plunge|press/.test(t)) return "press";
  if (/flip/.test(t)) return "flip";
  if (/invert/.test(t)) return "invert";
  if (/bypass|dilute/.test(t)) return "bypass";
  if (/drain|draw|release/.test(t)) return "drain";
  if (/steep|wait|rest|brew/.test(t)) return "wait";
  if (/melodrip/.test(t)) return "melodrip";
  if (/agitate/.test(t)) return "agitate-bed";
  if (/stir|mix/.test(t)) return "stir";
  if (/swirl|shake/.test(t)) return "swirl";
  if (/bloom/.test(t)) return "bloom";
  if (/final|last/.test(t)) return "final";
  return "pour";
}

export const PourStepInputSchema = z.object({
  label: z.string(),
  action: z.string().transform(normalizeStepAction),
  waterGramsAtEnd: z.number().optional(),
  durationSec: z.number().optional(),
  temperatureC: z.number().optional(),
  notes: z.string().optional(),
});

/**
 * Validate + action-normalize a raw `pourSteps` array (e.g. straight from an LLM
 * tool call). Returns a clean `BrewPourStep[]` when there are ≥2 well-formed
 * steps, else `undefined` so the caller can fall back. NEVER throws — a bad step
 * array must not fail the whole recipe. Mirrors the guard `/recommend` applies
 * inside `sanitizeRecipe`.
 */
export function sanitizePourSteps(raw: unknown): BrewPourStep[] | undefined {
  const parsed = z.array(PourStepInputSchema).safeParse(raw);
  if (parsed.success && parsed.data.length >= 2) return parsed.data as BrewPourStep[];
  return undefined;
}

/** Water-adding actions that contribute to the cumulative pour sequence. */
const WATER_ADDING: ReadonlySet<BrewStepAction> = new Set<BrewStepAction>([
  "bloom", "pour", "final", "melodrip",
]);

/**
 * Derive a legacy " – "-joined cumulative-grams `pourSequence` string from
 * structured steps (e.g. "50 – 180 – 320 – 500"), so a recipe authored only as
 * structured `pourSteps` still has the string backstop the brew timer falls back
 * to. Returns `undefined` when fewer than two water-adding milestones carry a
 * cumulative-grams value.
 */
export function pourSequenceFromSteps(steps: BrewPourStep[] | undefined): string | undefined {
  if (!steps || steps.length === 0) return undefined;
  const grams = steps
    .filter((s) => WATER_ADDING.has(s.action) && typeof s.waterGramsAtEnd === "number")
    .map((s) => s.waterGramsAtEnd as number);
  if (grams.length < 2) return undefined;
  return grams.join(" – ");
}
