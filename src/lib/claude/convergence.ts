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
 * Since 2026-10-19 this is INFORMATION, not a rule (owner: preferences and
 * history are things the model weighs and explains, never filters). The block
 * describes the last brew of this coffee — its recipe as brewed, its rating,
 * what he tasted and wrote — and names both honest answers: a one-dial
 * follow-up on a brew that worked, or something new; a different approach
 * after a brew that missed, or a corrected repeat. The model chooses and
 * whyChosen says why. The deterministic check and its repair round are gone.
 */

import type { BrewPourStep, BrewRecipe, Session } from "../types/session";
import { resolveBrewedRecipe } from "../utils/resolveRecipe";
import { brewMethodKey } from "../utils/brewMethodKey";
import { parseGrindDegrees } from "./recipeFidelity";
import { batchGrindDeltaDeg } from "../constants/grindSettings";
import { grindInUnit } from "../knowledge/recipes/helpers";

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

export function describeBase(b: ConvergenceBase, grinder?: string): string {
  const r = b.recipe;
  const ratio = r.doseGrams > 0 ? (r.waterGrams / r.doseGrams).toFixed(1) : "?";
  const lines = [
    `  Brewer: ${b.method}${b.basedOn ? ` · based on "${b.basedOn}"` : ""}${b.title ? ` · "${b.title}"` : ""}`,
    `  Recipe as brewed: ${r.doseGrams}g : ${r.waterGrams}g (1:${ratio}) at ${r.waterTempC}°C · grind ${grindInUnitFromString(r.grindSize, grinder)} · clock ${mmss(r.targetTimeSec)}${b.actualTimeSec ? ` (actual ${mmss(b.actualTimeSec)})` : ""}`,
    `  Pours: ${pourPlanText(r)}`,
    b.waterSource ? `  Water: ${b.waterSource}` : "",
    b.taste ? `  Taste reading: ${b.taste}` : "",
    b.flavorNotes?.length ? `  Tasted: ${b.flavorNotes.slice(0, 6).join(", ")}` : "",
    b.notes ? `  User wrote: "${b.notes.slice(0, 200)}"` : "",
    b.coachAnswer ? `  Asked "${b.coachAnswer.question.slice(0, 100)}" → "${b.coachAnswer.answer.slice(0, 120)}"` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

/** ", and move the grind from 400° to 412° (dose law)" — or "" when the base
 * grind is not a number. Without it "same grind" carried a 500 ml setting
 * unchanged onto a 750 ml batch. */
function scaledGrindNote(grindSize: string, fromWater: number, toWater: number, method: string, grinder?: string): string {
  const g = grindValue(grindSize);
  const d = batchGrindDeltaDeg(fromWater, toWater);
  if (g === undefined || d === 0) return "";
  // The dose law is measured on the owner's V60 only (grind audit 2026-10-18).
  if (!doseLawApplies(method)) {
    return `; how far the grind moves for this batch on a ${method} is unmeasured — a measurement brew, say so in whyChosen`;
  }
  return `, and the dose law moves the grind ${d > 0 ? "coarser" : "finer"}: ${grindInUnit(Math.round(g), grinder)} → ${grindInUnit(Math.round(g + d), grinder)} (+20° per doubling of the batch, measured on this V60)`;
}

/** A logged grind string ("406°", "26 clicks") in the brew's grinder unit. */
function grindInUnitFromString(grindSize: string, grinder?: string): string {
  const g = grindValue(grindSize);
  if (g === undefined) return grindSize;
  return grindInUnit(Math.round(g), grinder);
}

/** The +20°-per-doubling dose law is MEASURED on the owner's V60 only. */
export function doseLawApplies(method: string | undefined): boolean {
  return brewMethodKey(method) === "v60";
}

export interface ConvergenceNoteOptions {
  /** Today's requested water, when it differs from the base the dose scales. */
  targetWaterGrams?: number;
  /** The brew's grinder, for the unit of every grind in the block. */
  grinder?: string;
}

/** THIS COFFEE'S LAST BREW — information for the user message. */
export function formatConvergenceInfo(state: ConvergenceState, opts: ConvergenceNoteOptions = {}): string {
  if (state.kind === "first") {
    return `\nTHIS COFFEE: first brew of this bag. Nothing to build on yet — characterise it: two candidates with genuinely different extraction physics so the cup comparison teaches something.`;
  }
  if (state.kind === "unrated") {
    return `\nTHIS COFFEE: brew ${state.count + 1} of this bag; the last brew was not rated, so there is no verdict to build on.`;
  }
  const b = state.kind === "converge" ? state.base : state.last;
  const scaleNote =
    opts.targetWaterGrams &&
    b.recipe.waterGrams > 0 &&
    Math.abs(opts.targetWaterGrams - b.recipe.waterGrams) / b.recipe.waterGrams > 0.05
      ? `\nToday he asked for ${opts.targetWaterGrams} g (that brew was ${b.recipe.waterGrams} g): the same recipe at today's amount keeps the ratio and the pour count${scaledGrindNote(b.recipe.grindSize, b.recipe.waterGrams, opts.targetWaterGrams, b.method, opts.grinder)}.`
      : "";
  if (state.kind === "diverge") {
    return `\nTHIS COFFEE'S LAST BREW MISSED (${b.rating}★ on ${b.dateLabel || "the last brew"}; brew ${state.count + 1} of this bag):
${describeBase(b, opts.grinder)}${scaleNote}
Two honest answers: a different approach aimed at what the cup told you (sour / bitter / thin / muddy), or a corrected repeat if the fault is clearly one dial. Your call — say which and why in whyChosen.`;
  }
  return `\nTHIS COFFEE'S LAST BREW WORKED (${b.rating}★ on ${b.dateLabel || "the last brew"}; brew ${state.count + 1} of this bag):
${describeBase(b, opts.grinder)}${scaleNote}
Two honest answers: that brew reproduced with ONE named change toward 5★ (basedOn "${b.name}", the numbers above as brewed), or something genuinely new that this bag has not seen. Your call — say which and why in whyChosen.`;
}

// ─── Deterministic check ─────────────────────────────────────────────────────

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
export function changedDials(base: BrewRecipe, cand: CandidateLike["recipe"], method?: string): string[] {
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
  if (!sameBatch && !doseLawApplies(method)) {
    // A batch change on a brewer whose dose law is unmeasured: the grind move is
    // a measurement brew, part of the scaling — never counted as the one change.
  } else if (bG !== undefined && cG !== undefined) {
    // A different batch moves the grind by the dose law (+20° per doubling,
    // measured on the V60) — part of SCALING, not the one change.
    const expected = !sameBatch && cWater !== undefined ? bG + batchGrindDeltaDeg(bWater, cWater) : bG;
    if (Math.abs(cG - expected) > GRIND_TOLERANCE) changed.push("grind");
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
