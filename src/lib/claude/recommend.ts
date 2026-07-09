import { callRecommendModel } from "../ai/recommendProvider";
import { vesselOverflow, vesselTooSmallForTarget } from "../utils/vesselCapacity";
import { stripProactiveDripAssist } from "../utils/dripAssist";
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
import { buildTimingStats } from "./historyUtils";
import { getRoasterPrior, formatRoasterPriorForPrompt } from "../roasters/priors";
import {
  selectRecipes,
  formatRecipesForPrompt,
  brewersAvailableFromEquipment,
  CANONICAL_EQUIPMENT,
  brewersFromMethod,
  normaliseRoastLevel,
  normaliseProcess,
  normaliseGoal,
} from "../knowledge/recipes";
import {
  getVarietyPriorsForBag,
  formatVarietyPriorsForPrompt,
} from "../knowledge/varieties";
import { TECHNIQUES } from "../knowledge/techniques";
import { reconcileToReference, reconcileWaterToPourPlan } from "./recipeFidelity";
import { sanitizePourSteps } from "../utils/pourSteps";
import { parseClaudeJson, z } from "./parseJson";

const CandidateSchema = z.object({
  method: z.string(),
  role: z.string(),
  title: z.string(),
  basedOn: z.string().optional(),
  recipe: z.record(z.string(), z.unknown()),
  whyChosen: z.string(),
  hypothesis: z.string(),
  predictedCupProfile: z.string(),
  primaryVariable: z.string(),
  whatToObserve: z.string(),
  confidence: z.string(),
  confidenceReason: z.string(),
  learningValue: z.string(),
  brewingLesson: z.string().optional(),
});

