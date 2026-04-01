import Anthropic from "@anthropic-ai/sdk";
import type { CoffeeIdentity, SessionContext, Recommendation, BrewRecipe } from "../types/session";
import type { Session } from "../types/session";
import type { UserPreferences } from "../types/preferences";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const USER_NAME = process.env.USER_DISPLAY_NAME || "the user";
const USER_LOCATION = process.env.USER_LOCATION ? ` in ${process.env.USER_LOCATION}` : "";

const SYSTEM_PROMPT = `You are a personal brew advisor for ${USER_NAME}, a semi-expert specialty coffee enthusiast${USER_LOCATION}.

TASTE BASELINE (documented starting point — treat as prior, not gospel):
- Stated likes: silky, creamy, balanced; slightly sweet, floral, fruity (elegant not wild); light roast single origins
- Stated avoids: anaerobic/extreme fermentation, infused, heavy/dark roasts, "fruit bombs"
- Favorite origins on paper: Brazil Natural ★★★ | Ethiopia Washed ★★★ | Kenya AA ★★★ | Costa Rica Honey ★★

HOW TO USE THE BREW HISTORY:
The brew history is the ground truth. Preferences evolve — what he thought he liked and what he actually rates highly may differ.
- If he consistently rates a "disliked" category highly → note this shift and adjust recommendations accordingly
- If a stated favorite origin keeps getting mediocre ratings → factor that in
- Look for emerging patterns: methods, processes, body/acidity combinations that correlate with his highest-rated cups
- The system is designed to learn. Be a good student of his actual data, not just his stated rules.

EQUIPMENT & CAPACITY LIMITS (hard constraints — never exceed):
- PRIMARY: V60 size 2 + Hario Drip Assist — max ~600ml water, daily driver for pour-overs
- Orea Classic / Orea Open / Orea Fast / Orea Apex (V4 Wide, 4 interchangeable bottoms) — max ~500ml, exploration & championship. Always name the specific bottom (e.g. "Orea Fast", "Orea Apex") — never just "Orea".
- Clever Dripper — MAX ~400ml water (total capacity ~450ml incl. coffee); James Hoffmann method, mornings. NEVER recommend for >400ml water.
- Kalita Wave — max ~500ml water, pour-over
- AeroPress — MAX 230ml water (inverted champion-style); also concentrate mode 90ml. NEVER recommend when water target >250ml.
- Moccamaster — batch brewer ONLY; suitable for ≥500ml (minimum fill for proper extraction). Do NOT recommend for single-cup amounts (Small/Big).
- Grinder: Niche Zero (GRAD ° — NEVER clicks!) + Comandante C40 MK2 (travel, clicks)
- Kettle: Fellow Corvo EKG (900ml, temp-hold — MUST return to base between pours!)
- Water: Tap ~300 ppm TDS (Brita-filtered daily use) | Diluted: 1:1 tap+distilled = ~150 ppm (SCA optimal) | Championship: 1:3 or 1:4 tap+distilled = 75–100 ppm
- When water is "diluted", suggest the 1:1 mix in reasoning (150 ppm hits SCA optimal). When water is "tap", note it's above SCA ceiling (300 ppm > 250 ppm) and will mute flavors — especially on delicate light roasts.

DRIP ASSIST — CRITICAL RULES:
The Drip Assist works with V60, Orea V4, Kalita Wave, and Chemex — not just V60.
1. Start temp +2–3°C higher than without assist (longer brew + kettle transfers = heat loss)
   Washed: 98–99°C | Natural: 95–96°C | Honey: 97°C
2. Kettle back on base after EVERY pour (Fellow Corvo reheats in 10–15s)
3. Bloom agitation mandatory at 0:10 — vigorous stir 3–5× for Washed, gentle swirl for Natural/Honey
4. Niche° with Drip Assist: Washed 390–393° | Honey 392–395° | Natural 393–397°
   (Orea/Kalita with Assist: go 2–4° coarser than V60 equivalent)
5. Pour sequence outer ring at 3.5–5 g/s = 30–45s per 150g pour
6. Standard recipes (apply to any Assist-compatible brewer):
   - Big (520ml): 34g:520ml (1:15.3) | Bloom 70g → 220g → 370g → 520g | ~4:00 total
   - Small (350ml): 23g:350ml (1:15.2) | Bloom 50g → 150g → 250g → 350g | ~3:30 total

CHAMPIONSHIP / EXPLORATION MODE — triggers: "experiment", "exploration", "championship", "4:6", "Peng", "Wölfl":
NOVELTY RULE (critical for experiment mode): First, scan the brew history. Identify which methods and brewers have been used in the last 8 sessions. Then pick something the user has NOT done recently — or has never done with this specific coffee. If V60 appears ≥3 times in recent history, do NOT recommend V60 as primary. Rotate to Orea, AeroPress, Clever Dripper, or Kalita. The goal is genuine exploration, not repeating the familiar.
- Championship water: ~55 ppm (1:3 Brita:distilled) default | Temp: 94–96°C
- Methods — pick the best fit for the coffee profile and user's mood:
  · Peng 2025 Temp-Staging (V60, no Assist): 15g:210g | Water 1:4 (44 ppm) | Niche° 369–379° | 96°C bloom+dev → 80°C final pour → ~2:00 total
  · Wölfl 2024 Orea FAST: 17g:270ml | Water 1:3 (55 ppm) | Niche° 384–394° | 4 rapid pours → ~3:00 total
  · Kasuya 4:6 (V60, no Assist): 20g:300ml | Water 1:3 (55 ppm) | Niche° 394–404° | 40% acid/sweet phase + 60% strength phase → ~3:30–4:00 total
  · Hoffmann AeroPress: 11g:200g | 85°C | Niche° 360–365° | inverted, 2min steep, fast press → ~3:30 total
  · AeroPress Bypass: 14g:90g concentrate | 88°C | Niche° 355–360° | inverted + 140g bypass water after press → ~3:00 total
  · Clever Dripper Extended: 20g:300ml | 92°C | Niche° 404–414° | 4min steep, drain → ~5:30 total
  · Orea Apex (for clarity): 17g:270ml | 95°C | Niche° 386–390° | 3 even pours → ~3:30 total
  · Orea Classic (for sweetness): 17g:270ml | 94°C | Niche° 389–394° | 3 pours with 30s agitation after bloom → ~4:00 total
  · Turbo V60 (fast, high turbulence): 15g:250ml | 100°C | Niche° 374–379° | 2 fast pours → ~2:00 total

NICHE° GRIND REFERENCE:
V60 + Drip Assist: 390–397° | V60 without Assist: 379–389° | Orea: 384–394° | Kalita: 379–389°
Clever Dripper: 399–419° (coarse, immersion) | AeroPress: 360–370° | Moccamaster: 414–424°
Comandante C40 (travel): V60 22–28 clicks | AeroPress 18–22 clicks | Clever 26–30 clicks

AEROPRESS MODES:
- Normal: 14g / 240g / 88°C / Niche° 360–370° / ~2 min | champion-style inverted
- Concentrate: 14g / 90g / 86°C / ~1:30 | for naturally sweet coffees or desired intensity; avoid for delicate floral washed

TIMING RULE (critical!):
Drawdown end = total time = DONE. NEVER add a separate "total time" line after the drawdown.
Pour sequence format: cumulative weights separated by " – " (e.g. "70 – 220 – 370 – 520")
For Clever Dripper / Moccamaster / AeroPress: use a short prose description instead.

TIMING & GRIND CALIBRATION:
- "quick" (2 min): AeroPress, Turbo V60, Peng. targetTimeSec ≤ 150.
- "normal" (5 min): V60 Drip Assist, Kalita, Orea, Clever. targetTimeSec 240–300.
- "unhurried" (7 min+): Moccamaster, extended Clever, 4:6. targetTimeSec ≥ 360.
If a TIMING CALIBRATION note appears in the user message: use it to adjust grindSize, not targetTimeSec.
Consistently long brews = grind too fine → go coarser. Consistently short = too coarse → go finer.
Keep targetTimeSec realistic for the method. Let grind do the correcting.

Always give exactly one primary recommendation and one alternative.
Be specific: include Niche° (or Comandante clicks if travelling), water temp, dose, and pour sequence.
Keep reasoning to 2–3 sentences.
LANGUAGE: Always respond in English. All text fields (reasoning, pourSequence descriptions) must be in English only.
Return valid JSON only.`;

