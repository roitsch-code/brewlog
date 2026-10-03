/**
 * Convergence policy — the rating of the LAST brew of this coffee decides what
 * the first candidate must be (owner decision, 2026-10-03).
 *
 * Until this module the per-coffee SESSION ARC counted brews and told the model
 * to "push the boundary" from brew 4 on and to find "expert territory" from
 * brew 7, with no state for "that worked — reproduce it". Measured on the real
 * log (outcome ledger, 205 rated brews): the next brew of the same coffee beat
 * the previous one no more often than it lost to it (Q3 2026: 13 improved,
 * 5 same, 12 worse), the 2nd brew of a coffee averaged +0.25★ over the 1st and
 * nothing after that, and a 4★ bean was routinely re-brewed on a different
 * brewer at a different temperature and grind the next morning, so no cup
 * could be attributed to anything.
 *
 * The rule:
 *   - last brew ≥ 4★  → CONVERGE. Candidate 1 is that brew reproduced with
 *                        EXACTLY ONE named change toward 4.5–5★.
 *   - last brew < 4★  → DIVERGE. Candidate 1 is something genuinely different
 *                        (another brewer family or another reference), chosen
 *                        for fit. A missed cup is not a baseline.
 *   - no rated brew   → the first-brew arc, unchanged.
 *   - candidate 2 is ALWAYS the exploration slot, from the first brew.
 *
 * Two halves, like every guard here: a prompt block the model reads, and a
 * deterministic check on what it wrote (one repair round, then log and accept —
 * never a silent rewrite of a recipe the user is about to see).
 */

import type { BrewPourStep, BrewRecipe, Session } from "../types/session";
import { resolveBrewedRecipe } from "../utils/resolveRecipe";
import { brewMethodKey } from "../utils/brewMethodKey";
import { parseGrindDegrees } from "./recipeFidelity";

/** A brew at or above this rating is reproduced; below it, the next brew diverges. */
export const CONVERGE_MIN_RATING = 4;

/** Ratio drift the check still reads as "the same ratio" (scaling noise). */
const RATIO_TOLERANCE = 0.03;
/** Temperature drift read as "the same temperature". */
const TEMP_TOLERANCE_C = 0.5;
/** Grind drift (° or clicks) read as "the same grind". */
const GRIND_TOLERANCE = 0.5;
/** Cumulative-grams drift per milestone, when the batch size is unchanged. */
const MILESTONE_TOLERANCE_G = 3;

export interface ConvergenceBase {
  /** The exact basedOn string candidate 1 must carry. */
  name: string;
  method: string;
  rating: number;
  dateLabel: string;
  /** What that brew itself was based on (reference or own). */
  basedOn?: string;
  title?: string;
  /** The recipe as brewed — logged grind/temperature folded over the recipe. */
  recipe: BrewRecipe;
  grindUsed?: string;
  actualTempC?: number;
  actualTimeSec?: number;
  waterSource?: string;
  /** context.occasion of that brew — a partition change (hot ⟷ cold ⟷ iced) voids the base. */
  occasion?: string;
  notes?: string;
  coachAnswer?: { question: string; answer: string };
  flavorNotes?: string[];
  taste?: string;
}

export type ConvergenceState =
  | { kind: "first" }
  | { kind: "unrated"; count: number }
  | { kind: "diverge"; last: ConvergenceBase; count: number }
  | { kind: "converge"; base: ConvergenceBase; count: number };

function sessionTime(s: Session): number {
  const ms = (s as { createdAtMs?: number }).createdAtMs;
  if (typeof ms === "number" && Number.isFinite(ms)) return ms;
  const t = Date.parse(s.createdAt ?? "");
  return Number.isFinite(t) ? t : 0;
}

function shortDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function baseOf(s: Session): ConvergenceBase | null {
  const rating = s.result?.rating;
  if (typeof rating !== "number" || !Number.isFinite(rating)) return null;
  const { recipe, method: resolvedMethod, candidate } = resolveBrewedRecipe(s);
  const method = s.brew?.methodUsed || resolvedMethod || "";
  if (!recipe || !method) return null;
  const grindUsed = s.brew?.grindSettingUsed?.trim() || undefined;
  const actualTempC =
    typeof s.brew?.actualTempC === "number" && Number.isFinite(s.brew.actualTempC)
      ? s.brew.actualTempC
      : undefined;
  const effective: BrewRecipe = {
    ...recipe,
    grindSize: grindUsed || recipe.grindSize,
    waterTempC: actualTempC ?? recipe.waterTempC,
  };
  const coffeeName = [s.coffee?.roaster, s.coffee?.name].filter(Boolean).join(" ").trim();
  const dateLabel = shortDate(s.createdAt);
  const taste = [
    s.result?.body && `body=${s.result.body}`,
    s.result?.acidity && `acidity=${s.result.acidity}`,
    s.result?.sweetness && `sweetness=${s.result.sweetness}`,
    s.result?.bitterness && `bitterness=${s.result.bitterness}`,
  ]
    .filter(Boolean)
    .join(" ");
  return {
    // Same shape as ownReferenceRecipes' names so a ≥4★ brew that is ALSO an
    // own reference resolves to the same string in the menu.
    name: `Your ${method} — ${coffeeName || "own brew"}${dateLabel ? ` (${dateLabel})` : ""}`,
    method,
    rating,
    dateLabel,
    basedOn: candidate?.basedOn?.trim() || undefined,
    title: candidate?.title?.trim() || undefined,
    recipe: effective,
    grindUsed,
    actualTempC,
    actualTimeSec:
      typeof s.brew?.actualTimeSec === "number" && s.brew.actualTimeSec > 0
        ? s.brew.actualTimeSec
        : undefined,
    waterSource: s.context?.waterSource,
    occasion: s.context?.occasion,
    notes: s.result?.freeNotes?.trim() || undefined,
    coachAnswer: s.result?.coachAnswer,
    flavorNotes: s.result?.flavorNotes,
    taste: taste || undefined,
  };
}

/** Derive the state from the sessions of THIS coffee (any order). */
export function deriveConvergence(sessionsForThisCoffee: Session[]): ConvergenceState {
  const count = sessionsForThisCoffee.length;
  if (count === 0) return { kind: "first" };
  const latest = [...sessionsForThisCoffee].sort((a, b) => sessionTime(b) - sessionTime(a))[0];
  const base = baseOf(latest);
  if (!base) return { kind: "unrated", count };
  return base.rating >= CONVERGE_MIN_RATING
    ? { kind: "converge", base, count }
    : { kind: "diverge", last: base, count };
}

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;

function pourPlanText(recipe: BrewRecipe): string {
  const steps = recipe.pourSteps;
  if (Array.isArray(steps) && steps.length) {
    return steps
      .map((p) => {
        const g = typeof p.waterGramsAtEnd === "number" ? `→${p.waterGramsAtEnd}g` : "";
        const d = typeof p.durationSec === "number" ? `@${p.durationSec}s` : "";
        return `${p.label || p.action}${g ? ` ${g}` : ""}${d}`;
      })
      .join(" · ");
  }
  return recipe.pourSequence?.trim() || "(no pour plan logged)";
}

