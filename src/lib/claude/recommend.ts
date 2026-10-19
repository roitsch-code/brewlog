import { callRecommendModel } from "../ai/recommendProvider";
import { vesselOverflow } from "../utils/vesselCapacity";
import { stripProactiveDripAssist } from "../utils/dripAssist";
import { applyTimelineToSteps, composeTimeline } from "../brew/composeTimeline";
import { isComandante, normalizeGrindToGrinder } from "../utils/grindUnit";
import { buildMeasuredGrind, formatMeasuredGrindForPrompt } from "./measuredGrind";
import { stripMinimalAgitationSwirls } from "../utils/agitationGuard";
import { specialTimeNote } from "../utils/timeBudget";
import { daysSinceRoast, freshnessBucket, freshnessNote } from "../coffee/freshness";
import { resolveBrewedRecipe } from "../utils/resolveRecipe";
import { enforceRecipePhysics } from "../recipe/enforceRecipePhysics";
import type {
  CoffeeIdentity,
  SessionContext,
  Recommendation,
  RecommendationCandidate,
  CandidateRole,
  CandidateConfidence,
  BrewRecipe,
} from "../types/session";
import type { Session } from "../types/session";
import type { UserPreferences } from "../types/preferences";
import {
  buildTimingStats,
  buildMeasuredFeedback,
  recentReferenceNames,
} from "./historyUtils";
import { brewMethodKey } from "../utils/brewMethodKey";
import { buildOwnReferences, formatOwnReferencesForPrompt } from "./ownReferenceRecipes";
import { getRoasterPrior, formatRoasterPriorForPrompt } from "../roasters/priors";
import {
  buildBrewerMenu,
  formatMenuForPrompt,
  formatRecipeIndexBlock,
  formatRecipeForPrompt,
  brewersAvailableFromEquipment,
  CANONICAL_EQUIPMENT,
  brewersFromMethod,
  normaliseRoastLevel,
  normaliseProcess,
  normaliseGoal,
  deriveRotationSeed,
  grindInUnit,
  LONG_DESIGNED_WAIT_SEC,
} from "../knowledge/recipes";
import {
  getVarietyPriorsForBag,
  formatVarietyPriorsForPrompt,
} from "../knowledge/varieties";
import { TECHNIQUES } from "../knowledge/techniques";
import { reconcileToReference, reconcileWaterToPourPlan, resolveReference, referenceAppliesAtBatch } from "./recipeFidelity";
import { brewerRecency } from "./methodRotation";
import { isInMenu, menuNamesOf } from "./menuBinding";
import { deriveConvergence, formatConvergenceInfo, type ConvergenceState } from "./convergence";
import { formatPreferencesForRecommend } from "./preferenceBlock";
import { derivePourSequence, sanitizePourSteps } from "../utils/pourSteps";
import { formatPourPaceForPrompt, measuredPourPace } from "../brew/pourPace";
import { componentsOf, describeBlend } from "../coffee/blend";
import { parseClaudeJson, z } from "./parseJson";
import { formatInsightsBlock, type RecommendInsight } from "./insightsBlock";
import { formatShownUpfront, shownReferenceIds, type ShownCandidate } from "./shownGuard";
import {
  applyUserParams,
  formatUserRequestBlock,
  resolveUserRequest,
  toApplied,
  usesExcludedBrewer,
  type ParsedUserRequest,
} from "./userRequest";
import { formatMeasuredChemexBlock, measuredChemexAtBatch } from "./measuredChemex";
import { formatGrindSlopeBlock, interpolateGrind } from "./grindSlope";
import { grindProvenanceOf } from "./grindProvenance";
import { batchWithinWindow } from "../recipe/batchWindow";
import type { BrewerType } from "../knowledge/recipes";

// Prose the model has to WRITE is prose the user has to WAIT for: /recommend is
// a single blocking call, so nothing renders until the last token lands. This
// schema was nine prose fields per candidate plus three at the top; six of them
// were displayed by nothing at all (primaryVariable, confidenceReason,
// learningValue, brewingLesson — 3–4 sentences each — sessionObjective,
// coffeeAssessment). They cost a wait on every single brew and were read by
// nobody, ever.
//
// Of the four that WERE rendered, the owner asked to keep one: "Why". So a
// candidate now carries one sentence of justification, and the fields stay
// `.optional()` so a model that still emits the old set doesn't fail the parse
// — the extra keys are simply dropped.
const CandidateSchema = z.object({
  method: z.string(),
  role: z.string(),
  title: z.string(),
  basedOn: z.string().optional(),
  recipe: z.record(z.string(), z.unknown()),
  whyChosen: z.string(),
  // One clause naming the variable this candidate tests. Its job is generative,
  // not decorative: #520 stripped the nine per-candidate prose fields, and with
  // them the only thing forcing the model to justify two DIFFERENT experiments
  // — after that both candidates could collapse onto the same safe recipe with
  // nothing in the output revealing it. The prompt requires the two clauses to
  // name different variables, which makes a duplicated portfolio visible in the
  // model's own words. Optional so a response without it still parses.
  experiment: z.string().optional(),
  confidence: z.string(),
  // The model may propose the other grinder, with a reason (owner, 2026-10-19).
  grinderSuggestion: z.object({ grinder: z.string(), reason: z.string().max(200) }).optional(),
});

const RecommendationResponseSchema = z.object({
  candidates: z.array(CandidateSchema).min(1),
  // Kept: the only prose with consumers beyond the recipe screen — the brew
  // detail page, /api/brew-insight, the chat context and the coach all read it.
  reasoning: z.string().optional(),
});

/**
 * Validate + coerce the model's `pourSteps`. Lenient by design: a well-formed
 * array is kept (actions normalised); anything malformed is dropped so the
 * timer falls back to the `pourSequence` string. NEVER throws — a bad step
 * array must not fail the whole recommendation.
 */
function sanitizeRecipe(recipe: Record<string, unknown>): BrewRecipe {
  const out = { ...recipe } as Record<string, unknown>;
  const clean = sanitizePourSteps(out.pourSteps);
  if (clean) {
    out.pourSteps = clean;
  } else {
    delete out.pourSteps;
  }
  // The pour-sequence string is DERIVED from the steps, not requested from the
  // model (2026-10-03, speed round) — one less thing to write per candidate,
  // and it cannot disagree with the steps the timer runs. A model-supplied
  // string survives only when derivation has nothing to work with.
  out.pourSequence = derivePourSequence(clean) ?? out.pourSequence;
  // Headline water must match the pour plan the timer runs — the model
  // occasionally leaves waterGrams on a reference recipe's published number
  // while the pourSteps describe the adapted brew (the "225g header vs pour-
  // to-230g plan" report). Snap the headline to the pour plan.
  return reconcileWaterToPourPlan(out as unknown as BrewRecipe);
}

/**
 * Deterministic backstop: if a candidate claims to adapt a verified reference
 * recipe but its grind / total time / temperature has drifted too far from
 * that recipe scaled to the user's batch, snap the mechanics back to the
 * faithful scaled reference (PR #265 follow-up — the Kasuya Super Coarse case).
 * Logs every correction so drift stays observable.
 */
function guardRecipeFidelity(
  recipe: BrewRecipe,
  basedOn: string | undefined,
  title: string,
  method?: string,
  daysOld?: number | null,
): BrewRecipe {
  const { recipe: fixed, changed, reasons, reference } = reconcileToReference(
    recipe,
    basedOn,
    method,
    { daysOld },
  );
  if (changed) {
    console.warn(
      `[recommend] recipe-fidelity: snapped "${title}" back to "${reference}" — ${reasons.join("; ")}`,
    );
  }
  return fixed;
}

/**
 * Deterministic capacity backstop: drop any candidate whose brewer can't hold the
 * water it pours (e.g. a Clever/Origami at >450ml). The prompt already forbids
 * this, but the Mistral spike (issue #453) showed large-volume requests can still
 * slip one through. Never returns empty — if every candidate overflows (shouldn't
 * happen), keep them and log loudly rather than fail the recommendation.
 */
