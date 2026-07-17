import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildEscherTerrain } from "@/lib/claude/escher";
import type { Session } from "@/lib/types/session";

export const dynamic = "force-dynamic";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type RecipeNumbers = { doseGrams?: number; waterGrams?: number; waterTempC?: number };

// ─── Adaptive adjustment — computed from actual result, no pre-stated rules ──

function computeAdjustment(draft: {
  result?: {
    rating?: number;
    clarity?: string;
    sweetness?: string;
    bitterness?: string;
    finish?: string;
    craft?: string;
    fit?: string;
    roastQuality?: string;
    freeNotes?: string;
    attribution?: string;
  };
  brew?: {
    flow?: string;
    timing?: string;
  };
}): string | null {
  const result = draft.result;
  const brew = draft.brew;
  if (!result) return null;

  const { clarity, sweetness, bitterness, craft, fit, roastQuality, attribution } = result;
  const { flow } = brew ?? {};

  // Craft is the problem — not the recipe
  if (craft === "off" && (result.rating ?? 5) < 4) {
    return "The execution looks like the main variable here, not the recipe. Same setup, more care next time before adjusting anything else.";
  }

  // Bean/roast is the problem — not extraction
  if (fit === "not-my-style" || roastQuality === "poor" || attribution === "roaster") {
    if ((result.rating ?? 5) <= 3) {
      return "This one reads more like a bean or roast fit issue than an extraction problem — adjusting the recipe won't unlock what isn't there.";
    }
    return null;
  }

  // Over-extraction signals
  if (bitterness === "harsh" && flow !== "too-fast") {
    return "The harsh bitterness points toward over-extraction — try coarsening the grind or dropping the temperature slightly next time.";
  }

  // Under-extraction + fast draw-down
  if ((sweetness === "low" || clarity === "muddy") && flow === "too-fast") {
    return "Fast draw-down with low sweetness reads as under-extraction from the grind running too coarse — tighten it a step and keep everything else the same.";
  }

  // Flat cup without clear cause
  if (sweetness === "low" && clarity !== "crystal" && !bitterness) {
    return "Low sweetness without bitterness usually points to under-extraction — bloom time or grind is worth checking before temperature.";
  }

  // Short finish with otherwise clean cup
  if ((result.finish === "short") && clarity && clarity !== "muddy" && (result.rating ?? 5) >= 3.5) {
    return "Short finish on an otherwise clean cup — a slightly richer ratio or longer bloom could extend the sweetness phase.";
  }

  return null;
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { draft, recentSessions } = await req.json() as {
      draft: {
        mode?: string;
        coffee?: { name?: string; roaster?: string; origin?: string; process?: string; region?: string };
        place?: { name?: string; location?: string; methodServed?: string };
        result?: {
          rating?: number;
          flavorNotes?: string[];
          clarity?: string;
          sweetness?: string;
          bitterness?: string;
          finish?: string;
          craft?: string;
          fit?: string;
          roastQuality?: string;
          freeNotes?: string;
          attribution?: string;
        };
        brew?: {
          methodUsed?: string;
          flow?: string;
          timing?: string;
          grindSettingUsed?: string;
          actualTempC?: number;
          followedAgitation?: string;
          selectedCandidateIdx?: number;
        };
        recommendation?: {
          primaryMethod?: string;
          primaryRecipe?: RecipeNumbers;
          candidates?: { method?: string; recipe?: RecipeNumbers }[];
        };
      };
      recentSessions?: Session[];
    };

    const coffee = draft?.coffee;
    const result = draft?.result;
    const brew = draft?.brew;
    const rec = draft?.recommendation;
    const place = draft?.place;
    const isExternal = draft?.mode === "external";

    // Resolve the recipe the user ACTUALLY brewed — the selected candidate,
    // NOT primaryRecipe. Feeding the primary's numbers when an alternative was
    // brewed made the insight cite the wrong temp (96°C when 85°C was brewed).
    // Mirrors resolveBrewedRecipe / LightStepSummary's own resolution.
    const idx = brew?.selectedCandidateIdx;
    const brewedCandidate =
      (idx != null ? rec?.candidates?.[idx] : undefined) ??
      (brew?.methodUsed ? rec?.candidates?.find((c) => c.method === brew.methodUsed) : undefined);
    const brewedRecipe = brewedCandidate?.recipe ?? rec?.primaryRecipe;
    const brewedMethod = brewedCandidate?.method || brew?.methodUsed || rec?.primaryMethod;

    if (!coffee?.name || result?.rating == null) {
      return NextResponse.json({ terrain: null, adjustment: null });
    }

    const sessions: Session[] = Array.isArray(recentSessions) ? recentSessions : [];

    // Café sessions: no extraction adjustment advice (not actionable for a visited café)
    const adjustment = isExternal ? null : computeAdjustment(draft);

    // Escher terrain only makes sense for home brew history
    const terrain = (!isExternal && sessions.length >= 3)
      ? await buildEscherTerrain(sessions, {
          name: coffee.name ?? "",
          roaster: coffee.roaster ?? "",
          origin: coffee.origin ?? "",
          process: coffee.process ?? "",
        }).catch(() => null)
      : null;

    // If terrain is empty, generate a one-liner via Haiku
    let finalTerrain = terrain;
    if (!finalTerrain) {
      const prompt = isExternal
        ? `You are giving someone a brief insight after they tasted a coffee at a café. Speak directly to them as "you".

This visit:
- Coffee: ${coffee.name} by ${coffee.roaster || "?"}
- Origin: ${[coffee.origin, coffee.region].filter(Boolean).join(", ") || "unknown"} | Process: ${coffee.process || "unknown"}
${place?.name ? `- Café: ${place.name}${place.location ? ` in ${place.location}` : ""}` : ""}
- Method: ${brew?.methodUsed || place?.methodServed || "unknown"}
- Rating: ${result.rating}/5
- Flavor notes: ${result.flavorNotes?.join(", ") || "none"}
- Notes: ${result.freeNotes || "none"}

Write 1–2 sentences of personal, specific insight about this coffee — what made it interesting, how the origin or process character came through, or what it says about the café's sourcing. Do not give home-brew extraction or grind advice. No generic praise. No emojis.`
        : `You are reviewing a brew session with the person who just brewed it. Speak directly to them as "you" — never refer to them in the third person.

This session:
- Coffee: ${coffee.name} by ${coffee.roaster || "?"}
- Origin: ${[coffee.origin, coffee.region].filter(Boolean).join(", ") || "unknown"} | Process: ${coffee.process || "unknown"}
- Method: ${brewedMethod || "unknown"}
- Rating: ${result.rating}/5
- Flavor notes: ${result.flavorNotes?.join(", ") || "none"}
- Free notes: ${result.freeNotes || "none"}
${brewedRecipe ? `- Recipe: ${brewedRecipe.doseGrams}g / ${brewedRecipe.waterGrams}g / ${brewedRecipe.waterTempC}°C` : ""}
${brew?.grindSettingUsed ? `- Grind used: ${brew.grindSettingUsed}` : ""}
${brew?.followedAgitation ? `- Agitation: ${brew.followedAgitation}` : ""}

Write 1–2 sentences of personal, specific insight about this session. No generic praise. No emojis. Speak like a knowledgeable coffee friend. Reference an expert only when it genuinely adds value (Rao, Perger, Gagné, Solis).

Do NOT restate the recipe's temperature, dose, water, grind, or time back to the brewer — not as digits AND not as spelled-out words (never write "96", "ninety-six degrees", "15 grams", etc.). Give the DIRECTION to change instead (hotter/cooler, finer/coarser, longer/shorter, a richer/leaner ratio). The recipe line above is context for your reasoning only.`;

      try {
        const msg = await client.messages.create({
          model: "claude-haiku-4-5",
          max_tokens: 120,
          messages: [{ role: "user", content: prompt }],
        });
        finalTerrain = (msg.content[0] as { type: string; text: string })?.text?.trim() || null;
      } catch {
        finalTerrain = null;
      }
    }

    return NextResponse.json({ terrain: finalTerrain, adjustment });
  } catch (err) {
    console.error("brew-insight error:", err);
    return NextResponse.json({ terrain: null, adjustment: null });
  }
}