function describeBase(b: ConvergenceBase): string {
  const r = b.recipe;
  const ratio = r.doseGrams > 0 ? (r.waterGrams / r.doseGrams).toFixed(1) : "?";
  const lines = [
    `  Brewer: ${b.method}${b.basedOn ? ` · based on "${b.basedOn}"` : ""}${b.title ? ` · "${b.title}"` : ""}`,
    `  Recipe as brewed: ${r.doseGrams}g : ${r.waterGrams}g (1:${ratio}) at ${r.waterTempC}°C · grind ${r.grindSize} · clock ${mmss(r.targetTimeSec)}${b.actualTimeSec ? ` (actual ${mmss(b.actualTimeSec)})` : ""}`,
    `  Pours: ${pourPlanText(r)}`,
    b.waterSource ? `  Water: ${b.waterSource}` : "",
    b.taste ? `  Taste reading: ${b.taste}` : "",
    b.flavorNotes?.length ? `  Tasted: ${b.flavorNotes.slice(0, 6).join(", ")}` : "",
    b.notes ? `  User wrote: "${b.notes.slice(0, 200)}"` : "",
    b.coachAnswer ? `  Asked "${b.coachAnswer.question.slice(0, 100)}" → "${b.coachAnswer.answer.slice(0, 120)}"` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

export interface ConvergenceNoteOptions {
  /** The exploration-slot sentence appended to every arc (always on). */
  explorationSlot: string;
  /** Today's requested water, when it differs from the base the dose scales. */
  targetWaterGrams?: number;
}

/** The SESSION ARC block for the user message. */
export function formatConvergenceNote(state: ConvergenceState, opts: ConvergenceNoteOptions): string {
  const slot = opts.explorationSlot;
  if (state.kind === "first") {
    return `\nSESSION ARC: First brew of this coffee. Goal: characterize extraction behavior and establish a baseline. Pair two candidates with genuinely different extraction physics (e.g., fast-flow high agitation vs flat-bed minimal agitation, many small pours vs few large ones, or high-clarity vs body-forward) so the cup comparison is informative. Immersion is one option among these, not the default contrast.${slot}`;
  }
  if (state.kind === "unrated") {
    return `\nSESSION ARC: Session ${state.count + 1} of this coffee; the last brew was not rated, so there is no verdict to build on. Make the FIRST candidate the best-fit answer for this bean and context.${slot}`;
  }
  if (state.kind === "diverge") {
    const b = state.last;
    return `\nSESSION ARC — THE LAST BREW OF THIS COFFEE MISSED (${b.rating}★ on ${b.dateLabel || "the last brew"}). Session ${state.count + 1}.
${describeBase(b)}
RULE: a ${b.rating}★ cup is NOT a baseline. The FIRST candidate must be genuinely different from that brew — a different brewer family, or a different reference recipe on the same brewer — chosen for fit to this bean, not for contrast. Do not re-serve that recipe with a tweak. If the user's note or taste reading names the fault (sour / bitter / thin / muddy), aim the new approach at that fault and say so in whyChosen.${slot}`;
  }
  const b = state.base;
  const scaleNote =
    opts.targetWaterGrams &&
    b.recipe.waterGrams > 0 &&
    Math.abs(opts.targetWaterGrams - b.recipe.waterGrams) / b.recipe.waterGrams > 0.05
      ? `\nThe user asked for ${opts.targetWaterGrams}g today (the base was ${b.recipe.waterGrams}g): scale dose and milestones to ${opts.targetWaterGrams}g at the SAME ratio and pour count. Scaling is not the one change.`
      : "";
  return `\nSESSION ARC — THE LAST BREW OF THIS COFFEE WORKED (${b.rating}★ on ${b.dateLabel || "the last brew"}). Session ${state.count + 1}.
${describeBase(b)}
RULE — THE FIRST CANDIDATE IS THAT BREW REPRODUCED WITH EXACTLY ONE CHANGE. Same brewer, same ratio, same pour count and cadence, same temperature, same grind, same agitation — except for the ONE dial you move toward 4.5–5★. Pick the dial from what the cup told you (the taste reading, the user's note, the coach answer, MEASURED BREW FEEDBACK): one of water temperature, grind, ratio/dose, pour plan (count, sizes or cadence), agitation, or water source. Name it in \`experiment\` and the reason in whyChosen. Set basedOn EXACTLY to "${b.name}". Use the numbers above as written — the user already brewed them on this kit; do not re-derive them from a published recipe.${scaleNote}
This rule overrides RECENTLY RECOMMENDED, METHOD FIT & FRESHNESS and PORTFOLIO DIVERSITY for the first candidate only: repeating a brew that earned ${b.rating}★ is the point, not a failure. The second candidate is the exploration slot and must differ from this base in brewer or reference.${slot}`;
}

// ─── Deterministic check ─────────────────────────────────────────────────────

export interface ConvergenceViolation {
  kind: "converge" | "diverge";
  reason: string;
  changed: string[];
}

type CandidateLike = {
  method: string;
  basedOn?: string;
  experiment?: string;
  recipe: Partial<BrewRecipe> & Record<string, unknown>;
};

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function grindValue(g: unknown): number | undefined {
  if (typeof g !== "string") return undefined;
  const parsed = parseGrindDegrees(g);
  if (typeof parsed === "number" && Number.isFinite(parsed)) return parsed;
  const m = g.match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : undefined;
}

const WATER_ADDING = new Set(["bloom", "pour", "final"]);
const AGITATION = new Set(["stir", "swirl", "agitate-bed"]);

function milestones(steps?: BrewPourStep[]): number[] {
  if (!Array.isArray(steps)) return [];
  return steps
    .filter((s) => WATER_ADDING.has(s.action))
    .map((s) => s.waterGramsAtEnd)
    .filter((g): g is number => typeof g === "number" && g > 0);
}

function agitationCount(steps?: BrewPourStep[]): number {
  if (!Array.isArray(steps)) return 0;
  return steps.filter((s) => AGITATION.has(s.action)).length;
}

/** Which dials differ between the base and candidate 1. Exported for tests. */
export function changedDials(base: BrewRecipe, cand: CandidateLike["recipe"]): string[] {
  const changed: string[] = [];
  const bDose = base.doseGrams;
  const bWater = base.waterGrams;
  const cDose = num(cand.doseGrams);
  const cWater = num(cand.waterGrams);
  const sameBatch =
    cWater !== undefined && bWater > 0 ? Math.abs(cWater - bWater) / bWater <= 0.05 : true;

  if (cDose !== undefined && cWater !== undefined && bDose > 0 && cDose > 0) {
    const bRatio = bWater / bDose;
    const cRatio = cWater / cDose;
    if (Math.abs(cRatio - bRatio) / bRatio > RATIO_TOLERANCE) changed.push("ratio");
  }
  const cTemp = num(cand.waterTempC);
  if (cTemp !== undefined && Math.abs(cTemp - base.waterTempC) > TEMP_TOLERANCE_C) changed.push("temperature");

  const bG = grindValue(base.grindSize);
  const cG = grindValue(cand.grindSize);
  if (bG !== undefined && cG !== undefined) {
    if (Math.abs(cG - bG) > GRIND_TOLERANCE) changed.push("grind");
  } else if (typeof cand.grindSize === "string" && cand.grindSize.trim().toLowerCase() !== base.grindSize.trim().toLowerCase()) {
    changed.push("grind");
  }

  const bSteps = base.pourSteps;
  const cSteps = Array.isArray(cand.pourSteps) ? (cand.pourSteps as BrewPourStep[]) : undefined;
  if (bSteps?.length && cSteps?.length) {
    const bm = milestones(bSteps);
    const cm = milestones(cSteps);
    let planChanged = bm.length !== cm.length;
    if (!planChanged && sameBatch) {
      planChanged = bm.some((g, i) => Math.abs(g - cm[i]) > MILESTONE_TOLERANCE_G);
    } else if (!planChanged && bWater > 0 && cWater) {
      // Scaled batch: compare the pour SHAPE (each milestone as a share of water).
      planChanged = bm.some((g, i) => Math.abs(g / bWater - cm[i] / cWater) > 0.03);
    }
    if (planChanged) changed.push("pour plan");
    if (agitationCount(bSteps) !== agitationCount(cSteps)) changed.push("agitation");
  }
  return changed;
}

const WATER_WORDS = /\bwater\b|ppm|mineral|clarity blend|bwt|distilled|tap/i;

/**
 * Check candidate 1 against the state. Returns null when it complies.
 * CONVERGE: same brewer family and at most one changed dial (zero is accepted
 * only when the named experiment is the water source, which the recipe
 * numbers cannot show). DIVERGE: not the same brewer family + same reference.
 */
export function checkConvergence(
  state: ConvergenceState,
  first: CandidateLike | undefined,
): ConvergenceViolation | null {
  if (!first) return null;
  if (state.kind === "converge") {
    const b = state.base;
    if (brewMethodKey(first.method) !== brewMethodKey(b.method)) {
      return {
        kind: "converge",
        reason: `candidate 1 is on ${first.method}, the ${b.rating}★ base was ${b.method}`,
        changed: ["brewer"],
      };
    }
    const changed = changedDials(b.recipe, first.recipe);
    if (changed.length > 1) {
      return {
        kind: "converge",
        reason: `candidate 1 changes ${changed.length} dials at once (${changed.join(", ")})`,
        changed,
      };
    }
    if (changed.length === 0 && !WATER_WORDS.test(first.experiment ?? "")) {
      return {
        kind: "converge",
        reason: "candidate 1 repeats the base with no change named",
        changed,
      };
    }
    return null;
  }
  if (state.kind === "diverge") {
    const b = state.last;
    const sameFamily = brewMethodKey(first.method) === brewMethodKey(b.method);
    if (!sameFamily) return null;
    const cRef = (first.basedOn ?? "").trim().toLowerCase();
    const bRef = (b.basedOn ?? "").trim().toLowerCase();
    const bothOwn = /^own (recipe|experiment)/.test(cRef) && /^own (recipe|experiment)/.test(bRef);
    const sameRef =
      !!cRef && !!bRef && (cRef === bRef || (cRef.length >= 6 && bRef.includes(cRef)) || (bRef.length >= 6 && cRef.includes(bRef)));
    if (sameRef || bothOwn || !cRef) {
      return {
        kind: "diverge",
        reason: `candidate 1 re-serves the ${b.rating}★ brew's approach (${b.method}, "${b.basedOn || "own"}")`,
        changed: [],
      };
    }
  }
  return null;
}

/** The correction appended to the user message for the one repair round. */
export function formatConvergenceRepair(state: ConvergenceState, v: ConvergenceViolation): string {
  if (state.kind === "converge") {
    const b = state.base;
    return `

REPAIR — CONVERGENCE. ${v.reason}. The last brew of this coffee earned ${b.rating}★; the FIRST candidate must be THAT brew (${b.method}, ${b.recipe.doseGrams}g : ${b.recipe.waterGrams}g at ${b.recipe.waterTempC}°C, grind ${b.recipe.grindSize}, pours ${pourPlanText(b.recipe)}) with EXACTLY ONE dial changed and named in \`experiment\`, basedOn "${b.name}". Keep the second candidate as the exploration. Return the full JSON again.`;
  }
  if (state.kind !== "diverge") return "";
  const b = state.last;
  return `

REPAIR — DIVERGENCE. ${v.reason}. That brew rated ${b.rating}★, so the FIRST candidate must be a genuinely different approach — another brewer family, or another reference recipe — chosen for fit. Keep the second candidate as the exploration. Return the full JSON again.`;
}
