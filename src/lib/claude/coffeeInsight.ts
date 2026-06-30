import { z } from "zod";
import { parseClaudeJson } from "./parseJson";
import type { Coffee } from "@/lib/types/coffee";
import type { Session } from "@/lib/types/session";
import { resolveBrewedRecipe } from "@/lib/utils/resolveRecipe";
import { getRoasterPrior, formatRoasterPriorForPrompt } from "@/lib/roasters/priors";
import { getVarietyPriorsForBag } from "@/lib/knowledge/varieties";
import { callCoachModel } from "@/lib/ai/coachProvider";

/**
 * Per-coffee coach insight.
 *
 * Generates ONE observation + ONE suggestion specific to THIS coffee.
 * Draws on:
 *   - This coffee's attributes (variety, process, origin, roast, tasting
 *     notes from the bag, the user's recorded common notes)
 *   - This coffee's brew history (every session with the actually-brewed
 *     recipe, rating, flavor notes, body, acidity)
 *   - Roaster prior (Friedhats, SEY, April, … — clarity bias, temp bias,
 *     method affinities)
 *   - Variety prior (Gesha, SL28, Pink Bourbon … — aromatic ceiling,
 *     acidity / body shape)
 *
 * Output is a two-paragraph card matching the existing CoachCard UX.
 *
 * Cache key is `(coffeeId, latestSessionMs)`. The orchestrator
 * regenerates when a newer session lands, EXCEPT when the user is
 * mid-`trying` or `confirmed` — don't change the card under them.
 */

const InsightSchema = z.object({
  observation: z.string().min(20).max(600),
  suggestion: z.string().min(20).max(400),
});

export interface GeneratedCoffeeInsight {
  observation: string;
  suggestion: string;
}

const SYSTEM_PROMPT = `You are a coffee expert writing a single, grounded coach note about ONE specific bag of coffee the user owns. Not their library, not coffees in general — THIS bag.

Output is two short paragraphs:

1. OBSERVATION — what their data on THIS coffee says, citing real numbers from THEIR brew history of THIS coffee when they have one (dose, water, temperature, grind degree, rating, the flavor notes they recorded). When there's no brew history yet, ground in the bag's attributes + named roaster and variety priors (e.g. "Friedhats roasts on the lighter side and biases toward clarity"; "Gesha lots reward 92–94°C and minimal agitation").

2. SUGGESTION — ONE concrete next move, expressed for the next brew. A specific dial change (cooler by 2 °C, coarser by 5°, 1:16 → 1:17, swirl-not-stir), or one specific thing to watch (whether the floral lifts on cooling, whether the dry finish softens at 92 °C vs 96 °C). Not generic.

NON-NEGOTIABLES:
- Mention THIS coffee by roaster + name in the observation when relevant. The card lives on the coffee detail page; the user already knows which coffee it's about, so name it sparingly — once is plenty.
- If there are zero brews of THIS coffee, say so plainly ("First time brewing this bag — here's what to anchor on"). Don't invent history.
- If there are 1+ brews, cite the actual numbers from the brew history given to you. Don't invent or round.
- Direct address ("you"), no preamble.
- 40–80 words for observation, 25–50 for suggestion.

Return JSON only: { "observation": string, "suggestion": string }`;

/**
 * Build the per-coffee user prompt. All numeric history comes from
 * resolveBrewedRecipe (the actually-brewed candidate, not primaryRecipe)
 * so we never quote a recipe the user didn't actually use.
 */