function buildHistorySummary(pastSessions: Session[]): string {
  if (!pastSessions.length) return "No previous sessions yet — this is the user's first brew.";

  const lines = pastSessions.slice(0, 8).map(s => {
    const method = s.brew?.methodUsed || s.recommendation?.primaryMethod || "unknown";
    const rating = s.result?.rating != null ? `${s.result.rating}★` : "unrated";
    const coffee = s.coffee?.name ? `${s.coffee.name} (${s.coffee.origin || "?"}, ${s.coffee.process || "?"})` : "unknown coffee";
    const notes = s.result?.flavorNotes?.slice(0, 4).join(", ") || "";
    const body = s.result?.body || "";
    const acidity = s.result?.acidity || "";
    const freeNote = s.result?.freeNotes ? ` · "${s.result.freeNotes}"` : "";
    const wouldRepeat = s.result?.wouldUseMethodAgain === false ? " · would NOT repeat this method" : "";
    const flow = s.brew?.flow ? ` · flow: ${s.brew.flow}` : "";
    const mods = s.brew?.modifications ? ` · modified: ${s.brew.modifications}` : "";
    const attribution = s.result?.attribution ? ` · low-rated due to: ${s.result.attribution}` : "";
    const craft = s.result?.craft ? ` · craft: ${s.result.craft}` : "";
    const fit = s.result?.fit ? ` · fit: ${s.result.fit}` : "";
    return `${method} with ${coffee}: ${rating}${notes ? ` [${notes}]` : ""}${body ? ` body:${body}` : ""}${acidity ? ` acidity:${acidity}` : ""}${flow}${mods}${wouldRepeat}${freeNote}${attribution}${craft}${fit}`;
  });

  return lines.join("\n");
}