const RecommendationResponseSchema = z.object({
  candidates: z.array(CandidateSchema).min(1),
  reasoning: z.string().optional(),
  sessionObjective: z.string().optional(),
  coffeeAssessment: z.string().optional(),
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
): BrewRecipe {
  const { recipe: fixed, changed, reasons, reference } = reconcileToReference(recipe, basedOn);
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
 * Deterministic volume-fidelity backstop: the user asked for a specific brew
 * volume, so drop any candidate that can't honour it — a vessel too small to
 * serve the target (the "450ml request → 180ml AeroPress" bug, where the model
 * picked a small vessel and clamped the water down to fit it), or a recipe that
 * grossly under-pours the target on an otherwise-capable vessel. The prompt's
 * HARD CAPACITY CONSTRAINT already forbids the too-small vessel, but Mistral
 * leaks buried negatives where Opus held (#453) — this enforces it in code.
 *
 * Skipped entirely for iced (waterGrams is only the hot portion, ~60% of the
 * drink) and cold brew (concentrate + dilution), and when a method is locked
 * (the capacityConstraint USER OVERRIDE deliberately honours the user's vessel
 * AND volume together). Never returns empty — if every candidate fails, keep
 * them and log loudly rather than fail the recommendation.
 */
function guardVolumeTarget(
  candidates: RecommendationCandidate[],
  targetMl: number | undefined,
  skip: boolean,
): RecommendationCandidate[] {
  if (!targetMl || skip) return candidates;
  const safe = candidates.filter((c) => {
    const tooSmall = vesselTooSmallForTarget(c.method, targetMl);
    if (tooSmall) {
      console.warn(`[recommend] volume guard dropped "${c.title}" — ${tooSmall}`);
      return false;
    }
    const water = c.recipe?.waterGrams as number | undefined;
    if (typeof water === "number" && Number.isFinite(water) && water < targetMl * 0.7) {
      console.warn(
        `[recommend] volume guard dropped "${c.title}" — pours ${water}g but you asked for ${targetMl}ml`,
      );
      return false;
    }
    return true;
  });
  return safe.length ? safe : candidates;
}

/**
 * Anti-repetition signal: the reference recipes surfaced across the user's
 * recent sessions. The recommend menu is otherwise near-deterministic for a
 * given coffee, so without this the same `basedOn` recipes come back brew after
 * brew (the "recommendations repeat across contexts" complaint). We tell the
 * model what it recently leaned on and to vary unless the coffee demands it —
 * NOT a hard ban (a genuinely best-fit recipe may legitimately repeat).
 */
function buildRecentRecipesNote(
  sessions: import("../types/session").Session[],
): string {
  const recent = sessions.slice(0, 6);
  const names = new Set<string>();
  for (const s of recent) {
    for (const c of s.recommendation?.candidates ?? []) {
      const b = c.basedOn?.trim();
      if (b && b.toLowerCase() !== "own recipe") names.add(b);
    }
  }
  if (names.size === 0) return "";
  return `\nRECENTLY RECOMMENDED — across your last ${recent.length} sessions you have leaned on these reference recipes: ${Array.from(names).join(", ")}. Unless this coffee genuinely calls for one of them again, base your two candidates on DIFFERENT reference recipes and/or brewers, so the portfolio doesn't repeat itself brew after brew. Varying the reference is not a licence to fabricate — pick a different documented recipe from the library above that fits, don't invent one.`;
}

function buildDiversityNote(sessions: import("../types/session").Session[]): string {
  const recent = sessions.slice(0, 8);
  const anchors: Record<string, number> = {};
  for (const s of recent) {
    const method = s.recommendation?.primaryMethod;
    if (method) anchors[method] = (anchors[method] ?? 0) + 1;
  }
  const sorted = Object.entries(anchors).sort((a, b) => b[1] - a[1]);
  if (!sorted.length || sorted[0][1] < 3) return "";
  const summary = sorted.map(([m, n]) => `${m} ×${n}`).join(", ");
  return `\nPORTFOLIO DIVERSITY — anchor methods in last ${recent.length} sessions: ${summary}. Vary deliberately unless the coffee or terrain genuinely demands the same approach.`;
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
}

/** Coach insight surfaced into the recommend prompt — multivariate
 * observations from /api/insights ordered by relevance. Imports
 * indirection (raw type rather than the Drizzle row) so this module
 * stays free of DB types — the caller (POST /api/recommend) does the
 * load. */
export interface RecommendInsight {
  observation: string;
  suggestion: string;
  citationFields: string[];
}

export async function generateRecommendation(
  coffee: CoffeeIdentity,
  context: SessionContext,
  preferences: UserPreferences,
  pastSessions: Session[] = [],
  userRoasterPrior?: import("../roasters/priors").RoasterPrior,
  escherTerrain?: string,
  coffeeHistory?: CoffeeHistory,
  insights?: RecommendInsight[],
): Promise<{
  recommendation: Recommendation;
  usage: { input_tokens: number; output_tokens: number };
}> {
  const equipment = preferences.equipment.length
    ? preferences.equipment.join(", ")
    : "V60, AeroPress, Bialetti";

  const PERCOLATION_METHODS = new Set([
    "v60", "orea", "orea fast", "orea apex", "orea classic", "orea open",
    "kalita", "kalita wave", "chemex",
    "turbo v60", "peng", "4:6", "kasuya",
    "origami", "origami air", "origami air m",
  ]);
  const isPercolation = (method?: string) =>
    method ? PERCOLATION_METHODS.has(method.toLowerCase().trim()) : false;

  const timingStats = buildTimingStats(pastSessions, isPercolation);

  // Session arc: how many times has this exact coffee been brewed before?
  const sessionCountForThisCoffee = pastSessions.filter(
    s => s.coffee?.name === coffee.name && s.coffee?.roaster === coffee.roaster
  ).length;

  const sessionArcNote =
    sessionCountForThisCoffee === 0
      ? "\nSESSION ARC: First brew of this coffee. Goal: characterize extraction behavior and establish a baseline. Pair two methods with genuinely different extraction physics (e.g., percolation + immersion, or high-clarity + body-forward) so the cup comparison is informative."
      : sessionCountForThisCoffee <= 2
      ? `\nSESSION ARC: Session ${sessionCountForThisCoffee + 1} of this coffee. Building on the baseline. Use what the first session suggested to refine, and push one variable further.`
      : sessionCountForThisCoffee <= 5
      ? `\nSESSION ARC: Session ${sessionCountForThisCoffee + 1} of this coffee. The character is understood. This portfolio should test something genuinely new — an unexplored method, an untested variable. Don't recycle what worked; push the boundary.`
      : `\nSESSION ARC: Session ${sessionCountForThisCoffee + 1} of this coffee. Expert territory. Find the ceiling: what does this coffee do that no other has? What technique reveals its most distinctive character? What would a championship barista choose to showcase it?`;
  const totalPercolationSamples = Object.values(timingStats).reduce(
    (n, v) => n + v.count,
    0
  );

  const amountGuide: Record<string, string> = {
    small:
      "target ~350g water / 23g dose (1:15.2). Suitable: V60, Orea, Clever Dripper (350ml < 450ml ✓), Kalita, Chemex, Origami Air M (23g < 30g dose limit ✓). NOT AeroPress (max 230ml). NOT Moccamaster (batch only).",
    big:
      "target ~520g water / 34g dose (1:15.3). Suitable: V60, Orea, Kalita, Chemex. NOT Origami Air M (34g exceeds 30g dose limit — bed too deep ✗). NOT Clever Dripper (520ml > 450ml ✗). NOT AeroPress (520ml > 230ml ✗). NOT Moccamaster (batch only).",
    batch:
      "target ~750g water — Moccamaster ONLY; scale dose to ~50g.",
    custom: context.customWaterMl
      ? (context.occasion === "summer-time"
          ? `ICED + custom volume: the user typed ${context.customWaterMl}ml as the FINAL drink (hot brew + melted ice). Split it as ~60% hot brew / ~40% ice — so waterGrams (hot brew portion) should target ~${Math.round((context.customWaterMl ?? 350) * 0.6)}g (±30g), and the recipe MUST set iceGrams ≈ ${Math.round((context.customWaterMl ?? 350) * 0.4)}g (the ice the hot brew drains onto). The pour sequence describes pouring the hot water; the ice sits in the server. Dose at 1:15 against the HOT brew portion (so ~${Math.round(((context.customWaterMl ?? 350) * 0.6) / 15)}g dose). BOTH candidates respect this split AND both include iceGrams. Reference iced recipes from the corpus (Hoffmann Immersion Iced, AeroPress Iced) supply the TECHNIQUE — scale dose + water + ice proportionally. Capacity tensions with the chosen method are handled separately (USER OVERRIDE block).`
          : `target exactly ${context.customWaterMl}ml for BOTH candidates — tolerance is ±30ml, never more. The user typed this exact number. Reference recipes from the corpus (Kasuya 4:6, Hoffmann Better 1 Cup, Wölfl Orea Fast, etc.) supply the TECHNIQUE and ratio, NOT absolute numbers — scale the dose proportionally so waterGrams lands within 30ml of ${context.customWaterMl}. Default ratio 1:15 (so ${Math.round((context.customWaterMl ?? 350) / 15)}g dose / ${context.customWaterMl}g water). If a specific reference recipe calls for a different ratio (e.g. 1:14 for Wölfl, 1:16 for Medina), use its ratio but still scale to ~${context.customWaterMl}ml. Capacity tensions with the chosen method are handled separately (see HARD CAPACITY CONSTRAINT / USER OVERRIDE block). When the user has locked a method that's near or past the vessel's comfortable max for this volume, honor BOTH the method and the ml — flag the trade-off in reasoning, do not silently clamp the water.`)
      : "target ~350g water / 23g dose",
    surprise:
      "SURPRISE MODE: full creative freedom on method and recipe — hard capacity limits still apply. Be adventurous.",
    open: "standard single-cup dose (23g:350ml)",
  };
  // Cold brew: resolve the chosen amount to an explicit target so a custom
  // volume (e.g. 900ml) is honoured precisely — the small/big numbers and the
  // exact custom ml both flow through here.
  const coldBrewMl =
    context.amount === "custom"
      ? context.customWaterMl ?? null
      : context.amount === "big"
        ? 520
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
      : (amountGuide[context.amount] ?? "target ~350g water / 23g dose");

  const sessionGrinder = context.grinder || preferences.grinder || "Niche Zero";
  const isNiche = sessionGrinder.toLowerCase().includes("niche");
  const grinderNote = isNiche
    ? `Grinder: ${sessionGrinder} → grindSize must be ONE specific Niche° value (e.g. "406°"). NO ranges. NEVER clicks.`
    : `Grinder: ${sessionGrinder} → grindSize must be ONE specific click count (e.g. "26"). NO ranges. NEVER Niche°.`;

  const waterNote =
    context.waterSource === "championship"
      ? "Clarity blend (1:2 BWT-filtered + distilled = ~73ppm TDS, KH ~1.3°dH) — near-zero buffering, ideal for washed florals & championship methods"
      : context.waterSource === "diluted"
      ? "Diluted blend (legacy, ~150ppm) — soft, SCA-optimal for delicate light roasts"
      : "BWT-filtered daily water (~220ppm TDS, GH 5–6°dH, KH 4°dH) — moderate buffering; for delicate washed coffees note the clarity blend would lift brightness";

  const daysOld = coffee.roastDate
    ? Math.floor(
        (Date.now() - new Date(coffee.roastDate).getTime()) / 86_400_000
      )
    : null;
  const freshnessNote =
    daysOld === null
      ? ""
      : daysOld < 5
      ? "too fresh — heavy CO₂, channeling risk, bloom 50s+"
      : daysOld < 7
      ? "very fresh — bloom 50s recommended"
      : daysOld < 22
      ? "peak window — ideal"
      : daysOld < 35
      ? "slightly past peak"
      : daysOld < 60
      ? "past peak, flavors softening"
      : "likely stale";

  const lockedMethodBase = (context.preferredMethod ?? "").trim();

  const capacityConstraint = (() => {
    const ml =
      context.amount === "custom"
        ? (context.customWaterMl ?? 350)
        : context.amount === "big"
        ? 520
        : context.amount === "small"
        ? 350
        : null;
    if (!ml) return "";
    type Violation = { method: string; reason: string };
    const allViolations: Violation[] = [];
    if (ml > 230) allViolations.push({ method: "AeroPress", reason: "max 230ml" });
    if (ml > 450) allViolations.push({ method: "Clever Dripper", reason: "max 450ml" });
    if (ml > 450) allViolations.push({ method: "Origami Air M", reason: "30g dose limit → max ~450ml" });
    if (ml < 500) allViolations.push({ method: "Moccamaster", reason: "batch only, min 500ml" });

    // If the user has explicitly locked a method that would normally be
    // forbidden at this volume, exempt it — both their method choice and
    // their volume are absolute user instructions. Note the trade-off but
    // honor both. Without this exemption the AI silently swapped the
    // method or clamped the ml (Markus' "450ml + Clever → recipe came
    // back at 360ml" report).
    const lockedLower = lockedMethodBase.toLowerCase();
    const lockedViolation = lockedLower
      ? allViolations.find((v) => v.method.toLowerCase() === lockedLower)
      : undefined;
    const enforced = lockedViolation
      ? allViolations.filter((v) => v !== lockedViolation)
      : allViolations;

    const violationStrs = enforced.map((v) => `${v.method} (${v.reason})`);
    let block = "";
    if (violationStrs.length) {
      block += `\nHARD CAPACITY CONSTRAINT — target ${ml}ml: FORBIDDEN methods: ${violationStrs.join(", ")}.`;
    }
    if (lockedViolation) {
      block += `\nUSER OVERRIDE: ${lockedViolation.method} would normally be forbidden at ${ml}ml (${lockedViolation.reason}), but the user has explicitly locked ${lockedViolation.method} as preferredMethod AND typed this exact volume. Both are absolute user instructions — use ${lockedViolation.method} at exactly ${ml}ml. The vessel will be at its physical edge; mention the trade-off in reasoning (e.g. "pouring ${ml}ml in a ${lockedViolation.method.toLowerCase()} — fill close to the rim, slow pours") but DO NOT swap the method or change the ml.`;
    }
    return block;
  })();

  const methodNote = context.preferredMethod
    ? `\nLOCKED METHOD: "${context.preferredMethod}" — the user has explicitly locked this brewer. BOTH candidates MUST use ${context.preferredMethod}. Do NOT swap to a different vessel for the second candidate. The two candidates contrast through substantially different RECIPE PHYSICS on the same brewer — different pour pattern (e.g. 4:6 vs Rao thirds vs single continuous), different ratio (e.g. 1:15 vs 1:17), different (but each constant) temperature (e.g. 95°C vs 88°C — never a staged ramp within one brew), different agitation profile, inverted vs upright (AeroPress), bypass vs no-bypass, immersion-then-drain vs full-percolation, etc. Both candidates equal — neither is primary. Override the lock only if genuinely incompatible with the coffee chemistry (rare). Capacity tensions are NOT a valid reason to override — those are handled via the USER OVERRIDE block above.`
    : "";

  // Drip Assist routing — the disc is the user's emergency / travel
  // backup, used only when no gooseneck kettle is around. It is NEVER
  // recommended proactively. When the user has explicitly locked
  // "V60 + Drip Assist", honor it with the coarser-grind instruction;
  // otherwise, ban it outright so Opus doesn't surface it as an
  // exploratory candidate (the "Drip Assist Slow-Flow Probe" failure
  // mode where it picked the disc on its own).
  const dripAssistLocked =
    context.preferredMethod && /drip\s*-?\s*assist/i.test(context.preferredMethod);
  const dripAssistNote = dripAssistLocked
    ? `\nDRIP ASSIST GRIND OFFSET: The locked V60 + Drip Assist recipe MUST grind ~5° coarser than the V60 baseline in the NICHE° GRIND REFERENCE (use the "V60 + Drip Assist" range, not the standard V60 range). The disc smooths pour distribution but reduces free flow area; coarsen to compensate so total brew time matches a standard V60. Mention in reasoning that this is the disc-on emergency dial-in, not the user's preferred V60 setup. When you name the brewer, only ever write "V60 + Drip Assist" or "V60" — never "bare V60" or "V60 without the Drip Assist".`
    : `\nDRIP ASSIST IS BANNED: Do NOT suggest "V60 + Drip Assist" as a candidate's primaryMethod. The Hario Drip Assist disc is the user's emergency/travel backup (used only when no gooseneck kettle is available). It is NEVER a proactive recommendation. If the user wanted it, they would have locked it as preferredMethod — they did not. Pick a plain "V60" (named exactly "V60", never "bare V60" or "V60 without the Drip Assist") or any other brewer the user owns instead.`;

  const goal = context.intent || "balanced";
  const goalNote = `\nGOAL: "${goal}" — the user's stated taste direction for this brew. The only user-stated bias allowed; everything else is science. See GOAL VOCABULARY in LAYER 1 for what this means and how it interacts with process defaults.`;

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

  // COACH INSIGHTS — multivariate observations generated by Opus over
  // the full session corpus (see src/lib/claude/insights.ts). Each
  // observation cites real counts across 2+ axes (variety × process ×
  // freshness × method × ratio …); the suggestion line is either a
  // concrete next move or a precise test question.
  //
  // Ordering: insights whose citationFields overlap the current brew's
  // attributes (variety, process, roastLevel, origin, method) come
  // first — they're the most directly applicable. Then the rest by
  // recency.
  const insightsBlock = (() => {
    if (!insights || insights.length === 0) return "";
    const currentSig = new Set<string>(
      [
        coffee.variety && "variety",
        coffee.process && "process",
        coffee.roastLevel && "roast",
        coffee.origin && "origin",
        context.preferredMethod && "method",
      ].filter(Boolean) as string[],
    );
    const relevance = (i: RecommendInsight) =>
      i.citationFields.reduce((acc, f) => acc + (currentSig.has(f.toLowerCase()) ? 1 : 0), 0);
    const ordered = [...insights].sort((a, b) => relevance(b) - relevance(a));
    const lines = ordered.slice(0, 8).map((i) => `- ${i.observation} ${i.suggestion}`);
    return (
      "\nCOACH INSIGHTS — multivariate observations across your full log. Use these as priors for which axes matter for this user (variety × process × method × ratio interactions). They are NOT recipe instructions — if an insight conflicts with what this coffee needs, name the conflict in the reasoning field and choose the better path. Insights citing fields that match the current brew (variety, process, roast, origin, locked method) are listed first.\n" +
      lines.join("\n")
    );
  })();

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
        ? 520
        : context.amount === "small"
          ? 350
          : context.amount === "batch"
            ? 750
            : undefined;

  // Union the stored onboarding equipment with the owner's canonical kit.
  // The onboarding picker never offered Origami or Chemex, so keying off the
  // saved row alone silently filtered out every Origami/Chemex recipe before
  // scoring. Single-user app — the canonical kit is the real, authoritative
  // equipment list (see CLAUDE.md). Method-lock filtering still narrows from here.
  const brewersAvailable = brewersAvailableFromEquipment([
    ...(preferences.equipment ?? []),
    ...CANONICAL_EQUIPMENT,
  ]);
  // If the user locked a method in the flow, hard-filter recipe selection to
  // that method so the prompt only carries recipes for the brewer they chose.
  const lockedBrewers = brewersFromMethod(context.preferredMethod);
  const selectedRecipes = selectRecipes(
    {
      brewersAvailable,
      lockedBrewers,
      roastLevel: normaliseRoastLevel(coffee.roastLevel),
      process: normaliseProcess(coffee.process),
      variety: coffee.variety,
      goal: normaliseGoal(context.intent),
      occasion: context.occasion,
      // Cold brew batches in a jar — the small/big DRINK amount must not filter
      // out the 1L reference recipes; vessel capacity is enforced in the prompt.
      maxWaterMl: context.occasion === "cold-brew" ? undefined : targetWaterMl,
      // Exclude vessels too small to serve the requested volume — but only for
      // plain hot brews. Iced (vessel holds the hot portion only), cold brew
      // (concentrate + dilution) and a locked method (USER OVERRIDE honours the
      // vessel + volume together) all opt out.
      serveVolumeMl:
        context.occasion === "summer-time" ||
        context.occasion === "cold-brew" ||
        lockedBrewers.size > 0
          ? undefined
          : targetWaterMl,
      // Rotate equal-scoring recipes per brew so the injected menu (and the
      // per-brewer diversity winner — e.g. the Clever water-first) varies
      // instead of repeating every session. Session count changes each brew.
      rotationSeed: pastSessions.length,
    },
    4
  );
  const recipesBlock = selectedRecipes.length
    ? `\n${formatRecipesForPrompt(selectedRecipes)}`
    : "";

  // Compact technique vocabulary — id + one-line description per technique.
  // The full mechanism for each is reachable via the recipe's `science`
  // field; this block exists so the brain has a vocabulary to compose with
  // when no recipe matches exactly.
  const techniquesBlock =
    "\nAVAILABLE TECHNIQUES (atomic moves you can compose with — cite by id when adapting a recipe):\n" +
    TECHNIQUES.map((t) => `  - ${t.id}: ${t.description}`).join("\n");

  const userMessage = `Coffee: ${coffee.name || "Unknown"} by ${coffee.roaster || "Unknown roaster"}
Origin: ${coffee.origin || "Unknown"}${coffee.region ? `, ${coffee.region}` : ""}${coffee.variety ? ` · Variety: ${coffee.variety}` : ""}
Process: ${coffee.process || "Unknown"}${coffee.fermentationStyle ? ` (${coffee.fermentationStyle})` : ""} | Roast: ${coffee.roastLevel || "Unknown"}${coffee.cuppingScore ? ` | Score: ${coffee.cuppingScore}` : ""}
Roast date: ${coffee.roastDate ?? "unknown"}${daysOld !== null ? ` (${daysOld} days — ${freshnessNote})` : ""}
Bag tasting notes: ${coffee.tastingNotesFromBag?.join(", ") || "none listed"}
${roasterBlock}${historyBlock}${insightsBlock}
Context:
- Occasion: ${context.occasion}
- Amount: ${context.amount} (${guide})
- Time available: ${context.timeAvailable}
- Grinder: ${sessionGrinder}
- Water: ${waterNote}${capacityConstraint}${methodNote}${dripAssistNote}${goalNote}

Equipment available: ${equipment}
${grinderNote}
Taste preferences: body=${preferences.tasteProfile.preferredBodyLevel}, acidity=${preferences.tasteProfile.preferredAcidityLevel}

${escherTerrain
  ? `Brew pattern terrain (use as case history — informs your hypothesis, does not override recipe physics):\n${escherTerrain}`
  : pastSessions.length === 0
    ? "No previous sessions — first brew ever logged. Reason from coffee properties and roaster prior only."
    : `${pastSessions.length} sessions logged. Terrain analysis not available for this request.`
}
${sessionArcNote}
${buildDiversityNote(pastSessions)}${buildRecentRecipesNote(pastSessions)}
${
  totalPercolationSamples > 0
    ? `\nTIMING CALIBRATION — per method (grind adjustment only — never temperature):\n` +
      Object.entries(timingStats)
        .map(([method, { delta, count }]) => {
          const direction =
            delta > 20
              ? `→ grind ${Math.ceil(delta / 15)}° coarser`
              : delta < -20
              ? `→ grind ${Math.ceil(-delta / 15)}° finer`
              : "→ well-calibrated";
          return `  ${method}: avg ${delta > 0 ? "+" : ""}${delta}s vs target (${count} brew${count !== 1 ? "s" : ""}) ${direction}`;
        })
        .join("\n") +
      "\nApply the relevant row only when recommending that specific method."
    : ""
}

${varietyBlock}${recipesBlock}${techniquesBlock}

Pour sequence format: CUMULATIVE weight milestones separated by " – " for percolation (e.g. "50 – 180 – 320 – 500").
For immersion methods (AeroPress, Clever, Moccamaster), use prose description instead.

pourSteps — ALSO emit this structured array on every recipe. It is what the in-app timer advances through step by step, so it must be complete and ordered.
- One object per physical step the brewer performs, in order.
- action: one of bloom | pour | final | stir | swirl | wait | press | invert | flip | drain | bypass | melodrip | agitate-bed
- waterGramsAtEnd: cumulative water in the brewer after a POUR step (omit on non-pour steps). These MUST match pourSequence.
- durationSec: how long the step takes. Percolation: the timer re-derives pour timing, durations are advisory. Immersion / AeroPress: durations are MANDATORY and the timed (non-setup) steps MUST sum to targetTimeSec.
- temperatureC: omit on every step. BrewLog brews at ONE constant temperature (the recipe's waterTempC) — never stage or ramp temperature across pours.
- notes: one short, step-relevant hint (what to watch). Optional.
- AGITATION IS AN EXPLICIT STEP, NOT A NOTE — and it must MIRROR the recipe you adapt. If the recipe you name in basedOn shows agitation in its pour sequence above — a bloom swirl, a between-pour stir, and ESPECIALLY a settle swirl/tap right before the drawdown — carry EACH of those into pourSteps as its own step ("action": "stir" | "swirl" | "agitate-bed") at the same point in the sequence. The end-of-brew settle swirl/tap (the one that flattens the bed just before drawdown) is part of the recipe — do NOT drop it; emit it as the last step before the "drain"/drawdown. The brew screen shows a stir/swirl prompt ONLY where such a step exists, so a dropped agitation step = a missing prompt mid-brew. EXCEPTION — explicitly minimal/reduced-agitation recipes (Orea Apex/Open, Origami, Chemex/Moccamaster post-bloom, or any recipe whose notes say "minimal/reduced agitation"): include NO agitation steps beyond what that recipe itself calls for — never add a trailing swirl such a recipe doesn't want.
- Immersion/AeroPress: the steep is a single "wait" step carrying its full durationSec; the inverted setup is an "invert" step (durationSec 0); the flip-and-press is a "flip" or "press" step placed right after the steep.

basedOn — name the documented recipe this candidate adapts, using its name from the Reference Recipe Library above (e.g. "Kasuya 4:6", "Hoffmann AeroPress", "April House V60"). If the candidate isn't based on any documented recipe, set "Own recipe". Always present.

RECIPE FIELD CONSISTENCY — the recipe's structured fields ARE the brew the user makes; the app shows them as the headline and feeds pourSteps to the timer. They must all describe ONE recipe:
- doseGrams / waterGrams / waterTempC / grindSize / targetTimeSec are the recipe you are actually instructing. When you adapt a reference recipe, put the ADAPTED numbers here — NEVER leave the reference recipe's published dose/water/temp in these fields while the pourSteps and prose describe a different brew. (The failure to avoid: header reads 18g:225g:93°C copied from the reference, while the pour plan pours to 230g and the rationale says "1:15.3 at 90°C" — three different recipes in one candidate.)
- waterGrams MUST equal the final cumulative waterGramsAtEnd of your last water-adding pour (bloom/pour/final/melodrip — NOT bypass, which is separate dilution). The pourSequence milestones, the pourSteps milestones, and waterGrams must agree to the gram.
- doseGrams and waterGrams must match any ratio you state in whyChosen / hypothesis / predictedCupProfile (a "1:15.3" claim means waterGrams ≈ doseGrams × 15.3). waterTempC must match any temperature you mention in the prose. Compute the prose from the fields, never the reverse.

CANDIDATE TITLES must be DISTINCT across the candidates in one response — the two candidates are different experiments, so they must read as different on the chip selector and the brew screen. Never give two candidates the same title (e.g. two "Inverted Long Immersion"); name each for the variable it tests.

Return valid JSON only.`;

  const { text, usage } = await callRecommendModel(userMessage);

  const raw = parseClaudeJson(text, RecommendationResponseSchema);
  if (!raw) throw new Error("Failed to parse recommendation from Claude");

  const mapped: RecommendationCandidate[] = raw.candidates.map((c) => ({
    method: c.method,
    recipe: guardRecipeFidelity(sanitizeRecipe(c.recipe), c.basedOn, c.title),
    role: c.role as CandidateRole,
    title: c.title,
    ...(c.basedOn ? { basedOn: c.basedOn } : {}),
    whyChosen: c.whyChosen,
    hypothesis: c.hypothesis,
    predictedCupProfile: c.predictedCupProfile,
    primaryVariable: c.primaryVariable,
    whatToObserve: c.whatToObserve,
    confidence: c.confidence as CandidateConfidence,
    confidenceReason: c.confidenceReason,
    learningValue: c.learningValue,
    ...(c.brewingLesson ? { brewingLesson: c.brewingLesson } : {}),
  }));

  // Three deterministic backstops over what the model returned (the prompt
  // forbids all three, but a weaker model can still leak them — #453):
  //   1. over-capacity vessels (too small for the water it pours);
  //   2. vessels too small to SERVE the requested volume, or a recipe that
  //      grossly under-pours it (the "450ml → 180ml AeroPress" bug);
  //   3. any proactively-suggested Drip Assist.
  const capped = guardVesselCapacity(mapped);
  const volumeSafe = guardVolumeTarget(
    capped,
    targetWaterMl,
    // Skip when the model's volume semantics differ from the plain target, or
    // when the user locked a method (USER OVERRIDE honours vessel + volume).
    context.occasion === "summer-time" ||
      context.occasion === "cold-brew" ||
      Boolean(lockedMethodBase),
  );
  const candidates = stripProactiveDripAssist(volumeSafe, Boolean(dripAssistLocked));

  return {
    recommendation: {
      candidates,
      primaryMethod: candidates[0].method,
      primaryRecipe: candidates[0].recipe,
      alternativeMethod: candidates[1]?.method,
      alternativeRecipe: candidates[1]?.recipe,
      reasoning: raw.reasoning ?? "",
      ...(raw.sessionObjective ? { sessionObjective: raw.sessionObjective } : {}),
      ...(raw.coffeeAssessment ? { coffeeAssessment: raw.coffeeAssessment } : {}),
      generatedAt: new Date().toISOString(),
    },
    usage,
  };
}