function buildUserPrompt(coffee: Coffee, sessionsForCoffee: Session[]): string {
  const lines: string[] = [];

  // 1. The coffee itself.
  lines.push("THIS COFFEE:");
  lines.push(`- Roaster: ${coffee.roaster}`);
  lines.push(`- Name: ${coffee.name}`);
  lines.push(`- Origin: ${coffee.origin}`);
  lines.push(`- Process: ${coffee.process}`);
  // Attribute fallback from the latest scanned session — coffee row only
  // carries roaster/name/origin/process; variety + roast + region come
  // from the per-session CoffeeIdentity (most recent first).
  const latest = sessionsForCoffee[0]?.coffee;
  if (latest?.variety) lines.push(`- Variety: ${latest.variety}`);
  if (latest?.roastLevel) lines.push(`- Roast: ${latest.roastLevel}`);
  if (latest?.region) lines.push(`- Region: ${latest.region}`);
  if (latest?.fermentationStyle) lines.push(`- Fermentation: ${latest.fermentationStyle}`);
  if (latest?.tastingNotesFromBag?.length) {
    lines.push(`- Tasting notes from bag: ${latest.tastingNotesFromBag.join(", ")}`);
  }
  if (coffee.commonNotes?.length) {
    lines.push(`- Notes you consistently taste: ${coffee.commonNotes.join(", ")}`);
  }
  if (coffee.latestRoastDate) {
    const ageDays = Math.round(
      (Date.now() - new Date(coffee.latestRoastDate).getTime()) / (1000 * 60 * 60 * 24),
    );
    lines.push(`- Roast date: ${coffee.latestRoastDate} (~${ageDays} days ago)`);
  }
  if (coffee.personalNotes) {
    lines.push(`- Your own notes on this bag: ${coffee.personalNotes}`);
  }
  lines.push("");

  // 2. Brew history with this bag.
  const rated = sessionsForCoffee.filter((s) => s.result?.rating != null);
  lines.push(`BREW HISTORY (${sessionsForCoffee.length} brews, ${rated.length} rated):`);
  if (sessionsForCoffee.length === 0) {
    lines.push("- None yet. This is the user's first encounter with this bag.");
  } else {
    // Most recent 8 — keeps the prompt tight and weights recent.
    const recent = sessionsForCoffee.slice(0, 8);
    for (const s of recent) {
      const { recipe, candidate, method } = resolveBrewedRecipe(s);
      if (!recipe) continue;
      const date = s.createdAt
        ? new Date(s.createdAt).toISOString().slice(0, 10)
        : "?";
      const grind = s.brew?.grindSettingUsed ?? recipe.grindSize ?? "?";
      const actualTime = s.brew?.actualTimeSec
        ? `${Math.floor(s.brew.actualTimeSec / 60)}:${String(s.brew.actualTimeSec % 60).padStart(2, "0")}`
        : "?";
      const rating = s.result?.rating != null ? `${s.result.rating}★` : "unrated";
      const flavors = s.result?.flavorNotes?.length
        ? ` "${s.result.flavorNotes.join(", ")}"`
        : "";
      const body = s.result?.body ? ` body=${s.result.body}` : "";
      const acidity = s.result?.acidity ? ` acidity=${s.result.acidity}` : "";
      const recipeName = candidate?.title || method || "unknown recipe";
      lines.push(
        `- ${date} ${method ?? "?"} ${recipe.doseGrams}g/${recipe.waterGrams}g ${recipe.waterTempC}°C grind=${grind} ${actualTime} → ${rating}${body}${acidity}${flavors} [${recipeName}]`,
      );
    }
  }
  lines.push("");

  // 3. Roaster prior (only when curated — fallback returns noise).
  const roasterPrior = getRoasterPrior(coffee.roaster);
  if (roasterPrior.confidence !== "fallback") {
    lines.push("ROASTER PRIOR:");
    lines.push(formatRoasterPriorForPrompt(roasterPrior));
    lines.push("");
  }

  // 4. Variety prior (only when the variety string maps to a known one).
  if (latest?.variety) {
    const varietyPriors = getVarietyPriorsForBag(latest.variety);
    if (varietyPriors.length > 0) {
      lines.push("VARIETY PRIOR:");
      for (const v of varietyPriors) {
        lines.push(`- ${v.name}: ${v.cupSignature} (acidity ${v.acidity}/body ${v.body}/aromatics ${v.aromatics})`);
        if (v.brewingTendencies) lines.push(`  Brewing: ${v.brewingTendencies}`);
      }
      lines.push("");
    }
  }

  lines.push(
    "Write the coach note now. JSON only. ONE observation + ONE suggestion, both specific to THIS bag.",
  );

  return lines.join("\n");
}

export async function generateCoffeeInsight(
  coffee: Coffee,
  sessionsForCoffee: Session[],
): Promise<GeneratedCoffeeInsight | null> {
  try {
    const userMessage = buildUserPrompt(coffee, sessionsForCoffee);
    // Routes through coachProvider (Mistral Large when the coach key is set,
    // else Opus; auto-fallback to Opus on a Mistral error).
    const { text } = await callCoachModel({
      system: SYSTEM_PROMPT,
      user: userMessage,
      maxTokens: 1200,
    });
    return parseClaudeJson(text, InsightSchema);
  } catch (err) {
    console.error("coffeeInsight generation failed:", err);
    return null;
  }
}