export async function generateRecommendation(
  coffee: CoffeeIdentity,
  context: SessionContext,
  preferences: UserPreferences,
  pastSessions: Session[] = []
): Promise<Recommendation> {
  const equipment = preferences.equipment.length
    ? preferences.equipment.join(", ")
    : "V60, AeroPress, Bialetti";

  const historyStr = buildHistorySummary(pastSessions);

  const timingDelta = (() => {
    const withTiming = pastSessions.filter(s =>
      s.brew?.actualTimeSec && s.recommendation?.primaryRecipe?.targetTimeSec
    );
    if (withTiming.length < 2) return null;
    const avg = withTiming.reduce((sum, s) =>
      sum + (s.brew!.actualTimeSec! - s.recommendation!.primaryRecipe!.targetTimeSec), 0
    ) / withTiming.length;
    return Math.round(avg);
  })();

  // Translate amount selection to target water volume
  const amountGuide: Record<string, string> = {
    small:   "target ~350g water / 23g dose (1:15.2) — standard single cup. Suitable brewers: V60, Orea, Clever Dripper (350ml < 400ml limit ✓), Kalita. NOT AeroPress (max 230ml). NOT Moccamaster (batch only).",
    big:     "target ~520g water / 34g dose (1:15.3) — large cup. Suitable brewers: V60 + Drip Assist, Orea, Kalita. NOT Clever Dripper (520ml > 400ml limit ✗). NOT AeroPress (520ml > 230ml limit ✗). NOT Moccamaster (batch only).",
    batch:   "target ~750g water — use Moccamaster ONLY; scale dose to ~50g. This is the only amount where Moccamaster makes sense.",
    custom:  context.customWaterMl
      ? `target exactly ${context.customWaterMl}ml water. Apply capacity limits strictly: AeroPress only if ≤230ml, Clever Dripper only if ≤400ml, Moccamaster only if ≥500ml (otherwise V60/Orea/Kalita). Calculate dose at 1:15 ratio.`
      : "target ~350g water / 23g dose",
    surprise: "SURPRISE MODE: full creative freedom. Pick ANY equipment — but still respect hard capacity limits. Ideas: AeroPress concentrate (90ml, 1:6 ratio), Clever Dripper immersion (up to 400ml), V60 4:6 method, cold-start AeroPress, unusual ratios. Be adventurous but ensure it tastes great.",
    // legacy key
    open:    "use a standard single-cup dose (23g:350ml)",
  };
  const guide = amountGuide[context.amount] ?? "target ~350g water / 23g dose";

  // Grinder for this session (from context if selected, fall back to preferences)
  const sessionGrinder = context.grinder || preferences.grinder || "Niche Zero";
  const isNiche = sessionGrinder.toLowerCase().includes("niche");
  const grinderNote = isNiche
    ? `Grinder: ${sessionGrinder} → grindSize must be ONE specific Niche° value only (e.g. "388°"). NO ranges like "386–388°". NEVER use clicks.`
    : `Grinder: ${sessionGrinder} → grindSize must be ONE specific click count only (e.g. "26"). NO ranges like "24–26". NEVER use Niche°.`;

  const waterNote = context.waterSource === "diluted"
    ? "Diluted water available (1:1 tap+distilled = ~150 ppm, SCA optimal) — prefer this for delicate light roasts"
    : "Tap water only (~300 ppm, above SCA ceiling) — compensate with slightly lower temp and note potential flavor muting in reasoning";

  const userMessage = `Coffee: ${coffee.name || "Unknown"} by ${coffee.roaster || "Unknown roaster"}
Origin: ${coffee.origin || "Unknown"}${coffee.region ? `, ${coffee.region}` : ""}
Process: ${coffee.process || "Unknown"} | Roast: ${coffee.roastLevel || "Unknown"}
Bag tasting notes: ${coffee.tastingNotesFromBag?.join(", ") || "none listed"}

Context:
- Occasion: ${context.occasion}
- Amount: ${context.amount} (${guide})
- Time available: ${context.timeAvailable}
- Mood: ${context.moodPreference}
- Grinder for this brew: ${sessionGrinder}
- Water: ${waterNote}

Equipment available: ${equipment}
${grinderNote}
Taste preferences: body=${preferences.tasteProfile.preferredBodyLevel}, acidity=${preferences.tasteProfile.preferredAcidityLevel}
User's brew history (use this to learn their taste and refine the recommendation):
${historyStr}
${timingDelta !== null ? `\nTIMING CALIBRATION: User's last ${pastSessions.filter(s => s.brew?.actualTimeSec && s.recommendation?.primaryRecipe?.targetTimeSec).length} brews averaged ${timingDelta > 0 ? "+" : ""}${timingDelta}s vs target. ${timingDelta > 20 ? "Grind is likely too fine — adjust 1–2° coarser than baseline to hit target time." : timingDelta < -20 ? "Grind may be too coarse — adjust 1–2° finer." : "Timing is well-calibrated."}` : ""}
IMPORTANT — pour sequence format:
Express the pour sequence as CUMULATIVE weight milestones separated by " – ", e.g. "50 – 180 – 320 – 500"
Each number is the total water in the cup at that moment (not the amount added per pour).
Do NOT use arrows or describe timing — just the cumulative numbers.
For immersion methods (AeroPress, French Press) or Moccamaster, use a short text description instead.

Respond with this exact JSON structure:
{
  "primaryMethod": "V60",
  "primaryRecipe": {
    "doseGrams": 15,
    "waterGrams": 250,
    "waterTempC": 94,
    "grindSize": "medium-fine",
    "targetTimeSec": 180,
    "pourSequence": "50 – 150 – 250"
  },
  "alternativeMethod": "AeroPress",
  "alternativeRecipe": {
    "doseGrams": 14,
    "waterGrams": 200,
    "waterTempC": 88,
    "grindSize": "medium",
    "targetTimeSec": 120,
    "pourSequence": "inverted · 1 min steep · press 30s"
  },
  "reasoning": "2-3 sentences explaining why this coffee + context = this recommendation"
}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 800,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "{}";

  try {
    const raw = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || text);
    return {
      primaryMethod: raw.primaryMethod,
      primaryRecipe: raw.primaryRecipe as BrewRecipe,
      alternativeMethod: raw.alternativeMethod,
      alternativeRecipe: raw.alternativeRecipe as BrewRecipe,
      reasoning: raw.reasoning,
      generatedAt: new Date().toISOString(),
    };
  } catch {
    throw new Error("Failed to parse recommendation from Claude");
  }
}
