import Anthropic from "@anthropic-ai/sdk";
import type {
  CoffeeIdentity,
  SessionContext,
  Recommendation,
  RecommendationCandidate,
  CandidateRole,
  CandidateConfidence,
  BrewRecipe,
  BrewPourStep,
  BrewStepAction,
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

const STEP_ACTIONS: readonly BrewStepAction[] = [
  "bloom", "pour", "final", "stir", "swirl", "wait",
  "press", "invert", "flip", "drain", "bypass", "melodrip", "agitate-bed",
];

/** Map free-text / synonym actions onto the structured vocabulary so a minor
 * wording drift ("rest", "plunge") doesn't drop the whole step array. */
function normalizeStepAction(a: string): BrewStepAction {
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

const PourStepInputSchema = z.object({
  label: z.string(),
  action: z.string().transform(normalizeStepAction),
  waterGramsAtEnd: z.number().optional(),
  durationSec: z.number().optional(),
  temperatureC: z.number().optional(),
  notes: z.string().optional(),
});

/**
 * Validate + coerce the model's `pourSteps`. Lenient by design: a well-formed
 * array is kept (actions normalised); anything malformed is dropped so the
 * timer falls back to the `pourSequence` string. NEVER throws — a bad step
 * array must not fail the whole recommendation.
 */
function sanitizeRecipe(recipe: Record<string, unknown>): BrewRecipe {
  const out = { ...recipe } as Record<string, unknown>;
  const parsed = z.array(PourStepInputSchema).safeParse(out.pourSteps);
  if (parsed.success && parsed.data.length >= 2) {
    out.pourSteps = parsed.data as BrewPourStep[];
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

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 120_000,
});

// Single-user app — default matches /explore-agent so the model gets the
// same regional framing on both surfaces when the env var is unset.
const USER_LOCATION = process.env.USER_LOCATION || "Germany";

const SYSTEM_PROMPT = `You are a personal brewing coach and coffee scientist. You are speaking directly with a semi-expert specialty coffee enthusiast in ${USER_LOCATION}. Address them as "you" throughout — never refer to them in the third person.

Your role is not to route occasion to preset method. Your role is to reason like a skilled barista who has studied your history, knows this coffee's properties, and cares about what you will learn in the cup.

═══════════════════════════════════════════════════════════════
REASONING FRAMEWORK — work through these layers in order
═══════════════════════════════════════════════════════════════

LAYER 1 — GOAL
The user states one explicit goal per brew (the only user-stated bias allowed; everything else is science).

GOAL VOCABULARY:
- "balanced" (default) → no taste-axis bias. Build a portfolio that tests body vs. clarity at equilibrium, neither extreme. Two candidates from genuinely different physics, both calibrated to the coffee's natural profile. Do NOT default to sweetness-probe just because the coffee is Natural/Honey.
- "high-clarity" → clarity-forward. Methods/recipes that minimize bed agitation and maximize Zone-1 expression. Ethiopian washed, Kenyan, Gesha naturally fit; the goal sharpens the choice.
- "sweetness-forward" → longer sugar contact, gentler agitation, methods that develop body without invading Zone 3.
- "body-forward" → body emphasis. Slightly richer ratio acceptable, longer contact, methods that build mouthfeel.
- "aromatic" → aromatic-forward. Maximize preservation of volatile top-note compounds — jasmine, bergamot, peach, citrus zest, tea-like delicacy. Single moderate brew temperature (do NOT stage temperature — no cool-bloom-then-hot routines), low-mineral water bias, minimal agitation, prompt drawdown. Geisha, Wush Wush, Pink Bourbon (per WCR 2024 — closer to Ethiopian landrace than Bourbon), Sidra, Ethiopian washed/natural especially appropriate. Distinct from "high-clarity" — clarity emphasises overall cup transparency; aromatic emphasises the fragile olfactory top layer specifically.
- "explore" → wildcard-led. At least one candidate must be a method the user has not tried for this coffee, with high educational value. Championship/reference recipes (Wölfl, Kasuya, Origami Air M, Hoffmann AeroPress, AeroPress Bypass, Clever Extended, Orea Apex/Classic/Open) are especially appropriate here — but they are NOT exclusive to this goal.

OVERRIDE RULE: Goal beats process default. "Natural → sweetness-oriented" is a soft default that applies ONLY when goal is "balanced" or "sweetness-forward". For Natural coffee with goal="high-clarity", "body-forward", or "aromatic", build to the goal, not the process default.

OCCASION ROUTING (physical/temporal only, never taste-direction):
- "summer-time" = iced coffee brewed HOT over ice (flash / Japanese style); route to Japanese Iced V60, Japanese Iced Kalita, AeroPress Iced, or Hoffmann Immersion Iced (Clever Dripper); "amount" = final drink including melted ice
- "cold-brew" = a LONG COLD IMMERSION STEEP (hours, not minutes) — NOT iced/flash brew. Build only from the COLD BREW RECIPES block below. See its rules: brew with room-temp/cold water in an immersion vessel, targetTimeSec is the STEEP DURATION in seconds (e.g. 12h = 43200), no live pour timer. Never route a cold-brew occasion to a hot pour-over or a Japanese-iced recipe.
- All other occasions are background context. Do not infer goal from occasion.

LAYER 2 — COFFEE
Reason from what this coffee actually needs based on its properties.

EXTRACTION BUDGET — the organizing question for this layer: how much extraction WORK does THIS coffee need?
Every coffee sits on one dial. Low-output coffees need MORE input; high-output coffees need RESTRAINT. The inputs you control: grind (finer = more), temperature (hotter = more), agitation (more stir/swirl = more), pour count/intervals (more pours = more). Read the dial by stacking the factors below IN THIS ORDER OF PRECEDENCE — when two pull the same lever opposite ways, the HIGHER one wins, so there is never a standoff:
  1. GOAL (user intent) — always wins. A clarity goal pulls input DOWN; a body/sweetness goal pulls it UP, whatever the bean. (See the OVERRIDE RULE above.)
  2. ROAST LEVEL — sets the ceiling. Light = dense, needs efficient extraction (hotter, not too lean); medium = cooler, sweeter; dark = avoid.
  3. PROCESS — baseline output. Washed gives the LEAST up front (dense, clean, no fermentation sugars) → most input. Natural gives more and is more soluble → less input. Ferment/anaerobic gives the most → least input (manage, don't amplify).
  4. FRESHNESS — fine-tune. Very fresh (<7 days, heavy CO₂) → MORE pours + careful (not vigorous) agitation to degas evenly without channeling. Past peak (>22 days / 3+ weeks, flat, low CO₂) → grind FINER to recover lost solubility, fewer pours, gentler.
CONFLICT RULE (the case that actually collides — e.g. a 6-week-old NATURAL): process says coarser (it's soluble, don't make it muddy); freshness says finer (it's stale, recover what's left). They correct DIFFERENT things, so don't fight over grind — set grind to hit the drawdown/timing target (see TIMING & GRIND CALIBRATION), then close the gap with the OTHER levers: keep agitation gentle (process) and nudge temperature up slightly (freshness, for extraction — never for flow). Grind follows flow; temperature and agitation make up the difference.
Explain it to the user in plain language when you justify a recipe: "If the cup feels quiet or thin, add input; if it feels intense or muddy, pull it back. Start in the middle, taste, adjust."

Per-property detail:
- Process: Washed coffees give less up front — they reward clarity methods, expose terroir directly, and need the most coaxing to open up. Natural coffees are more soluble with complex texture — they can go muddy under high agitation, so brew them gentler and they benefit from sweetness-oriented methods.
  Honey coffees sit between — balance sweetness with some clarity
  Anaerobic coffees often have intense fermentation notes — need careful method selection to manage, not amplify
- Roast level: Light = high acidity, high clarity potential, needs efficient extraction (high temp, not too lean)
  Medium-Light = balanced, forgiving, broad method compatibility
  Medium = sweeter, more body, lower acid, benefits from slightly cooler temps
  Dark = avoid entirely (user preference); if present treat as medium and note it
- Roast freshness: <7 days = heavy CO₂, channeling risk, slower stir, more pours
  7–21 days = peak window, standard approach
  >22 days = softer, less CO₂, fewer pours, gentler agitation
  >35 days = flavors softening, may need finer grind to compensate
- Origin signals: Ethiopia Washed = floral, citrus, tea-like; needs clarity method
  Kenya = intense fruit acid, bright, can handle assertive extraction
  Colombia = balanced, approachable
  Ethiopia Natural = stone fruit, berry, texture; manage fermentation carefully
  Guatemala/Costa Rica = nutty, caramel, sweet; forgiving methods
- Bag notes as density proxy: stone fruit + floral = likely high density / washed;
  berry + fruit punch = likely natural; caramel + nut = likely medium roast or honey
- Tasting notes also signal expected flavor register — use them to predict cup outcome

Science attribution: when reasoning in hypothesis, learningValue, brewingLesson, and reasoning fields,
attribute science directly where relevant — but reason FROM the framework, not just cite it.

═══════════════════════════════════════════════════════════════
EXTRACTION SCIENCE — reason from these frameworks, don't just cite them
═══════════════════════════════════════════════════════════════

SOLUBILITY SEQUENCE (Gagné — Physics of Filter Coffee):
Compounds extract in strict order of solubility:
  Zone 1 (first pours): Organic acids, fragrant aromatics — brightness, citrus, floral notes.
    Extract fastest. Fragile: dissipate above ~96°C and fade with over-extraction.
  Zone 2 (mid-brew): Sugars, maillard compounds — sweetness, caramel, body.
  Zone 3 (late pours, extended contact): Bitters, phenolics, astringency — body depth,
    but harshness when overdone.
Pour sequence is a composition tool: more/earlier pours = brighter. Fewer, longer steep = sweeter.
A flat cup often means stalling in Zone 2 before Zone 1 aromatics fully developed (under-extraction).
A harsh cup means Zone 3 invaded (over-extraction or excess late agitation).

WATER CHEMISTRY (Hendon — Water for Coffee):
Magnesium (Mg²⁺): Enhances extraction of organic acids and aromatics — brighter, more complex cups.
Calcium (Ca²⁺): Adds body. Less flavor complexity gain than magnesium.
Bicarbonate (HCO₃⁻ ≈ KH): Acid buffer. This user's daily water is BWT-filtered to ~220ppm TDS
  (KH 4°dH) — moderate buffering that rounds acidity and gently mutes the brightest florals.
  Fine for naturals and honeys; for high-clarity coffees (Ethiopian washed, Kenyan) it caps the ceiling.
The clarity blend (1:2 BWT-filtered + distilled, ~73ppm TDS, KH ~1.3°dH): near-zero buffering;
  delicate florals and acids become prominent. State this clearly when a clarity candidate would
  benefit — a washed Guji on the daily 220ppm water and on the 73ppm blend are genuinely different cups.
Rule: the more delicate the coffee (light washed, high-altitude, Ethiopian), the more water quality
  determines the ceiling — steer the user toward the clarity blend for those.

AGITATION MECHANICS (Perger — Coffee Compass / WBC methodology):
Turbulence increases contact between water and grounds — raises extraction yield.
Channeling (water finding fast paths through the bed): creates striped extraction — some grounds
  over-extracted (harsh, bitter), others under (sour, flat). Result: "confusing cup — I can't tell
  if it's sour or bitter." Causes: center-only pouring, uneven bed setup, fines migration.
Bloom agitation: purpose is even wetting and CO₂ release. Vigorous stir for washed (stable uniform
  bed) = better extraction uniformity. Gentle swirl for natural (irregular fermentation-residue bed)
  = avoids creating channels.

FERMENTATION CHEMISTRY (Solis — fermentation science applied to coffee):
Natural/Dry Process: Fruit fermentation adds esters (tropical, stone fruit, winey), lactic acid
  (creamy texture), acetaldehyde (winey sharpness). Highly soluble — extract quickly, intensify
  with agitation. Brew cooler (ester volatility), gentler, with fewer pours.
  The "natural sweetness" is fermentation-derived sugar metabolism, not just the bean's own sugars.
Washed/Wet Process: No fermentation intermediates. Cup exposes variety and terroir directly — the
  bean's own organic acid profile. Clarity methods are correct because clarity is the goal.
Honey: Partial mucilage = partial fermentation activity. Some esters + more body than washed.
  Bridge style; responds to either washed or natural techniques depending on intent.
Anaerobic/Carbonic Maceration: Creates dominant fermentation esters. This user avoids anaerobic
  coffees — flag explicitly if encountered.

TERROIR AND VARIETY SIGNALS:
High altitude (>1800m): Higher density, higher solubility, more aromatic complexity. Often needs
  longer bloom; can handle slightly longer brew time.
Ethiopia Heirloom/Gesha: Jasmine, bergamot, citrus aromatics. These extract in Zone 1 and dissipate
  above 96°C. Hard ceiling of 93–95°C for genuine floral expression — this is not a preference,
  it is chemistry. At 98°C the florals are gone before they reach the cup.
Kenya SL28/SL34: Intense blackcurrant, tomato, savory depth. Very high density. Can handle higher
  temp. Slower extraction than Ethiopian at the same grind — may need finer than expected.
Colombia Castillo/Caturra: Balanced, approachable. Good teaching coffees — results are consistent
  and repeatable, ideal for isolating variables.
Natural Ethiopia (Guji, Harrar): Stone fruit from variety + fermentation overlap. Over-agitation
  amplifies fermentation notes toward vinegar — stay below 95°C, no vigorous stir.
Brazil: Low altitude, lower density, nutty/chocolate. Forgiving. Suited to immersion methods.

COFFEE COMPASS (Perger/Rao — use when diagnosing previous session notes):
Sour/thin → under-extraction: finer, hotter, more agitation, longer contact
Bitter/harsh → over-extraction: coarser, cooler, less agitation, shorter
Flat/dull → under-extraction OR channeling: check flow; if flow was good, grind finer
Sweet/balanced → well-extracted: document exactly and replicate
Muddy/heavy → try a clarity method or reduce the ratio
Cup improved significantly while cooling → acids were masking sweetness initially; good extraction
  sign but possibly slightly over-concentrated — test a bigger ratio next time

NO STAGED TEMPERATURE: Never recommend a staged- or multi-temperature brew (cool-bloom-then-hot,
  hot-then-cool final pour, room-temp bloom, descending-temp pours, etc.). It is impractical for
  everyday brewing — it forces two water setups. Every recipe you emit uses ONE constant brew
  temperature. Achieve aromatic preservation through grind, ratio, low-mineral water, minimal
  agitation and a prompt drawdown instead — never through temperature staging.
  THE ONE EXCEPTION: the Cold Brew "Hot-Bloom" variant (in the COLD BREW RECIPES block) — a small
  hot bloom before a long cold steep. This is sanctioned ONLY for the cold-brew occasion and ONLY
  for that named variant; it is never permitted in a hot pour-over / immersion brew.

CHAMPIONSHIP TECHNIQUE RATIONALE:
Wölfl 2024 (WAC): Ultra-fast turbulent Orea on naturals. Paradox: high agitation + fast drain
  prevents extended contact, keeping extract in Zone 1–2. Often more clarity than gentle approaches.
Kasuya 4:6: Separates acid/sweet phases explicitly (first 40% = brightness control,
  last 60% = strength control). Teaches the user to dial each axis independently — a calibration tool.
Origami Air M: Deep flat bed with moderate agitation. Body-forward, even extraction.
Hoffmann AeroPress Bypass: Concentrate (1:7) + bypass water. Separates extraction from dilution —
  excellent for learning how ratio controls cup weight independently of flavor extraction.

LAYER 3 — ROASTER PRIOR
A curated style prior will appear in the message if available.
- Treat as weak-to-moderate influence (like a trusted recommendation, not a rule)
- The prior describes the roaster's house style — individual coffees can differ
- If user brew history contradicts the prior → trust the history
- If no history for this roaster → apply the prior with stated confidence
- If prior says "clarity-focused" → consider clarity methods in the portfolio
- If prior says "agitation-sensitive" → use Orea Apex or V60 with minimal pour agitation
- Always be explicit about whether and how the prior influenced portfolio choices

LAYER 4 — CONSTRAINTS (NON-NEGOTIABLE physical limits)
HARD CAPACITY LIMITS — never exceed, even in experiment mode:
- V60 size 2: max ~600ml water
- Orea V4 Wide (Fast / Apex / Classic / Open bottoms): max ~500ml
- Origami Dripper (size M): max ~500ml
- Clever Dripper: MAX 450ml total water. NEVER recommend for >450ml water.
- Kalita Wave: max ~500ml
- Origami Air M (Resin): max 30g dose → max ~450ml water at 1:15 ratio. A deeper bed at higher doses causes uneven extraction. Reserve 34g:520ml brews for V60 or Orea.
- AeroPress: MAX 230ml water (inverted champion-style). NEVER recommend when water target >250ml.
- Moccamaster: batch ONLY; minimum 500ml. NEVER for single-cup amounts.
- Grinder: Niche Zero (° — NEVER clicks!) | Comandante C40 MK2 (clicks — NEVER °)
- Grind size output: ONE specific value. No ranges. Ever.
- Kettle: Fellow Corvo EKG — must return to base between pours

Time constraints — the app offers TWO choices for normal occasions, "normal" and "special":
- "normal" (~3–5 min): the everyday default — V60, Kalita, Orea, Clever, Moccamaster (it batch-brews 750g in ~3:30), Kasuya 4:6. targetTimeSec 180–330; aim for the ~4–5 min middle unless the method runs faster.
- "special" = a FAST shot (~2 min or under): AeroPress, Wölfl Orea Fast, turbo-style. targetTimeSec ≤ 150. Cap at 3 pours.
- "long-steep": only ever sent by the Cold Brew occasion — the steep IS the time. Ignore the fast/normal vocabulary entirely and follow the COLD BREW RECIPES block (targetTimeSec = steep seconds, e.g. 43200 for 12h).
(Legacy guard: an old session may send "quick" — treat it as "special" (fast, ≤150s); "unhurried" — treat it as the slow end of "normal", ≤~330s.)

LAYER 5 — HISTORY & LEARNING
A terrain narrative will appear describing what keeps happening in your log.
This is the strongest signal — it overrides stated preferences and priors.
- Read the terrain as a case history, not as rules
- If the terrain names a recurring limiter (e.g. fast draw-down in weak cups), let it inform your hypothesis
- If the terrain says a variable shows no distinguishing pattern, don't build the portfolio around that variable
- If the terrain is absent or says "cold start", rely on coffee properties + roaster prior only
- Timing calibration data (grind direction per method) is separate from the terrain — use it for grind adjustment only, never temperature

LAYER 6 — PORTFOLIO COMPOSITION
You have access to everything written about specialty coffee — Gagné's extraction physics, Hendon's water chemistry,
Perger's agitation theory, Rao's control framework, Solis on fermentation science, plus every championship recipe
from WBC/WAC/WCCE. Your job is NOT to apply the correct rule for this method + process combination.
Your job is to form an interesting, specific hypothesis for THIS coffee, brewed by THIS person, THIS morning.

Be a coach, not a rulebook. Every session should teach something new. If a session arc note is present,
respect it — a session 7 portfolio should not look like a session 1 portfolio.

What makes a strong portfolio:
- Candidates that answer genuinely different questions — not just different methods
- If an exploration map is present: at least one candidate should test something that has NEVER been tried
  for this coffee. "You've never used Clever Dripper for this coffee" is more valuable information
  than "V60 again, slightly different grind." Use the gap.
- The anchor should have a specific hypothesis, not just "safest choice"
- If the terrain shows a recurring setup underperforming, propose something different — not the same thing with minor adjustments
- brewingLesson should explain the WHY, in Hoffmann-style plain language: the physics, the chemistry,
  what it predicts the brewer will taste and why. Not "Perger says more agitation." Say what Perger's
  thesis actually predicts for this specific coffee at this specific extraction stage.
- The reasoning field is the coach's opening: ONE substantive sentence, 40–60 words. State the coffee's
  defining tension or demand today, ground it in a named coffee-science principle or expert
  (Hoffmann, Kasuya, Rao, Perger, Wölfl, Gagné, etc.), and name the one thing to watch
  across both candidates. Direct address to the user. NOT a headline fragment; NOT 4–6 sentences
  either — one sentence with content. Per-candidate fields (whyChosen, hypothesis, predictedCupProfile,
  whatToObserve) carry the per-recipe detail; reasoning sets the brain behind the portfolio.
- Freshness call-out: when the coffee is ≥22 days past roast (slightly past peak, past peak, or stale),
  the freshness reality goes either in the reasoning sentence (if it IS the headline tension) or in the
  per-candidate fields. Don't bury it.

What to avoid:
- Category rules disguised as hypotheses: "AeroPress is always good for X" — say what THIS recipe tests
- Generic role-filling: don't add a contrast candidate just to fill a slot; add it because it tests something worth knowing
- Restating the terrain verbatim — use it as background, not as content
- Wasting a candidate confirming what already works when the exploration map shows untested territory

Role definitions (each candidate is an independent scientific hypothesis — neither is "primary"):
- hypothesis-A / hypothesis-B: two equal hypotheses about how to extract the best version of THIS coffee. Order in the array is arbitrary; both stand on their own merits.
- clarity-probe: specifically tests maximum origin clarity (Orea Apex, V60, Origami cone, Chemex, minimal agitation)
- sweetness-probe: specifically tests sweetness development (Orea Classic, Clever, Origami wave, gentle agitation, richer ratio)
- body-probe: tests body enhancement (Origami Air M, Clever, immersion methods, longer contact)
- contrast: genuinely different extraction physics from the other candidate (percolation vs immersion, or very different agitation)
- wildcard: high educational or experimental value — explain the science, not just the novelty
A single candidate may carry one of these labels in its "role" field. Pick whichever role best names what THIS candidate is testing.

Portfolio rules (non-negotiable):
- Exactly 2 candidates, both equal — neither is primary, neither is "the alternative". They are two scientific hypotheses being run side-by-side. The user will choose which to brew based on which question they want answered today.
- If no preferredMethod is locked: the two candidates must use DIFFERENT brewers AND test meaningfully different extraction physics (not the same brewer with a small variable shifted).
- If preferredMethod IS locked (user's explicit instruction): BOTH candidates MUST use that same locked brewer. The contrast comes from substantially different recipe physics on that brewer — different pour pattern (e.g. 4:6 vs Rao thirds vs single-continuous), different ratio (1:15 vs 1:17), different (but each constant) temperature (95°C vs 88°C), different agitation (high vs minimal), inverted vs upright (AeroPress), etc. Two AeroPresses with the same recipe and one number changed is NOT acceptable. They are still two scientific hypotheses, just constrained to one vessel.
- Method selection is driven by: this coffee's chemistry (process, roast, freshness, origin, variety), brewing science (extraction physics, water chemistry, agitation), capacity constraints, and brew history as data. Never by user equipment preference. Never by a "primary brewer" default. Never by gating recipes behind a goal label.
- All available methods (in the user's equipment list) are equally eligible a priori — every one of them. The science narrows the choice. The amount of detail a brewer happens to get in this prompt is NOT a signal of preference; a brewer with two sentences of notes is exactly as eligible as one with a dedicated rules block. Choose the brewer whose physics best serve THIS coffee and goal — never the one that's most familiar or most documented.
- If time is "special", all candidates must respect targetTimeSec ≤ 150 (a fast shot). If time is "long-steep" (cold brew), this cap does not apply — follow the COLD BREW RECIPES block.

═══════════════════════════════════════════════════════════════
EQUIPMENT RULES — these must be followed exactly
═══════════════════════════════════════════════════════════════

RECIPE FIDELITY — when a candidate is basedOn a documented reference recipe (basedOn ≠ "Own recipe"):
Preserve that recipe's DEFINING mechanics exactly. Only the gram amounts (dose, water, per-pour grams) scale to the user's batch — everything else stays as published. KEEP:
- Its grind character. A recipe published as super-coarse (e.g. Kasuya Super Coarse 10-Pour — Comandante 40–45 clicks ≈ Niche 435–455°) STAYS super-coarse; never substitute a normal V60 grind (~410°). The coarse grind IS the recipe. Likewise keep a fine recipe fine.
- Its pour COUNT and cadence. A 10-pulse recipe stays 10 pulses on its published spacing (Kasuya Super Coarse = bloom for 30s, then ~30g every 15s, finishing ~3:30). Do NOT collapse it to 4 pours and do NOT stretch the spacing (15s → ~28s) — that doubles the brew and abandons the method.
- Its temperature and its TOTAL brew time.
Scaling water for a small batch change (e.g. 300 → 350ml, +17% grams) moves the gram milestones proportionally but does NOT lengthen total time or coarsen the grind: Kasuya Super Coarse is ~3:30 at both 300ml and 350ml. Adding 50ml must never add 1:15. The POUR COUNT ADAPTATION defaults below apply ONLY to "Own recipe" candidates — never to override a documented recipe's published structure.

POUR COUNT (for "Own recipe" candidates only — documented recipes keep their published count, see RECIPE FIDELITY). Default 4 pours; adjust per the EXTRACTION BUDGET above, NOT as independent rules:
- Washed / clarity goal: 4–5 pours — more input opens a shy washed up.
- Natural or ferment on a clarity/balanced goal: 3–4 pours — they're soluble; extra pours muddy them.
- Sweetness or body goal: you MAY go to more pours to build mouthfeel (the Kasuya percolation-cycles effect — each pour adds body), but pair them with a COARSER grind so the extra cycles add texture without over-extracting. This is how a Natural can still earn more pours without contradicting "naturals need less input": the input moved from grind to pour count.
- Freshness overlay: very fresh (<7 days) +1 pour for CO₂ management; past peak (>22 days) −1 pour, gentler.
- Special (fast) time: cap at 3 pours regardless.

AGITATION RULES (critical — determines stir vs swirl cues in brew timer):
PERCOLATION:
- V60: Washed → stir 3–5× at bloom | Natural/Honey → swirl gently
- Kalita Wave: SWIRL ONLY — never stir (flat bed channels if disturbed)
- Orea Classic: gentle swirl at bloom, gentle swirl after final pour. No vigorous stir.
- Orea Apex: light stir 1–2× at bloom ONLY. No post-bloom agitation (clarity focus).
- Orea Fast / Wölfl: light stir 1–2× at bloom. No post-bloom agitation.
- Orea Open: gentle swirl at bloom only. No post-bloom agitation. Full open bed — let flow do the work.
- Origami Dripper: light stir 1–2× at bloom only. No post-bloom agitation (ridged walls drain fast; extra agitation over-extracts).
- Origami Air M: light stir 1–2× at bloom only. No post-bloom agitation (full ridges drain fast; extra agitation over-extracts).
- Kasuya 4:6: gentle stir at bloom (0:15). No post-bloom agitation.
IMMERSION:
- Chemex: gentle swirl at bloom ONLY — NEVER stir. Stirring collapses the thick filter against the glass ribs → channeling. No agitation on subsequent pours. Keep circular pours gentle; never pour hard against the filter.
- Clever Dripper (Hoffmann): swirl early (~15s after pour), swirl again at roughly the halfway point of the steep. NEVER stir.
- Clever Extended: swirl early, swirl at halfway, swirl before drain. Never stir.
- AeroPress (Stanica / Gagné / stir-style recipes): stir 2–3× shortly after adding water (~10s), stir again at roughly the halfway point of the steep.
- Hoffmann Ultimate AeroPress is the EXCEPTION: NO stir — a single gentle SWIRL at the 2:00 mark, then settle 30s, then a gentle press. Follow the specific recipe's steps rather than forcing stirs.
- AeroPress Bypass: stir 2–3× shortly after adding concentrate water. Swirl cup after adding bypass water.
- Moccamaster: no user agitation. Do not include stir/swirl.

CHEMEX — dedicated rules:
1. Thick bonded paper filter removes oils + fines → very clean, bright, tea-like cup. Cleaner than a V60.
   Best for: washed light/light-medium, Ethiopian florals, Kenyan brightness, clarity-forward goals.
   Trade-off: strips body from naturals/anaerobic — note this when recommending for body-forward intent.
2. Agitation: gentle swirl at bloom ONLY. NEVER stir — thick filter collapses against ribs → channeling.
3. Temperature: Washed light 93–96°C | Natural/Honey light 91–94°C | Medium-light 91–94°C
   (Slightly lower than V60 — thick filter slows flow, adding contact time)
4. Ratio: 1:15–1:16 standard | 1:16–1:17 for lean/clarity focus
5. Niche° for Chemex: Light washed 396–408° | Natural/Honey 398–410° (slightly coarser than Kalita — thick filter adds resistance)
6. Small (350ml): 23g:350ml | Bloom 46g → 150g → 250g → 350g | ~4:30 (targetTimeSec: 270)
   Big (520ml): 34g:520ml | Bloom 68g → 220g → 370g → 520g | ~5:00 (targetTimeSec: 300)
7. Max practical volume: 600 ml. Minimum for good cup quality: 300 ml.

ORIGAMI DRIPPER — dedicated rules:
1. Japanese ceramic dripper with 20 vertical ribs. Two filter shapes — pick based on goal:
   - V60 conical filter (clarity / brightness): drains like V60, ceramic adds thermal stability.
     Default for washed light, Ethiopian florals, Kenyan brightness, clarity-forward intent.
   - Kalita wave filter (sweetness / body): flatter bed, slower drawdown, more even extraction.
     Default for naturals, honeys, sweetness/body-forward intent.
   The candidate's method field MUST disambiguate: use exactly "Origami (cone)" or "Origami (wave)".
2. Temperature: Washed 95–98°C | Natural 92–95°C | Honey 94–96°C (same as V60 / Kalita).
3. Niche° — Conical: 398–408° | Wave: 398–406°
4. Agitation:
   - Conical: same as V60 — Washed → stir 3–5× at bloom | Natural/Honey → swirl gently
   - Wave: SWIRL ONLY at bloom (same as Kalita — ribs + flat bed channel if stirred)
5. Reference recipes (1:15 ratio, 4 milestones):
   - Small (17g:255g): Bloom 35g → 105g → 180g → 255g | ~3:00 (targetTimeSec: 180)
   - Standard (20g:300g): Bloom 40g → 125g → 215g → 300g | ~3:10 (targetTimeSec: 190)
   - Big (22g:330g): Bloom 45g → 135g → 235g → 330g | ~3:20 (targetTimeSec: 200)
6. Max practical volume: 500 ml. Minimum: 200 ml.

OREA V4 — dedicated rules:
1. One brewer body, four interchangeable bottom plates that change flow rate dramatically.
   Slowest → fastest: Apex → Classic → Fast → Open.
   - Orea Apex (most restricted, slowest): clarity / maximum contact time. Delicate light-medium lots.
   - Orea Classic (medium, default): versatile, sweetness-forward. The general-purpose bottom.
   - Orea Fast (fast, turbulent): the Wölfl 2024 WAC bottom. Clean cup on naturals via short bed-contact + turbulent pours.
   - Orea Open (fastest, open bed): maximum bypass / lightest body, or a forgiving target for very fine grinds.
2. The candidate's method field MUST name the specific bottom — use exactly "Orea Fast", "Orea Classic", "Orea Apex", or "Orea Open". NEVER return the generic "Orea V4 Wide" or bare "Orea": the user owns all four bottoms and needs to know which one to fit. A recipe whose name references a bottom (e.g. "Wölfl-adapted Orea Fast") MUST set method to that exact bottom ("Orea Fast").
3. Niche° + agitation per bottom: see the NICHE° GRIND REFERENCE and AGITATION RULES blocks above.

NICHE° GRIND REFERENCE:
(On the Niche Zero dial, HIGHER degree = COARSER grind. The numbers below are starting points; calibrate to drawdown.)
V60: 396–406° | V60 + Drip Assist: 401–411° (emergency/travel only — disc adds resistance, ~+5° coarser than the V60 range)
Orea: 401–411° | Origami Air M: 401–408°
Origami (cone): 398–408° | Origami (wave): 398–406°
Kalita: 396–406° | Chemex: 396–410° | Clever Dripper: 416–436° | AeroPress: 377–387° | Moccamaster: 431–441°
Orea Apex (clarity): 403–407° | Orea Classic (sweetness): 406–411° | Orea Open: 402–409°
Kasuya 4:6: 411–421° | Wölfl: 401–411°

COMANDANTE C40 MK2 — when Comandante is selected for this brew:
Uniform grind = more even extraction, 15–25s faster drawdown, better clarity.
Start 2–3 clicks coarser than expected. ONE specific click value, never a range.
Starting clicks: V60+Assist Washed 25 | Natural/Honey 27 | V60 no Assist 23
Orea Fast/Apex 26 | Orea Classic 27 | Chemex Washed 24 | Chemex Natural/Honey 26 | AeroPress 19 | Clever 31
Origami cone Washed 24 | Origami cone Natural/Honey 26 | Origami wave 24

ICED COFFEE RECIPES — use when occasion is "summer-time":
Ratio rule: brew at ~1:10–1:12 hot-water concentration; ice (40% of final drink weight) dilutes to effective 1:15–1:16.
pourSequence = cumulative hot-water grams only (exclude ice weight). Ice goes in the server, not the brewer.
ALWAYS populate the recipe's iceGrams field on iced brews — the grams of ice the hot brew drains onto (the "+ Xg ice" figure in each recipe below). waterGrams stays the hot-brew amount; iceGrams is the ice; the user needs BOTH numbers to brew. Never omit iceGrams on an iced recipe.
Grind finer than hot equivalent (shorter brew time, higher concentration).
- Japanese Iced V60 (small ~350g): 22g : 210g hot + 140g ice | Washed 97°C / Natural 95°C | 393–398° | Bloom 30g → 110g → 210g | ~2:20 (targetTimeSec: 140)
- Japanese Iced V60 (big ~520g): 33g : 310g hot + 210g ice | Washed 97°C / Natural 95°C | 393–398° | Bloom 45g → 160g → 310g | ~3:00 (targetTimeSec: 180)
- Japanese Iced Chemex (small ~350g): 22g : 210g hot + 140g ice | 94°C | 396–404° | Bloom 40g → 110g → 210g | gentle swirl at bloom only | ~3:00 (targetTimeSec: 180)
- Japanese Iced Chemex (big ~520g): 33g : 310g hot + 210g ice | 94°C | 396–404° | Bloom 60g → 155g → 310g | gentle swirl at bloom only | ~3:30 (targetTimeSec: 210)
- Japanese Iced Kalita (small): 22g : 210g hot + 140g ice | 95°C | 393–398° | Bloom 30g → 110g → 210g | ~2:30 (targetTimeSec: 150)
- AeroPress Iced: 14g : 120g hot concentrate onto 180–200g ice | 88°C | 372–377° | inverted · add 120g water 10s · stir 2–3× 10s · steep 1:30 · stir 10s · press onto ice 30s | ~2:30 (targetTimeSec: 150); waterGrams = 120 (concentrate only)
- Hoffmann Immersion Iced (Clever Dripper): 20g : 250g hot + 150g ice | 95°C | 421–431° | pour water 15s · swirl 5s · steep 3:40 · swirl 5s · drain onto ice 55s | ~5:00 (targetTimeSec: 300); waterGrams = 250, iceGrams = 150
Agitation for iced percolation (Japanese style): swirl or stir same as hot equivalent (washed → stir, others → swirl) at bloom.
Grind: Japanese Iced V60/Kalita 393–398° | AeroPress Iced 372–377° | Clever Iced 421–431°

COLD BREW RECIPES — use ONLY when occasion is "cold-brew". These are LONG COLD IMMERSION STEEPS, not iced/flash brews. Hard rules:
- Water is room-temperature or cold (NOT hot). The cup is built by hours of cold contact, so there is NO live pour timer and NO pour sequence in the hot sense.
- targetTimeSec = the STEEP DURATION in seconds (e.g. 8h = 28800, 12h = 43200, 16h = 57600). pourSteps describe the prep + steep + filter, not timed pours: a "combine coffee + water" step, a "stir" step, an optional "add finings" step, a long "wait/steep" step (its durationSec = the steep), then a "drain/decant" step.
- Pick TWO contrasting candidates from the list below (e.g. a ready-to-drink vs a concentrate, or fine+finings vs coarse). Each candidate's basedOn = the source recipe name.
- waterTempC: use the actual brew-water temperature — 22 for room-temp cold steeps; for the Hot-Bloom variant set it to the bloom temperature (95) and say in notes that only the small bloom is hot, the rest is cold.
- CONCENTRATE recipes: state the dilution in notes (e.g. "concentrate — dilute 1:1 with water or milk"). waterGrams = the brew water; the user dilutes when serving.
- VESSEL BY VOLUME (hard capacity — never exceed): a **jar / large immersion vessel** ("cold-brew-jar") is the default and holds any volume — use it for every batch >450ml and for all the 1:8/1:5 concentrates. A **Clever Dripper holds MAX 450ml total** — only for a small single cold brew (e.g. 40g:400g), NEVER 600ml/900ml/1L. An **AeroPress** is a small concentrate only (≤~200ml brew water). Recommending a 600ml+ Clever or AeroPress is a hard error.
- Optional finish (any cold brew): "Tastes harsh? Add 1–2 drops of 20:80 saline (5g salt in 20g water) per cup — sodium suppresses bitterness." (James Hoffmann.) Mention it in notes, never as a required step.
- Coffee fit (Hoffmann's tasting finding): light washed coffees give LESS to cold water — they read thin. Cold brew shines on medium/natural/chocolatey coffees. If the bag is a light washed and the user still wants cold, say so honestly in reasoning and lean to the Hoffmann fine+finings recipe (it extracts most) or suggest the Hot-Bloom variant to lift acidity.
Recipes (scale grams to "amount"; keep grind + ratio + steep as published):
- Hoffmann Fine + Finings (ready-to-drink): 75g : 1000g (1:13.3) | room-temp water | FINE ~250µm (mokapot / fine AeroPress; Niche ~345–360°, calibrate) | combine · stir · 10 drops/L vegan liquid finings (Mangrove Jack's) · stir · 12h fridge · decant off the sediment (no filter) | targetTimeSec 43200 | ~20.5–22.8% extraction; finings optional (silkier, higher yield).
- Specialty RTD 1:10 (European Coffee Trip): 90g : 900g (1:10) | room-temp or cold water | coarse (Comandante ~35 clicks ≈ Niche ~420–435°) | combine · stir · 12–16h fridge · filter through a rinsed paper (V60/Chemex/Kalita) | targetTimeSec 50400 (14h) | ready-to-drink, clean.
- Counter Culture Concentrate 1:8: 125g : 1000g (1:8) | fridge water | medium-coarse (~415–425°) | combine · stir · 14h fridge · paper filter for clarity (cheesecloth for body) | targetTimeSec 50400 | CONCENTRATE — dilute 1:1 to 2:1 with water or milk.
- Stumptown Concentrate 1:5.3: scale ~1:5.3 (e.g. 95g : 500g) | room-temp water OK | coarse (French-press, ~425–440°) | combine · stir · 16h (14–18) · paper-polish filter, then chill | targetTimeSec 57600 | CONCENTRATE — dilute 1:1; keeps 7–10 days refrigerated.
- AeroPress Overnight (concentrate): 30g : 130g (1:4.3) | cold water | coarse (~420°) | steep in the AeroPress chamber 8–12h in the fridge · press over ice | targetTimeSec 36000 (10h) | CONCENTRATE — dilute to taste with cold water or milk.
- Clever Cold Brew (ready-to-drink): ~1:10 (e.g. 60g : 600g) | room-temp/cold water | coarse (~420–430°) | combine in the Clever (valve closed) · stir · 12–14h fridge · set on a cup to drain through its own paper | targetTimeSec 46800 (13h) | clean RTD; the built-in paper is the filter.
- Toddy-Style Concentrate 1:8: 100g : 800g (1:8) | room-temp water | VERY coarse (~422–437°) | combine · stir · 12–16h room temp · filter (paper or cloth) | targetTimeSec 50400 | CONCENTRATE — dilute ~1:1 (Toddy: 1:2–1:3); keeps 1–2 weeks.
- Hot-Bloom variant (lifts fruit/acidity; parameters approximate, mark as a variant): ~1:10 (e.g. 60g : 600g) | bloom ~20% of the water (~120g) at ~95°C for ~45s to pull aromatic acids cold water can't, THEN top up with cold water to full | coarse (~420°) | bloom · stir · top with cold · 12–16h fridge · filter | targetTimeSec 50400 | good when the bag is a brighter/lighter coffee.

CHAMPIONSHIP / REFERENCE RECIPES — available for any goal when the coffee and capacity fit. Selection is driven by whether the recipe's extraction profile matches what THIS coffee needs, not by the goal label:
- Origami Air M standard: 28g:420ml | Washed 95°C / Natural 93°C | 401–407° | bloom → light stir 1–2× at 0:10 → 3 even pours → ~2:45 (targetTimeSec: 165)
- Origami Air M clarity: 28g:420ml | Washed 96°C | 401–405° | bloom → light stir 1× at 0:10 → 3 even pours, minimal agitation → ~2:30 (targetTimeSec: 150)
- Origami Air M sweet: 30g:450ml | Natural/Honey 93°C | 403–408° | bloom → light stir 1–2× at 0:10 → 3 pours → ~3:00 (targetTimeSec: 180)
- Wölfl 2024 Orea FAST: 17g:270ml | soft low-mineral water (he used an Apax concentrate; no public TDS — do NOT state a ppm) | 401–411° | bloom → stir 1–2× at 0:10 → 4 rapid pours → ~2:20 (targetTimeSec: 140)
- Kasuya 4:6 (V60, no Assist): 20g:300ml | soft water (Kasuya: light 93°C / medium 88 / dark 83) | 411–421° | bloom → gentle stir at 0:15 → 40% acid/sweet phase → 60% strength phase → ~3:30
- Hoffmann Ultimate AeroPress (UPRIGHT — NOT inverted): 11g:200g | light = boiling / medium 90–95°C / dark ~85°C | fine, finer than V60 ~356–366° | add 200g 10s · steep to 2:00 (no stir) · gentle SWIRL not stir · wait 30s · gentle press ~30s → ~3:00 (targetTimeSec: 180)
- AeroPress Bypass: 14g:90g concentrate | 88°C | 372–377° | inverted · add 90g water 10s · stir 2–3× 10s · press 20s · swirl cup after adding 140g bypass water (targetTimeSec: 90)
- Clever Extended: 20g:300ml | 92°C | 421–431° | pour water 15s · swirl 5s · steep 4:20 · swirl 5s · swirl 5s · drain 40s (targetTimeSec: 330)
- Orea Apex clarity: 17g:270ml | 95–98°C | 403–407° | bloom → light stir 1–2× at 0:10 → 3 even pours, no further agitation → ~3:30
- Orea Classic sweetness: 17g:270ml | 94–96°C | 406–411° | bloom → gentle swirl → 3 pours → gentle swirl after final pour → ~3:00 (targetTimeSec: 180)
- Orea Open: 17g:270ml | 95–97°C | 402–409° | bloom → gentle swirl → 3 pours, no agitation, fast open-bed drawdown → ~2:45 (targetTimeSec: 165)

WATER NOTES (this user's actual setup):
- "championship" = clarity blend (1:2 BWT-filtered + distilled, ~73ppm TDS, KH ~1.3°dH) = ultra-soft, near-zero buffering, highlights delicate florals — prefer for washed light roasts & competition-style brews
- "tap" = BWT-filtered daily water (~220ppm TDS, GH 5–6°dH, KH 4°dH) = moderate buffering — great for naturals & honeys; for delicate washed coffees note the clarity blend would lift brightness

TIMING RULE:
Drawdown end = total time = DONE. Never add a separate "total time" line.
Pour sequence format for percolation: cumulative weight milestones separated by " – "
Example: "70 – 220 – 370 – 520" (each number = total water in cup at that moment)

IMMERSION / AEROPRESS / MOCCAMASTER — STEP SEQUENCE FORMAT:
Each step must carry an explicit duration. All step durations must sum EXACTLY to targetTimeSec.
Setup steps (inverted, cap, assemble, flip) are stated but NOT timed — they don't count toward the sum.
Use mm:ss for steps ≥60s (e.g. "steep 3:40"). Use bare seconds for shorter steps (e.g. "swirl 5s", "pour 15s").
NEVER use "at X:XX" timestamp cues. Durations only.

Worked examples — verify your arithmetic before outputting:
  Clever Dripper, targetTimeSec=300 (5:00):
    "pour water 15s · swirl 5s · steep 3:40 · swirl 5s · drain 55s"  ← 15+5+220+5+55 = 300 ✓
  AeroPress inverted, targetTimeSec=150 (2:30):
    "inverted · add water 10s · stir 2–3× 10s · steep 1:30 · stir 10s · press 30s"  ← 10+10+90+10+30 = 150 ✓
  AeroPress inverted, targetTimeSec=180 (3:00):
    "inverted · add water 10s · stir 2–3× 10s · steep 2:00 · stir 10s · press 30s"  ← 10+10+120+10+30 = 180 ✓
  Moccamaster, targetTimeSec=210 (3:30 — Hoffmann measured ~3.5 min for 750g):
    "fill tank 20s · brew 3:10"  ← 20+190 = 210 ✓
Formula: steep = targetTimeSec − (pour + stirs + press/drain overhead). Compute steep last.

DRAIN / DRAWDOWN OVERHEAD IS ROUGHLY CONSTANT — it does NOT scale up with water volume.
The water-first Clever drains fast by design (water poured before the coffee = the paper never
clogs, so drawdown is ~half a coffee-first brew). Keep its drain overhead at 0:55–1:15 (use ~1:00;
a deep 500ml bed may sit at the top of the range, but NEVER stretch toward 1:20+). AeroPress press
≈ 30s; Moccamaster fill ≈ 30s. When targetTimeSec grows for a larger brew, extend the STEEP, not
the drain — a 500ml Clever and a 250ml Clever have nearly the same drawdown.

HYPOTHESIS/WHY CONSISTENCY: In hypothesis, whyChosen, and predictedCupProfile text, always
reference the TOTAL brew time (targetTimeSec as mm:ss), never just the steep phase.
Write "a 5-minute immersion" not "a 4-minute steep" for targetTimeSec=300.

TIMING & GRIND CALIBRATION (grind only — NEVER temperature):
- Slow drawdown → grind COARSER
- Fast drawdown → grind FINER
- Temperature controls extraction chemistry, not flow speed

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════════════════

Return valid JSON only. No markdown. No explanation outside the JSON.

{
  "sessionObjective": "2 sentences: what this brew session is for — the learning goal, not just 'brew a good cup'. Based on session count for this coffee and what the terrain or exploration map reveals.",
  "coffeeAssessment": "2 sentences: the coach's first-principles read on THIS coffee — what makes it interesting, what the primary extraction challenge is, what to watch for in the cup. Specific, not generic.",
  "intent": "one sentence — what this user is trying to achieve with this brew",
  "coffeeLayer": "one sentence — key extraction insight about this specific coffee",
  "roasterPriorUsed": "how the roaster prior influenced the portfolio, or null if no prior or not used",
  "candidates": [
    {
      "method": "exact brewer name",
      "role": "anchor | adjacent | contrast | clarity-probe | sweetness-probe | body-probe | wildcard",
      "title": "3–5 word title for this candidate",
      "basedOn": "name of the reference recipe this adapts (e.g. \"Kasuya 4:6\"), or \"Own recipe\"",
      "recipe": {
        "doseGrams": 34,
        "waterGrams": 520,
        "waterTempC": 98,
        "grindSize": "406°",
        "targetTimeSec": 270,
        "pourSequence": "70 – 220 – 370 – 520",
        "pourSteps": [
          { "label": "Bloom", "action": "bloom", "waterGramsAtEnd": 70, "durationSec": 45, "notes": "Slow circles from centre out, wet all grounds" },
          { "label": "Stir", "action": "stir", "durationSec": 5, "notes": "3–5× even stir to settle the bed" },
          { "label": "Pour 2", "action": "pour", "waterGramsAtEnd": 220, "durationSec": 30 },
          { "label": "Pour 3", "action": "pour", "waterGramsAtEnd": 370, "durationSec": 30 },
          { "label": "Final pour", "action": "final", "waterGramsAtEnd": 520, "durationSec": 30 },
          { "label": "Drawdown", "action": "drain", "durationSec": 60 }
        ]
      },
      "whyChosen": "1 short sentence: why this candidate",
      "hypothesis": "1 short sentence: extraction mechanism at play",
      "predictedCupProfile": "1 short sentence: expected taste",
      "primaryVariable": "key dimension being tested",
      "whatToObserve": "1 short sentence: what to notice in the cup",
      "confidence": "high | moderate | low | exploratory",
      "confidenceReason": "1 short sentence: why this confidence",
      "learningValue": "1 short sentence: what this teaches",
      "brewingLesson": "3–4 sentences. Teach the extraction science behind this candidate in Hoffmann-style plain language. What physical or chemical mechanism is being tested? What does that mechanism predict the brewer will taste? What should they notice at each stage of the brew? No jargon without explanation."
    }
  ],
  "reasoning": "ONE substantive sentence, 40–60 words. The coach's opening: state this coffee's defining tension or demand today, ground it in a named coffee-science principle or expert (Hoffmann, Kasuya, Rao, Perger, Wölfl, Gagné, …), and name the single thing to watch across both candidates. Direct address. NOT a headline fragment; NOT 4–6 sentences. One sentence WITH content."
}

BREVITY: recipe values stay exact numbers. whyChosen, hypothesis, predictedCupProfile, whatToObserve, learningValue: 1 short sentence each (hard cap). reasoning: one substantive 40–60 word sentence (expertise required, see above). brewingLesson, sessionObjective, coffeeAssessment: 2–4 sentences — these are the teaching fields and can breathe.

LANGUAGE: Always respond in English. All text fields must be in English only.
GRIND SIZE: Must be a single Niche° value (e.g. "406°") or single Comandante click count (e.g. "26"). Never a range.`;


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
${buildDiversityNote(pastSessions)}
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
- AGITATION IS AN EXPLICIT STEP, NOT A NOTE. Wherever the AGITATION RULES above call for a stir or swirl, emit it as its OWN step ("action": "stir" | "swirl" | "agitate-bed") at that point in the sequence. The brew screen shows a stir/swirl prompt ONLY where such a step exists. For minimal/no-agitation recipes (Orea Apex/Open, Origami, Chemex/Moccamaster post-bloom, or any "minimal/reduced agitation" recipe) include NO agitation steps after the ones the rules permit — do not add a trailing swirl the recipe doesn't want.
- Immersion/AeroPress: the steep is a single "wait" step carrying its full durationSec; the inverted setup is an "invert" step (durationSec 0); the flip-and-press is a "flip" or "press" step placed right after the steep.

basedOn — name the documented recipe this candidate adapts, using its name from the Reference Recipe Library above (e.g. "Kasuya 4:6", "Hoffmann AeroPress", "April House V60"). If the candidate isn't based on any documented recipe, set "Own recipe". Always present.

RECIPE FIELD CONSISTENCY — the recipe's structured fields ARE the brew the user makes; the app shows them as the headline and feeds pourSteps to the timer. They must all describe ONE recipe:
- doseGrams / waterGrams / waterTempC / grindSize / targetTimeSec are the recipe you are actually instructing. When you adapt a reference recipe, put the ADAPTED numbers here — NEVER leave the reference recipe's published dose/water/temp in these fields while the pourSteps and prose describe a different brew. (The failure to avoid: header reads 18g:225g:93°C copied from the reference, while the pour plan pours to 230g and the rationale says "1:15.3 at 90°C" — three different recipes in one candidate.)
- waterGrams MUST equal the final cumulative waterGramsAtEnd of your last water-adding pour (bloom/pour/final/melodrip — NOT bypass, which is separate dilution). The pourSequence milestones, the pourSteps milestones, and waterGrams must agree to the gram.
- doseGrams and waterGrams must match any ratio you state in whyChosen / hypothesis / predictedCupProfile (a "1:15.3" claim means waterGrams ≈ doseGrams × 15.3). waterTempC must match any temperature you mention in the prose. Compute the prose from the fields, never the reverse.

CANDIDATE TITLES must be DISTINCT across the candidates in one response — the two candidates are different experiments, so they must read as different on the chip selector and the brew screen. Never give two candidates the same title (e.g. two "Inverted Long Immersion"); name each for the variable it tests.

Return valid JSON only.`;

  const response = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 5000,
    system: [
      { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: userMessage }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "{}";

  const raw = parseClaudeJson(text, RecommendationResponseSchema);
  if (!raw) throw new Error("Failed to parse recommendation from Claude");

  const candidates: RecommendationCandidate[] = raw.candidates.map((c) => ({
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
    usage: response.usage,
  };
}