function guardVesselCapacity(
  candidates: RecommendationCandidate[],
): RecommendationCandidate[] {
  const safe = candidates.filter((c) => {
    const reason = vesselOverflow(c.method, c.recipe?.waterGrams as number | undefined);
    if (reason) console.warn(`[recommend] capacity guard dropped "${c.title}" — ${reason}`);
    return !reason;
  });
  return safe.length ? safe : candidates;
}

/**
 * The model's grinder proposal, made real: dropped when it names an unknown
 * grinder, the grinder the brew is already set up with, or a recipe whose
 * grind has no number to convert; when the owner typed a grind in the free
 * text his number wins and no proposal is made. Otherwise the recipe's grind
 * is converted into the proposed grinder's unit (grindUnit.ts, the owner's
 * measured anchors) and flagged when the clicks fall outside the measured
 * 23–29 span. The recipe's own grindSize is untouched — the owner answers on
 * the recipe screen with one tap.
 */
function attachGrinderSuggestion(
  c: RecommendationCandidate,
  sessionGrinder: string,
  userTypedGrind: boolean,
): RecommendationCandidate {
  const raw = c.grinderSuggestion;
  if (!raw) return c;
  const { grinderSuggestion: _drop, ...rest } = c;
  const target: "Comandante C40" | "Niche Zero" | null = /comandante|c40/i.test(raw.grinder)
    ? "Comandante C40"
    : /niche/i.test(raw.grinder)
      ? "Niche Zero"
      : null;
  if (!target || isComandante(target) === isComandante(sessionGrinder) || userTypedGrind) return rest;
  const converted = normalizeGrindToGrinder(c.recipe.grindSize, target);
  if (!converted || converted === c.recipe.grindSize) return rest;
  const n = Number(/^\s*(\d+)/.exec(converted)?.[1]);
  const extrapolated = isComandante(target) && Number.isFinite(n) && (n < 23 || n > 29);
  console.log(
    `[recommend] grinder-suggestion: "${c.title}" → ${target} (${raw.reason}) ${converted}${extrapolated ? " extrapolated" : ""}`,
  );
  return {
    ...rest,
    grinderSuggestion: { grinder: target, reason: raw.reason.slice(0, 200), grindSize: converted, ...(extrapolated ? { extrapolated } : {}) },
  };
}

/**
 * Aggregated tasting history for the coffee being brewed.
 * Populated by the weekly /api/coffees/compact cron. Both fields are
 * optional — undefined on first brews or coffees with <2 sessions.
 */
export interface CoffeeHistory {
  /** Top flavor notes the user has tasted across logged sessions. */
  commonNotes?: string[];
  /** 2–4 sentence AI brew memory. */
  writtenSummary?: string;
  /** The coffee's own coach card (coffees.coach_insight) — absent when none or status doesnt-apply. */
  coachCard?: { observation: string; suggestion: string; status: string };
}

/** Coach insight surfaced into the recommend prompt — the general coach's
 * observations from /api/insights ordered by relevance. Imports
 * indirection (raw type rather than the Drizzle row) so this module
 * stays free of DB types — the caller (POST /api/recommend) does the
 * load. */
// The coach-insight shape for the prompt lives in insightsBlock.ts (status +
// source carried through since 2026-10-03). Re-exported so run.ts keeps importing it from here.
export type { RecommendInsight } from "./insightsBlock";

export async function generateRecommendation(
  coffee: CoffeeIdentity,
  context: SessionContext,
  preferences: UserPreferences,
  pastSessions: Session[] = [],
  userRoasterPrior?: import("../roasters/priors").RoasterPrior,
  escherTerrain?: string,
  coffeeHistory?: CoffeeHistory,
  insights?: RecommendInsight[],
  opts: {
    /** Candidates already shown in this flow (the user went Back and asked again). */
    shown?: ShownCandidate[];
    /** The Context step's free text, parsed (userRequest.ts). */
    userRequest?: ParsedUserRequest;
  } = {},
): Promise<{
  recommendation: Recommendation;
  usage: { input_tokens: number; output_tokens: number; calls: number };
}> {
  const equipment = CANONICAL_EQUIPMENT.join(", ");

  const PERCOLATION_METHODS = new Set([
    "v60", "orea", "orea fast", "orea apex", "orea classic", "orea open",
    "kalita", "kalita wave", "chemex",
    "turbo v60", "peng", "4:6", "kasuya",
    "origami", "origami air", "origami air m",
  ]);
  // Variant suffixes must not defeat the lookup: "Origami (wave)" / "Kalita
  // Wave 155" are percolation even though only the base name is in the set.
  const isPercolation = (method?: string) => {
    if (!method) return false;
    const m = method.toLowerCase().replace(/\(.*?\)/g, " ").replace(/\s+/g, " ").trim();
    if (PERCOLATION_METHODS.has(m)) return true;
    return Array.from(PERCOLATION_METHODS).some((k) => m.startsWith(k));
  };

  const timingStats = buildTimingStats(pastSessions, isPercolation);

  // Session arc: how many times has this exact coffee been brewed before?
  const sessionsForThisCoffee = pastSessions.filter(
    s => s.coffee?.name === coffee.name && s.coffee?.roaster === coffee.roaster
  );
  const sessionCountForThisCoffee = sessionsForThisCoffee.length;

  // CONVERGENCE (convergence.ts, owner decision 2026-10-03): the rating of the
  // LAST brew of this coffee decides the first candidate. ≥4★ → reproduce it
  // with exactly one change; <4★ → something genuinely different. The count-
  // based arc this replaces told the model to "push the boundary" from brew 4
  // and never to converge — measured on the real log, the next brew of a coffee
  // beat the previous one no more often than it lost (see the module header).
  const rawConvergence = deriveConvergence(sessionsForThisCoffee);

  // What this bag has already been brewed with — the Experiment occasion's
  // whole meaning is "push what you haven't tried on THIS coffee", so the
  // selector needs the brewers and references actually used on it.
  const brewedOnThisCoffee = {
    brewers: Array.from(
      new Set(sessionsForThisCoffee.flatMap((s) => Array.from(brewersFromMethod(resolveBrewedRecipe(s).method)))),
    ),
    basedOn: Array.from(
      new Set(
        sessionsForThisCoffee
          .map((s) => resolveBrewedRecipe(s).candidate?.basedOn?.trim() ?? "")
          .filter((b) => b && !/^own (recipe|experiment)$/i.test(b)),
      ),
    ),
  };
  // The SECOND candidate is ALWAYS the exploration slot (owner decision
  // 2026-10-03 — it used to open only from the 4th brew of a bag, or on the
  // Experiment occasion). The two-candidate portfolio is deliberately kept (a
  // third candidate is more waiting on every brew), so exploration lives inside
  // it: slot 1 converges or diverges on the last rating, slot 2 explores.
  const EXPLORATION_SLOT =
    "\nThe SECOND candidate is the exploration slot: something this coffee's log shows untried — a brewer this bag has not met, a variable never moved, or an Own experiment. Exploration means drawing something new OUT OF THIS BEAN: name the lever (a technique id from AVAILABLE TECHNIQUES, a different water, a pour-count change, a brewer with a different geometry) and what it should reveal; its experiment line names the thing being tried. The FIRST candidate stays the best-fit answer, so a disappointing experiment never costs the user their brew.";

  // The arc text itself is built further down, once the requested water is
  // known (a ≥4★ base scales to today's amount at the same ratio).
  const totalPercolationSamples = Object.values(timingStats).reduce(
    (n, v) => n + v.count,
    0
  );

  const amountGuide: Record<string, string> = {
    // WATER is the user's choice (they picked the drink size) — DOSE is not.
    // Naming a fixed dose here pinned the two headline numbers to the same pair
    // on every small brew: 23g:350g, forever, whatever the coffee or the
    // reference recipe said. The ratio belongs to the recipe being adapted
    // (Wölfl is 1:15.9, Medina 1:16.1, Kasuya 1:15), so the dose has to follow
    // from it. Capacity rules key off WATER, so nothing below changes.
    small:
      "target ~350g water. Dose = water ÷ the ratio of the reference you are adapting (typically 1:14–1:17, so ~21–25g) — state the ratio; do NOT default to a fixed 23g. Which brewers hold it, and what an AeroPress does about it, is in YOUR BREWERS TODAY.",
    big:
      "target ~450g water. Dose = water ÷ the ratio of the reference you are adapting (typically 1:14–1:17, so ~27–32g) — state the ratio; do NOT default to a fixed dose. Which brewers hold it is in YOUR BREWERS TODAY.",
    batch:
      "target ~750g water — a batch brewer (YOUR BREWERS TODAY says which hold it); dose = water ÷ the reference's ratio.",
    custom: context.customWaterMl
      ? (context.occasion === "summer-time"
          ? `ICED + custom volume: the user typed ${context.customWaterMl}ml as the FINAL drink (hot brew + melted ice). Split it as ~60% hot brew / ~40% ice — so waterGrams (hot brew portion) should target ~${Math.round((context.customWaterMl ?? 350) * 0.6)}g (±30g), and the recipe MUST set iceGrams ≈ ${Math.round((context.customWaterMl ?? 350) * 0.4)}g (the ice the hot brew drains onto). The pour sequence describes pouring the hot water; the ice sits in the server. Dose at ~1:15 against the FINAL drink, hot water + ice (so ~${Math.round((context.customWaterMl ?? 350) / 15)}g dose — Hoffmann's Japanese iced is 65 g/L of final drink, i.e. the hot water alone runs ~1:9). BOTH candidates respect this split AND both include iceGrams. Reference iced recipes from the corpus (Hoffmann Immersion Iced, AeroPress Iced) supply the TECHNIQUE — scale dose + water + ice proportionally. Capacity tensions with the chosen method are handled separately (USER OVERRIDE block).`
          : `target exactly ${context.customWaterMl}ml for BOTH candidates — tolerance is ±30ml, never more. The user typed this exact number. Reference recipes from the corpus (Kasuya 4:6, Hoffmann Better 1 Cup, Wölfl Orea Fast, etc.) supply the TECHNIQUE and ratio, NOT absolute numbers — scale the dose proportionally so waterGrams lands within 30ml of ${context.customWaterMl}. Default ratio 1:15 (so ${Math.round((context.customWaterMl ?? 350) / 15)}g dose / ${context.customWaterMl}g water). If a specific reference recipe calls for a different ratio (e.g. 1:14 for Wölfl, 1:16 for Medina), use its ratio but still scale to ~${context.customWaterMl}ml. Capacity tensions with the chosen method are handled separately (see HARD CAPACITY CONSTRAINT / USER OVERRIDE block). When the user has locked a method that's near or past the vessel's comfortable max for this volume, honor BOTH the method and the ml — flag the trade-off in reasoning, do not silently clamp the water.`)
      : "target ~350g water; dose = water ÷ the reference's ratio (state the ratio)",
    surprise:
      "SURPRISE MODE: full creative freedom on method and recipe — hard capacity limits still apply. Be adventurous.",
    open: "standard single cup (~350g water; dose = water ÷ the reference's ratio)",
  };
  // Cold brew: resolve the chosen amount to an explicit target so a custom
  // volume (e.g. 900ml) is honoured precisely — the small/big numbers and the
  // exact custom ml both flow through here.
  const coldBrewMl =
    context.amount === "custom"
      ? context.customWaterMl ?? null
      : context.amount === "big"
        ? 450
        : context.amount === "small"
          ? 350
          : null; // surprise → model's call
  const guide =
    context.occasion === "cold-brew"
      ? `COLD BREW batch. ${
          coldBrewMl
            ? `Target ~${coldBrewMl}ml total brew water for BOTH candidates (±30ml) — the user asked for this exact volume; scale dose to the recipe's ratio (e.g. 1:10 RTD → ${Math.round(coldBrewMl / 10)}g, 1:8 concentrate → ${Math.round(coldBrewMl / 8)}g).`
            : "Pick a sensible batch volume."
        } VESSEL BY VOLUME: ${
          coldBrewMl && coldBrewMl <= 450
            ? "a Clever (≤450ml) or a jar both work"
            : "this exceeds a Clever's 450ml — it MUST go in a jar / large immersion vessel (\"cold-brew-jar\")"
        }. A Clever holds MAX 450ml; an AeroPress is a ≤200ml concentrate only. NEVER put >450ml in a Clever or AeroPress. Concentrates (1:8 / 1:5) state the dilution in notes.`
      : (amountGuide[context.amount] ?? "target ~350g water; dose = water ÷ the reference's ratio");

  const sessionGrinder = context.grinder || preferences.grinder || "Niche Zero";
  const isNiche = sessionGrinder.toLowerCase().includes("niche");
  // Did he pick the grinder himself on the Context step? The picker writes ""
  // on toggle-off, so an empty string is the reliable "no pick" signal; the DB
  // row's grinder is a default, not a pick.
  const grinderPicked = Boolean(context.grinder && context.grinder.trim());
  const grinderNote =
    (isNiche
      ? `Grinder: ${sessionGrinder} → grindSize must be ONE specific Niche° value (e.g. "380°"). NO ranges. NEVER clicks.`
      : `Grinder: ${sessionGrinder} → grindSize must be ONE specific click count (e.g. "26"). NO ranges. NEVER Niche°.`) +
    (grinderPicked
      ? ` He picked this grinder himself for this brew — propose the other one (grinderSuggestion) only if you have a specific reason, phrased "you picked ${sessionGrinder}; the other would fit because …".`
      : ` This is the default, not his pick — you may propose the Comandante with a reason (grinderSuggestion, see COMANDANTE).`);

  const waterNote =
    context.waterSource === "championship"
      ? "Clarity blend (1:2 BWT-filtered + distilled = ~73ppm TDS, KH ~1.3°dH) — near-zero buffering, ideal for washed florals & championship methods"
      : context.waterSource === "diluted"
      ? "Diluted blend (legacy, ~150ppm) — soft, SCA-optimal for delicate light roasts"
      : "BWT-filtered daily water (~220ppm TDS, GH 5–6°dH, KH 4°dH) — moderate buffering; for delicate washed coffees note the clarity blend would lift brightness";

  // One freshness table for the app (src/lib/coffee/freshness.ts).
  const daysOld = daysSinceRoast(coffee.roastDate);
  const freshnessNoteText = freshnessNote(freshnessBucket(daysOld));

  const methodNote = context.preferredMethod
    ? `\nLOCKED METHOD: "${context.preferredMethod}" — the user has explicitly locked this brewer. BOTH candidates MUST use ${context.preferredMethod}. Do NOT swap to a different vessel for the second candidate. The two candidates contrast through substantially different RECIPE PHYSICS on the same brewer — different pour pattern (e.g. 4:6 vs Rao thirds vs single continuous), different ratio (e.g. 1:15 vs 1:17), different (but each constant) temperature (e.g. 95°C vs 88°C — never a staged ramp within one brew), different agitation profile, inverted vs upright (AeroPress), bypass vs no-bypass, immersion-then-drain vs full-percolation, etc. The first candidate is still the best-fit (or convergence) answer, the second the exploration. Override the lock only if genuinely incompatible with the coffee chemistry (rare). If the amount is at or past this vessel's limit (YOUR BREWERS TODAY says so), honour BOTH the brewer and the amount and name the trade-off in whyChosen — never silently clamp the water or swap the vessel.`
    : "";

  // The Drip Assist disc is used only when HE locks it (owner rule, kept).
  const dripAssistLocked =
    context.preferredMethod && /drip\s*-?\s*assist/i.test(context.preferredMethod);
  const dripAssistNote = dripAssistLocked
    ? `\nDRIP ASSIST: he locked the disc for this brew. Grind ~5° coarser than the bare V60 (the "V60 + Drip Assist" row in the NICHE° GRIND REFERENCE). Name the brewer exactly "V60 + Drip Assist".`
    : `\nDRIP ASSIST: not locked for this brew, so no candidate uses the disc (he decides when it is on). Name a V60 simply "V60".`;

  const goal = context.intent || "balanced";
  const goalNote = `\nGOAL: "${goal}" — what he asked for in this brew. See GOAL VOCABULARY in LAYER 1 for what it means and how it interacts with process defaults.`;


  // Roaster prior injection — user-saved profile overrides built-in list
  const roasterPrior = userRoasterPrior ?? getRoasterPrior(coffee.roaster || "");
  const roasterBlock =
    roasterPrior.confidence !== "fallback"
      ? `\n${formatRoasterPriorForPrompt(roasterPrior)}`
      : "";

  // Coffee tasting-history block — what the user has actually tasted vs.
  // what the bag claims. Populated weekly by /api/coffees/compact and only
  // present for coffees with ≥2 logged sessions.
  const historyBlock = (() => {
    if (!coffeeHistory) return "";
    const lines: string[] = [
      "\nYOUR TASTING HISTORY FOR THIS COFFEE — aggregated across your logged sessions of this exact bag. Compare against the bag's claimed tasting notes (above): when they diverge, the divergence is the signal. Use this to inform the hypothesis, not to override the bag's variety/process facts.",
    ];
    if (coffeeHistory.commonNotes?.length) {
      lines.push(`- Notes you typically taste: ${coffeeHistory.commonNotes.join(", ")}`);
    }
    if (coffeeHistory.writtenSummary) {
      lines.push(`- Brew memory: ${coffeeHistory.writtenSummary}`);
    }
    return lines.length > 1 ? lines.join("\n") : "";
  })();

  // THIS COFFEE'S OWN COACH CARD (coffees.coach_insight, migration 0015). Shown
  // on /coffees/[id] and as the Context-step reminder pill since June 2026 but,
  // until 2026-10-03, never handed to the recommender — the one per-coffee note
  // the user may have confirmed was invisible to the surface writing its recipe.
  const coachCardBlock = coffeeHistory?.coachCard
    ? `\nTHIS COFFEE'S COACH CARD [${coffeeHistory.coachCard.status.toUpperCase()}${
        coffeeHistory.coachCard.status === "confirmed"
          ? " by the user — a standing rule for THIS bag"
          : coffeeHistory.coachCard.status === "trying"
            ? " — the user saved this to test on this bag; the FIRST candidate should honour it when it applies"
            : " — unverified"
      }]: ${coffeeHistory.coachCard.observation} ${coffeeHistory.coachCard.suggestion}`
    : "";

  // COACH INSIGHTS — the general coach's observations over the full
  // session corpus (see src/lib/claude/insights.ts): the user's technique,
  // habits and taste preferences, counted across bags, never about one
  // coffee. The suggestion line is a general move or a precise test question.
  //
  // Ordering: insights whose citationFields overlap the current brew's
  // attributes (variety, process, roastLevel, origin, method) come
  // first — they're the most directly applicable. Then the rest by
  // recency.
  // COACH INSIGHTS with the user's verdicts carried through (insightsBlock.ts).
  // Status-first ranking (confirmed → trying → new), then overlap with this brew.
  const insightsBlock = formatInsightsBlock(insights, coffee, context);

  // MEASURED BREW FEEDBACK — the post-rating clarification answers + the
  // objective Acaia pour measurements, injected DIRECTLY (2026-08-18, owner
  // Go). Until now both signals reached /recommend only via the lagged
  // coach-insight rows; buildHistorySummary carries them too but feeds only
  // loading-insights/refresh. "" when no session carries either signal.
  const measuredFeedbackBlock = buildMeasuredFeedback(pastSessions, coffee);

  // ── Knowledge layer injection ──────────────────────────────────────────
  // Three structured blocks selected per turn:
  //   1. Variety priors — what genetics tell us (WCR-grounded)
  //   2. Reference recipes — top-N selections from the championship +
  //      reference corpus, scored against this brew
  //   3. Available techniques — atomic-move vocabulary for composition
  // The brain reads these alongside the embedded science blocks in the
  // system prompt and either selects, adapts, or composes.

  const varietyPriors = getVarietyPriorsForBag(coffee.variety);
  const varietyBlock = varietyPriors.length
    ? `\n${formatVarietyPriorsForPrompt(varietyPriors)}`
    : "";

  const targetWaterMl =
    context.amount === "custom"
      ? (context.customWaterMl ?? 350)
      : context.amount === "big"
        ? 450
        : context.amount === "small"
          ? 350
          : context.amount === "batch"
            ? 750
            : undefined;

  // The Context step's free text (userRequest.ts). Water and a required brewer
  // were already folded into `context` by run.ts; here the recipe mention is
  // resolved against the corpus and the exclusions take effect.
  const userReq = opts.userRequest?.raw ? resolveUserRequest(opts.userRequest, targetWaterMl) : null;
  const requestedRecipe = userReq?.recipe ?? null;
  const excludedBrewers = userReq?.excludedBrewerTypes ?? new Set<BrewerType>();
  if (userReq) {
    console.log(
      `[recommend] user-request parsed=${userReq.parsed} recipe=${requestedRecipe?.id ?? "none"} unresolved=${userReq.unresolvedMentions.length} ` +
        `excluded=[${userReq.excludeBrewers.join(",")}] required=${userReq.requireBrewer ?? "none"} params=${Object.keys(userReq.params).join(",") || "none"}`,
    );
  }
  // Already shown in this flow → off the menu (a hard filter), named up front,
  // and repaired if a candidate repeats one anyway (shownGuard.ts).
  const shown = opts.shown ?? [];
  const shownIds = shownReferenceIds(shown, resolveReference);
  if (requestedRecipe) shownIds.delete(requestedRecipe.id);

  // ONE rotation seed for the whole turn: the recipe menu and the brewer-
  // freshness demotion must rotate together, or the two levers fight each other.
  //
  // Base is the newest logged session's timestamp (it strictly increases with
  // every brew; the session COUNT saturates at the client's cap and froze the
  // rotation — the #480 regression), mixed with a per-REQUEST component so
  // asking again gives a fresh menu instead of a byte-identical one. Fit still
  // decides: every use of this seed is tie-scoped.
  const rotationSeed = deriveRotationSeed(
    pastSessions.reduce((m, s) => {
      const t = Date.parse(s.createdAt ?? "");
      return Number.isFinite(t) ? Math.max(m, t) : m;
    }, 0) || pastSessions.length,
    Date.now(),
  );

  // BREWER RECENCY — information, never a demotion (methodRotation.ts): how
  // many brews ago each brewer was last offered or brewed. The menu lets the
  // least recently offered brewers lead with their full recipe text.
  const recency = brewerRecency(pastSessions);

  // Union the stored onboarding equipment with the owner's canonical kit.
  // The onboarding picker never offered Origami or Chemex, so keying off the
  // saved row alone silently filtered out every Origami/Chemex recipe before
  // scoring. Single-user app — the canonical kit is the real, authoritative
  // equipment list (see CLAUDE.md). Method-lock filtering still narrows from here.
  const brewersAvailable = new Set(
    Array.from(
      brewersAvailableFromEquipment([
        ...(preferences.equipment ?? []),
        ...CANONICAL_EQUIPMENT,
      ]),
    ).filter((b) => !excludedBrewers.has(b)),
  );
  // If the user locked a method in the flow, hard-filter recipe selection to
  // that method so the prompt only carries recipes for the brewer they chose.
  const lockedBrewers = brewersFromMethod(context.preferredMethod);

  // The effective convergence state for THIS turn. A locked method that is not
  // the base's brewer, or a change of partition (hot ⟷ cold brew ⟷ iced) since
  // the base was brewed, means there is nothing to reproduce or avoid: fall back
  // to best fit for the first candidate (the "unrated" arc).
  const partitionOf = (occasion?: string) => {
    const o = (occasion ?? "").toLowerCase();
    return o === "cold-brew" ? "cold" : o === "summer-time" ? "iced" : "hot";
  };
  const convergence: ConvergenceState = (() => {
    const c = rawConvergence;
    if (c.kind !== "converge" && c.kind !== "diverge") return c;
    const base = c.kind === "converge" ? c.base : c.last;
    if (lockedBrewers.size > 0) {
      const baseBrewers = brewersFromMethod(base.method);
      if (!Array.from(baseBrewers).some((b) => lockedBrewers.has(b))) return { kind: "unrated", count: c.count };
    }
    if (partitionOf(base.occasion) !== partitionOf(context.occasion)) return { kind: "unrated", count: c.count };
    // The user named a recipe, or excluded the base's brewer: their words win.
    if (requestedRecipe) return { kind: "unrated", count: c.count };
    if (usesExcludedBrewer(base.method, excludedBrewers)) return { kind: "unrated", count: c.count };
    // Back-and-ask-again: a ≥4★ reproduction on that brewer was already shown
    // in this flow; re-forcing it is exactly the repetition the user reported.
    if (c.kind === "converge" && shown.some((x) => brewMethodKey(x.method) === brewMethodKey(base.method))) {
      return { kind: "unrated", count: c.count };
    }
    return c;
  })();
  const convergeBase = convergence.kind === "converge" ? convergence.base : null;
  // THE MENU (menu.ts, 2026-10-19): every owned brewer on the table, each
  // with its best-fit recipe, the factor to today's amount, the reach path
  // when the vessel is smaller than the amount, and when it was last offered.
  // No batch window, no vessel filter, no brewer cap, no Special ceiling —
  // those are information the model reads. The least recently offered
  // brewers lead with full recipe text; the rest are index lines in the
  // cached system block.
  const menuInput = {
    brewersAvailable,
    lockedBrewers,
    // The Drip Assist disc, when HE locked it, cannot honour a designed long
    // steep / rest (owner: "das macht mit der Disc keinen Sinn"). Immersion
    // is exempt inside the selector.
    excludeLongWaits: Boolean(dripAssistLocked),
    roastLevel: normaliseRoastLevel(coffee.roastLevel),
    process: normaliseProcess(coffee.process),
    // Blend: score the process match against EVERY component's process.
    processes: Array.from(
      new Set(
        componentsOf(coffee)
          .map((c) => normaliseProcess(c.process))
          .filter((p): p is NonNullable<typeof p> => !!p),
      ),
    ),
    variety: coffee.variety,
    goal: normaliseGoal(context.intent),
    occasion: context.occasion,
    rotationSeed,
    recentReferenceNames: recentReferenceNames(pastSessions),
    brewedOnThisCoffee,
    excludeRecipeIds: shownIds,
    targetWaterGrams: context.occasion === "cold-brew" ? undefined : targetWaterMl,
    lastOffered: recency.lastOffered,
  };
  let menu = buildBrewerMenu(menuInput);
  // A locked brewer the corpus has NO documented recipe for: show the nearest
  // recipes on the other brewers (by fit) and tell the model to adapt by
  // geometry rather than invent.
  const lockedMethodHasNoRecipe = menu.locked && menu.leads.length === 0;
  if (lockedMethodHasNoRecipe) {
    menu = buildBrewerMenu({ ...menuInput, lockedBrewers: new Set(), leadCount: 3 });
  }

  // MEASURED GRIND — the user's OWN logged grind settings for the brewers they
  // actually use at this batch size (2026-08-23). Every per-method row in
  // grindSettings.ts except the V60 is an ESTIMATE, while brew.grindSettingUsed
  // has recorded the real thing on every brew. Reported, never enforced: grind
  // is bean-dependent, so a deterministic override would flatten exactly the
  // variation a recipe exists to express. "" when nothing is measured.
  const measuredGrindBlock = formatMeasuredGrindForPrompt(
    buildMeasuredGrind(pastSessions, targetWaterMl, context.preferredMethod),
    sessionGrinder,
  );
  // MEASURED POUR PACE — his delivered pour rate off the Acaia (2026-10-10).
  // The prompt used to state "4 g/s" as his pace; it was never measured. Only
  // once measured: the house fallback is not a fact about him.
  const pace = measuredPourPace(pastSessions, context.preferredMethod);
  const measuredPaceBlock = pace.source === "house" ? "" : `\n\n${formatPourPaceForPrompt(pace)}`;


  // The recipe the user asked for by name leads, whatever the scorer thought of
  // it (batch window included — it is scaled to this brew and labelled).
  const requestedScaledNote =
    requestedRecipe && targetWaterMl && !referenceAppliesAtBatch(requestedRecipe, targetWaterMl)
      ? `published at ${requestedRecipe.water.grams} g, scaled to your ${targetWaterMl} g on request`
      : undefined;
  const requestedBlock = requestedRecipe
    ? `\nREQUESTED RECIPE — he asked for this one by name; the FIRST candidate adapts it:\n0. ${formatRecipeForPrompt(requestedRecipe, {
        scaleTo: targetWaterMl ? { targetWaterGrams: targetWaterMl, method: context.preferredMethod } : undefined,
        grinder: sessionGrinder,
        label: requestedScaledNote ? `(${requestedScaledNote})` : undefined,
      })}\n`
    : "";
  const menuBlock =
    `\n${lockedMethodHasNoRecipe ? `(No documented recipe exists specifically for ${context.preferredMethod}. The recipes below are the closest matches on your other brewers — adapt the nearest to the ${context.preferredMethod}, keeping its filter geometry. Do NOT invent parameters.)\n` : ""}` +
    formatMenuForPrompt(menu, { grinder: sessionGrinder, method: context.preferredMethod, lockedMethod: context.preferredMethod }) +
    requestedBlock;
  const menuRecipeNames = [
    ...(requestedRecipe ? [requestedRecipe] : []),
    ...menu.leads.flatMap((e) => (menu.locked ? e.recipes.slice(0, 5) : e.best ? [e.best] : []).map((s) => s.recipe)),
  ].flatMap((r) => [r.name, ...(r.shortName ? [r.shortName] : [])]);

  // The user's own well-rated brews, offered as references beside the corpus.
  // Scoped to the brewers this session may actually use — a locked method
  // narrows it — so a great Chemex brew isn't dangled at a locked-V60 turn.
  const ownReferencesForTurn = buildOwnReferences(
    pastSessions,
    coffee,
    lockedBrewers.size > 0
      ? new Set(Array.from(lockedBrewers).map((b) => brewMethodKey(b)))
      : undefined,
  );
  const ownReferenceNamesForTurn = ownReferencesForTurn.map((r) => r.name);
  const ownReferenceBlock = formatOwnReferencesForPrompt(ownReferencesForTurn);

  // Compact technique vocabulary — id + one-line description per technique.
  // The full mechanism for each is reachable via the recipe's `science`
  // field; this block exists so the brain has a vocabulary to compose with
  // when no recipe matches exactly.
  const techniquesBlock =
    "\nAVAILABLE TECHNIQUES (atomic moves you can compose with — cite by id when adapting a recipe):\n" +
    TECHNIQUES.map((t) => `  - ${t.id}: ${t.description}`).join("\n");

  // Blend note — appended to the user message ONLY when this bag is a real
  // blend (2+ components). For every single-origin bag the message is
  // byte-identical to before, so non-blend behaviour (and the prompt cache) is
  // unchanged.
  const blendDesc = describeBlend(coffee);
  const blendNote = blendDesc
    ? `\nBLEND — this bag is ${componentsOf(coffee).length} components: ${blendDesc}. There is no single origin or process. Reason about the composite cup: extract to serve the component that needs the MOST care (typically the lightest-roasted / washed / most delicate one) without under-serving the others, and name that trade-off in your reasoning. Do not treat it as a single-origin of just one component.`
    : "";

  // THIS COFFEE'S LAST BREW — information (convergence.ts): the last brew as
  // brewed, its rating, what he tasted; both honest answers named, his call.
  const sessionArcNote = formatConvergenceInfo(convergence, { targetWaterGrams: targetWaterMl, grinder: sessionGrinder }) + EXPLORATION_SLOT;

  // Chemex grind (measuredChemex.ts): the owner's MEASURED Chemex brews at
  // this batch + Chemex's own published rule — never a table or V60-scaled
  // number (no source publishes one for this batch).
  const chemexMeasured =
    targetWaterMl && brewersAvailable.has("chemex") && context.occasion !== "cold-brew"
      ? measuredChemexAtBatch(pastSessions, targetWaterMl)
      : null;
  // With the owner's own slope (grindSlope.ts) the Chemex setting for the
  // PUBLISHED 750–800 g target (4:00–5:00 total: Baratza 50 g / 800 g "four and
  // a half to five minutes", Barefoot 50 g / 750 g ~4:00) is computed, not guessed.
  const chemexInterp =
    chemexMeasured && targetWaterMl && batchWithinWindow(750, targetWaterMl)
      ? [interpolateGrind(pastSessions, "Chemex", targetWaterMl, 240), interpolateGrind(pastSessions, "Chemex", targetWaterMl, 300)]
      : null;
  const chemexInterpLine =
    chemexInterp && chemexInterp[0] && chemexInterp[1]
      ? `\n- COMPUTED from the owner's slope (${chemexInterp[0].slope.secPerDeg.toFixed(1)} s/° over ${chemexInterp[0].slope.pairs.length} measured pairs), from his ${chemexInterp[0].from.date} brew at ${grindInUnit(Math.round(chemexInterp[0].from.deg), sessionGrinder)} → ${Math.round(chemexInterp[0].from.totalSec)} s: the published 4:00–5:00 total lands at ${grindInUnit(Math.min(chemexInterp[0].deg, chemexInterp[1].deg), sessionGrinder)}–${grindInUnit(Math.max(chemexInterp[0].deg, chemexInterp[1].deg), sessionGrinder)}. A value in that window is a computed setting, not a measurement brew.`
      : "";
  const chemexGrindNote =
    chemexMeasured && targetWaterMl ? formatMeasuredChemexBlock(chemexMeasured, targetWaterMl, sessionGrinder) + chemexInterpLine : "";
  const grindSlopeBlock = formatGrindSlopeBlock(pastSessions, targetWaterMl, sessionGrinder);
  const preferencesBlock = formatPreferencesForRecommend(preferences);
  const equipmentForPrompt = excludedBrewers.size
    ? equipment.split(", ").filter((e) => !usesExcludedBrewer(e, excludedBrewers)).join(", ")
    : equipment;
  const userRequestBlock = userReq ? formatUserRequestBlock(userReq, requestedScaledNote) : "";
  const shownBlock = formatShownUpfront(shown);

  const userMessage = `Coffee: ${coffee.name || "Unknown"} by ${coffee.roaster || "Unknown roaster"}
Origin: ${coffee.origin || "Unknown"}${coffee.region ? `, ${coffee.region}` : ""}${coffee.variety ? ` · Variety: ${coffee.variety}` : ""}
Process: ${coffee.process || "Unknown"}${coffee.fermentationStyle ? ` (${coffee.fermentationStyle})` : ""} | Roast: ${coffee.roastLevel || "Unknown"}${coffee.cuppingScore ? ` | Score: ${coffee.cuppingScore}` : ""}${blendNote}
Roast date: ${coffee.roastDate ?? "unknown"}${daysOld !== null ? ` (${daysOld} days — ${freshnessNoteText}). The bloom for this age is YOURS to write — the app no longer shifts it by roast date; for reference its old table was ~50 s under 7 days, ~45 s at peak, ~30 s past three weeks. A recipe whose first pour is a pour (Kasuya) keeps it a pour.` : ""}
Bag tasting notes: ${coffee.tastingNotesFromBag?.join(", ") || "none listed"}
${roasterBlock}${historyBlock}${coachCardBlock}${insightsBlock}${measuredFeedbackBlock}
Context:
- Occasion: ${context.occasion}
- Amount: ${context.amount} (${guide})
- Time available: ${context.timeAvailable}
- Grinder: ${sessionGrinder}
- Water: ${waterNote}${specialTimeNote(context.timeAvailable)}${methodNote}${dripAssistNote}${goalNote}${chemexGrindNote}${userRequestBlock}${shownBlock}

Equipment available: ${equipmentForPrompt}
${grinderNote}${preferencesBlock}

${escherTerrain
  ? `Brew pattern terrain (use as case history — informs your hypothesis, does not override recipe physics):\n${escherTerrain}`
  : pastSessions.length === 0
    ? "No previous sessions — first brew ever logged. Reason from coffee properties and roaster prior only."
    : `${pastSessions.length} sessions logged. Terrain analysis not available for this request.`
}
${sessionArcNote}
${recency.line}${measuredGrindBlock}${grindSlopeBlock}${measuredPaceBlock}
${
  totalPercolationSamples > 0
    ? `\nTIMING CALIBRATION — per method (grind adjustment only — never temperature):\n` +
      Object.entries(timingStats)
        .map(([method, { delta, count }]) => {
          const stepText = (deg: number) =>
            isComandante(sessionGrinder) ? `about ${Math.max(1, Math.round(deg / 3.33))} click${Math.round(deg / 3.33) === 1 ? "" : "s"}` : `${deg}°`;
          const direction =
            delta > 20
              ? `→ grind ${stepText(Math.ceil(delta / 15))} coarser`
              : delta < -20
              ? `→ grind ${stepText(Math.ceil(-delta / 15))} finer`
              : "→ well-calibrated";
          return `  ${method}: avg ${delta > 0 ? "+" : ""}${delta}s vs target (${count} brew${count !== 1 ? "s" : ""}) ${direction}`;
        })
        .join("\n") +
      "\nApply the relevant row only when recommending that specific method."
    : ""
}

${varietyBlock}${menuBlock}${ownReferenceBlock}${techniquesBlock}

pourSteps — the structured step array IS the recipe's pour plan (do not write a separate pour-sequence string; the app derives it). It is what the in-app timer advances through step by step, so it must be complete and ordered.
- One object per physical step the brewer performs, in order.
- action: one of bloom | pour | final | stir | swirl | wait | press | invert | flip | drain | bypass | melodrip | agitate-bed
- waterGramsAtEnd: cumulative water in the brewer after a POUR step (omit on non-pour steps).
- durationSec: how long the step takes, and the timer USES IT. Required on every step. A pour's seconds are kept when they are a real pour (2–8 g/s); over 8 g/s the app stretches it to 8; under 2 g/s or missing it pours at the user's MEASURED pace (the MEASURED POUR PACE line above, 4 g/s without one). A verified reference you adapt keeps its AUTHOR'S cadence: every pour starts where the author starts it. Your WAIT steps are kept exactly as written. Immersion / AeroPress: the timed (non-setup) steps MUST sum to targetTimeSec.
- temperatureC: omit on every step. BrewLog brews at ONE constant temperature (the recipe's waterTempC) — never stage or ramp temperature across pours.
- Do NOT emit notes on steps — the app supplies per-step hints. label + action + waterGramsAtEnd + durationSec is the whole step.
- AGITATION IS AN EXPLICIT STEP, NOT A NOTE — and it must MIRROR the recipe you adapt. If the recipe you name in basedOn shows agitation in its pour sequence above — a bloom swirl, a between-pour stir, and ESPECIALLY a settle swirl/tap right before the drawdown — carry EACH of those into pourSteps as its own step ("action": "stir" | "swirl" | "agitate-bed") at the same point in the sequence. The end-of-brew settle swirl/tap (the one that flattens the bed just before drawdown) is part of the recipe — do NOT drop it; emit it as the last step before the "drain"/drawdown. The brew screen shows a stir/swirl prompt ONLY where such a step exists, so a dropped agitation step = a missing prompt mid-brew. EXCEPTION — explicitly minimal/reduced-agitation recipes (Orea Apex/Open, Origami, Chemex/Moccamaster post-bloom, or any recipe whose notes say "minimal/reduced agitation"): include NO agitation steps beyond what that recipe itself calls for — never add a trailing swirl such a recipe doesn't want.
- Immersion/AeroPress: the steep is a single "wait" step carrying its full durationSec; the inverted setup is an "invert" step (durationSec 0); the flip-and-press is a "flip" or "press" step placed right after the steep.
- PERCOLATION STRUCTURE (V60, Orea, Origami, Kalita, Chemex — anything you pour through a bed): pourSteps are the pours, the agitation the reference calls for, AND the pauses between them as "wait" steps. Write the pauses — the timer runs your cadence, so without them the pours run back-to-back (a recipe with no pauses at all gets 30 s ones, said so). A normal pause is 10–45 s. Do NOT emit a trailing "Drawdown" wait: the drawdown is NOT yours to set — it is the user's MEASURED drawdown on this exact brewer at this amount (or, without one, the corpus median, labelled as an estimate); the app composes the total from your steps plus that drawdown and shows where the number comes from. targetTimeSec is your estimate of the whole brew and is replaced by that total. Keep the pour count of the reference you adapt (a bigger batch means bigger pours, not more of them); add one only if a pour would otherwise need more than 8 g/s. The bloom is 2–3× the dose (e.g. 45–70 g for a ~23 g dose) — never a large fraction of the total water.

basedOn — name the reference this candidate adapts: a recipe from the FULL TEXT in YOUR BREWERS TODAY (named exactly as written there), any recipe from the REFERENCE RECIPE INDEX in the system prompt (its exact name — then its pours are yours to reconstruct from the index line and the brewer rules, said so in whyChosen), or one of the user's own well-rated brews (e.g. "Your Orea V4 Classic — DAK Berry Swirl (12 Aug 2026)"). If you designed the recipe yourself, set "Own experiment" — a legitimate answer with its own rules (see BASED-ON in the system prompt), not a fallback, and always better than reconstructing a published recipe from memory.

RECIPE FIELD CONSISTENCY — the recipe's structured fields ARE the brew the user makes; the app shows them as the headline and feeds pourSteps to the timer. They must all describe ONE recipe:
- doseGrams / waterGrams / waterTempC / grindSize / targetTimeSec are the recipe you are actually instructing. When you adapt a reference recipe, put the ADAPTED numbers here — NEVER leave the reference recipe's published dose/water/temp in these fields while the pourSteps and prose describe a different brew. (The failure to avoid: header reads 18g:225g:93°C copied from the reference, while the pour plan pours to 230g and the rationale says "1:15.3 at 90°C" — three different recipes in one candidate.)
- waterGrams MUST equal the final cumulative waterGramsAtEnd of your last water-adding pour (bloom/pour/final/melodrip — NOT bypass, which is separate dilution). The pourSteps milestones and waterGrams must agree to the gram.
- doseGrams and waterGrams must match any ratio you state in whyChosen / reasoning (a "1:15.3" claim means waterGrams ≈ doseGrams × 15.3). waterTempC must match any temperature you mention in the prose. Compute the prose from the fields, never the reverse.

CANDIDATE TITLES must be DISTINCT across the candidates in one response — the two candidates are different experiments, so they must read as different on the chip selector and the brew screen. Never give two candidates the same title (e.g. two "Inverted Long Immersion"); name each for the variable it tests.

Return valid JSON only.`;

  const cachedBlocks = [formatRecipeIndexBlock()];
  const first = await callRecommendModel(userMessage, { cachedBlocks });
  let usage = { ...first.usage, calls: 1 };

  let raw = parseClaudeJson(first.text, RecommendationResponseSchema);
  if (!raw) {
    // One retry on unparseable JSON (2026-10-19; it used to throw outright).
    console.warn("[recommend] first answer did not parse — one retry");
    const again = await callRecommendModel(userMessage + "\n\nYour previous answer was not valid JSON. Return the complete JSON again, valid JSON only.", { cachedBlocks });
    usage = { input_tokens: usage.input_tokens + again.usage.input_tokens, output_tokens: usage.output_tokens + again.usage.output_tokens, calls: 2 };
    raw = parseClaudeJson(again.text, RecommendationResponseSchema);
    if (!raw) throw new Error("Failed to parse recommendation from Claude");
  }

  // Did the model actually use the menu it was given? Nothing checked this
  // before, which is why the menu could measurably rotate while the candidates
  // stayed the same — the model was free to reach past it for whatever was most
  // salient. Never an exclusion (best fit decides, nothing is banned); this is
  // the signal that tells us whether rotating the menu can help at all.
  const menuNames = menuNamesOf(
    menuRecipeNames.map((name) => ({ recipe: { name } })),
    convergeBase ? [...ownReferenceNamesForTurn, convergeBase.name] : ownReferenceNamesForTurn,
  );

  // ONE repair round, for the two things only the user's own words decide
  // (2026-10-19: the repeat, convergence, shown and Chemex repairs are gone —
  // preferences and history are information the model weighs).
  const repairs: string[] = [];
  const excludedUsed = raw.candidates
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => usesExcludedBrewer(c.method, excludedBrewers));
  if (excludedUsed.length) {
    console.warn(`[recommend] user-request: ${excludedUsed.map(({ c }) => `"${c.title}" (${c.method})`).join("; ")} on an excluded brewer — one repair round`);
    repairs.push(
      `\n\nREPAIR — EXCLUDED BREWER. The user excluded ${userReq?.excludeBrewers.join(", ")}:\n${excludedUsed
        .map(({ c, i }) => `- Candidate ${i + 1} "${c.title}" uses ${c.method}.`)
        .join("\n")}\nReplace ONLY those candidate(s) with a recipe on a brewer the user did not exclude; keep any other candidate exactly as it was.`,
    );
  }
  const requestMissed =
    requestedRecipe && resolveReference(raw.candidates[0]?.basedOn)?.id !== requestedRecipe.id;
  if (requestMissed && requestedRecipe) {
    console.warn(`[recommend] user-request: candidate 1 basedOn "${raw.candidates[0]?.basedOn ?? "none"}" is not the requested ${requestedRecipe.id} — one repair round`);
    repairs.push(
      `\n\nREPAIR — REQUESTED RECIPE. The user asked for "${requestedRecipe.name}". The FIRST candidate must adapt exactly that recipe (basedOn "${requestedRecipe.name}", entry 0 under REQUESTED RECIPE). Keep the second candidate as it was unless it is the same recipe.`,
    );
  }
  if (repairs.length) {
    try {
      const second = await callRecommendModel(
        userMessage + repairs.join("\n") + "\n\nReturn the complete JSON again.",
        { cachedBlocks },
      );
      usage = {
        input_tokens: usage.input_tokens + second.usage.input_tokens,
        output_tokens: usage.output_tokens + second.usage.output_tokens,
        calls: usage.calls + 1,
      };
      const repaired = parseClaudeJson(second.text, RecommendationResponseSchema);
      if (repaired) {
        raw = repaired;
      } else {
        console.warn("[recommend] repair answer did not parse — keeping the first answer");
      }
    } catch (err) {
      console.warn(
        `[recommend] repair call failed — keeping the first answer: ${String((err as Error)?.message ?? err).slice(0, 160)}`,
      );
    }
  }
  if (convergence.kind === "converge" || convergence.kind === "diverge") {
    const base = convergence.kind === "converge" ? convergence.base : convergence.last;
    const first0 = raw.candidates[0];
    console.log(
      `[recommend] last brew ${base.rating}★ on ${base.method} — candidate 1 is ${first0?.method} (basedOn "${first0?.basedOn ?? "none"}"): ${
        brewMethodKey(first0?.method) === brewMethodKey(base.method) ? "builds on it" : "goes elsewhere"
      }`,
    );
  }

  for (const c of raw.candidates) {
    if (!isInMenu(c.basedOn, menuNames)) {
      console.warn(
        `[recommend] basedOn "${c.basedOn}" is not in this turn's menu (${menuNames.length} names offered)`,
      );
    }
  }

  if (excludedBrewers.size) {
    const allowed = raw.candidates.filter((c) => !usesExcludedBrewer(c.method, excludedBrewers));
    if (allowed.length && allowed.length < raw.candidates.length) {
      console.warn(`[recommend] user-request: dropped ${raw.candidates.length - allowed.length} candidate(s) still on an excluded brewer after repair`);
      raw = { ...raw, candidates: allowed };
    }
  }

  const mapped: RecommendationCandidate[] = raw.candidates.map((c) => ({
    method: c.method,
    recipe: guardRecipeFidelity(sanitizeRecipe(c.recipe), c.basedOn, c.title, c.method, daysOld),
    role: c.role as CandidateRole,
    title: c.title,
    ...(c.basedOn ? { basedOn: c.basedOn } : {}),
    whyChosen: c.whyChosen,
    ...(c.experiment ? { experiment: c.experiment } : {}),
    confidence: c.confidence as CandidateConfidence,
    // Raw proposal; made real (or dropped) by attachGrinderSuggestion after
    // the user's own numbers and the grind-unit pass.
    ...(c.grinderSuggestion
      ? { grinderSuggestion: { grinder: c.grinderSuggestion.grinder as "Comandante C40" | "Niche Zero", reason: c.grinderSuggestion.reason, grindSize: "" } }
      : {}),
  }));

  // What is left of the guard chain (2026-10-19): physics and the owner's own
  // rules — the water fits the vessel, the disc only when he locked it, a
  // VERIFIED reference's agitation stays as published, his typed numbers win,
  // the grind is in his grinder's unit. Nothing here encodes a preference.
  //   4. Agitation a model ADDED to a minimal-agitation brewer's recipe when a
  //      VERIFIED reference says otherwise. Without a verified reference the
  //      model's agitation stands (it is its own recipe).
  const deSwirled = stripMinimalAgitationSwirls(mapped, (basedOn) => {
    const ref = resolveReference(basedOn);
    return ref?.verified ? ref : null;
  }).map((c, i) => (resolveReference(c.basedOn)?.verified ? c : mapped[i]));

  //   -1. BATCH WINDOW. A candidate that names a reference published for a
  //       batch this brew is not within ±20 % of is not that recipe (owner
  //       decision 2026-10-10; src/lib/recipe/batchWindow.ts). The menu no
  //       longer offers such a reference, but the model can still reach for
  //       one from memory. The recipe stays; the name stops claiming a
  //       published recipe at a size it was never published for.
  const batchChecked = deSwirled.map((c) => {
    const ref = resolveReference(c.basedOn);
    const water = c.recipe?.waterGrams;
    if (!ref || !(typeof water === "number" && water > 0) || referenceAppliesAtBatch(ref, water)) return c;
    // The user asked for this recipe by name: keep the name, say it was scaled.
    const relabel =
      requestedRecipe && ref.id === requestedRecipe.id
        ? `${ref.name} (scaled from ${ref.water.grams} g on request)`
        : `Own recipe (after ${ref.shortName || ref.name}, published at ${ref.water.grams} g)`;
    console.warn(
      `[recommend] batch window: "${c.title ?? c.method}" basedOn "${c.basedOn}" is published at ${ref.water.grams} g, ` +
        `this brew pours ${Math.round(water)} g — relabelled "${relabel}"`,
    );
    return { ...c, basedOn: relabel };
  });

  //   0a. PHYSICS. The recipe's own numbers have to hold together — milestones
  //       that increase, a headline water that matches the pour plan, no pour
  //       scheduled faster than anyone pours. A recipe whose milestones go
  //       backwards has no honest repair and is dropped.
  const physicsChecked = batchChecked.map((c) => {
    const res = enforceRecipePhysics(c.recipe, { method: c.method });
    for (const change of res.changes) {
      console.warn(`[recommend] physics: "${c.title ?? c.method}" ${change}`);
    }
    return { candidate: { ...c, recipe: res.recipe }, dropped: res.dropped, title: c.title };
  });
  const physicsKept = physicsChecked.filter((r) => !r.dropped);
  if (physicsKept.length < physicsChecked.length) {
    physicsChecked
      .filter((r) => r.dropped)
      .forEach((r) => console.warn(`[recommend] physics: dropped "${r.title}" — not brewable`));
  }
  const deSwirledSafe = (physicsKept.length ? physicsKept : physicsChecked).map((r) => r.candidate);

  const capped = guardVesselCapacity(deSwirledSafe);
  const discGuarded = stripProactiveDripAssist(capped, Boolean(dripAssistLocked));

  //   5. THE TIMELINE — composed ONCE (src/lib/brew/composeTimeline.ts,
  //      2026-10-19): a verified reference keeps its author's cadence and
  //      published drawdown; otherwise the model's steps as written, pours
  //      without plausible seconds at the owner's measured pace, waits kept
  //      exactly; the drawdown from his measured brews on this EXACT brewer
  //      (same roast-age bucket when he has three), else the corpus median at
  //      this size, labelled. The clock IS finishSec; the client shows this
  //      object verbatim and the session snapshots it on Done.
  const composed = discGuarded.flatMap((c) => {
    const res = composeTimeline(c.recipe, { method: c.method, basedOn: c.basedOn, pastSessions, roastDate: coffee.roastDate });
    if (!res.ok) {
      console.warn(`[recommend] timeline: dropped "${c.title ?? c.method}" — ${res.reason}`);
      return [];
    }
    const t = res.timeline;
    console.log(
      `[recommend] timeline: "${c.title ?? c.method}" clock ${c.recipe.targetTimeSec}s → ${t.finishSec}s (pours end ${t.pourPhaseEndSec}s + drawdown ${t.drawdownSec}s ${t.drawdownSource}: ${t.drawdownBasis}; cadence ${t.cadenceSource})`,
    );
    return [{ ...c, recipe: { ...applyTimelineToSteps(c.recipe, t), targetTimeSec: t.finishSec, timeline: t } }];
  });
  const discTimed = composed.length ? composed : discGuarded;

  //   6. LONG POUR GAPS — logged, never dropped (2026-10-19): the prompt tells
  //      the model a wait over 75 s reads as a stalled brew; if it writes one
  //      anyway it is its recipe, and the brew screen shows it as written.
  for (const c of discTimed) {
    const t = c.recipe.timeline;
    if (!t || t.shape !== "percolation") continue;
    const water = t.steps.filter((st) => (st.pourGrams ?? 0) > 0);
    let gap = 0;
    for (let i = 0; i < water.length - 1; i++) gap = Math.max(gap, water[i + 1].startSec - (water[i].startSec + water[i].pourSec));
    if (gap > LONG_DESIGNED_WAIT_SEC) {
      console.warn(`[recommend] long-pour-gap: "${c.title ?? c.method}" has a ${Math.round(gap)}s gap between pours (> ${LONG_DESIGNED_WAIT_SEC}s) — kept as written`);
    }
  }
  const gapGuarded = discTimed;

  // Grinder UNIT. The user picks the grinder in the flow and the prompt says
  // "NEVER Niche°" / "NEVER clicks" for the one they didn't pick, but a hard
  // instruction stated only in prose is one this model leaks — the same failure
  // as the banned brewer and the disc offset. A wrong unit is worse than a
  // wrong number: "406" on a Comandante isn't approximately right, it is a
  // setting the grinder does not have. Converted, not flagged, using the
  // owner's own measured anchors (grindSettings.ts).
  //   8. The user's own typed numbers, last, so no guard can undo them.
  const timeGuarded = gapGuarded;
  const userParamsApplied = userReq
    ? timeGuarded.map((c) => {
        const res = applyUserParams(c.recipe, userReq.params);
        for (const change of res.changes) console.log(`[recommend] user-request param: "${c.title ?? c.method}" ${change}`);
        return res.recipe === c.recipe ? c : { ...c, recipe: res.recipe };
      })
    : timeGuarded;

  const grindGuarded = userParamsApplied.map((c) => {
    const fixed = normalizeGrindToGrinder(c.recipe.grindSize, sessionGrinder) ?? c.recipe.grindSize;
    if (fixed === c.recipe.grindSize) return c;
    console.warn(
      `[recommend] grind-unit: "${c.recipe.grindSize}" → "${fixed}" for ${sessionGrinder}`,
    );
    return { ...c, recipe: { ...c.recipe, grindSize: fixed } };
  });

  // Last: the pour-sequence string follows the steps the guards left behind
  // (fidelity snap, physics, agitation, pour durations all rewrite steps).
  const computedWindows =
    chemexInterp && chemexInterp[0] && chemexInterp[1]
      ? [{ methodKey: "chemex", min: Math.min(chemexInterp[0].deg, chemexInterp[1].deg), max: Math.max(chemexInterp[0].deg, chemexInterp[1].deg) }]
      : [];
  const candidates = grindGuarded.map((c) => {
    const recipe = { ...c.recipe, pourSequence: derivePourSequence(c.recipe.pourSteps) ?? c.recipe.pourSequence };
    return attachGrinderSuggestion(
      {
        ...c,
        recipe,
        grindProvenance: grindProvenanceOf({ ...c, recipe }, { sessions: pastSessions, userGrind: userReq?.params.grind, computedWindows }),
      },
      sessionGrinder,
      Boolean(userReq?.params.grind),
    );
  });

  return {
    recommendation: {
      candidates,
      primaryMethod: candidates[0].method,
      primaryRecipe: candidates[0].recipe,
      alternativeMethod: candidates[1]?.method,
      alternativeRecipe: candidates[1]?.recipe,
      reasoning: raw.reasoning ?? "",
      generatedAt: new Date().toISOString(),
      ...(userReq ? { userRequestApplied: toApplied(userReq) } : {}),
    },
    usage,
  };
}
