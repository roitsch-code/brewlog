import Anthropic from "@anthropic-ai/sdk";
import type { PatternAnalysis } from "./patterns";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── I/O types ────────────────────────────────────────────────────────────────

export interface RecentActivityEntry {
  coffee: string;
  roaster: string;
  method: string;
  rating: number;
  craft?: string;
  fit?: string;
  occasion?: string;
  grindSize?: string;
  wouldBrewAgain?: boolean;
  freeNotes?: string;
}

export interface TranslationInput {
  patterns: PatternAnalysis;
  recentActivity: RecentActivityEntry[];
  userQuery?: string;
}

export interface TranslationSubstrate {
  dominantPattern?: string;
  highestRatedSetup?: string;
  lowestRatedSetup?: string;
  recentTrend?: string;
  flags: string[];
}

export interface TranslationResult {
  narrative: string;
  substrate: TranslationSubstrate;
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

const TRANSLATE_SYSTEM = `You are interpreting a personal coffee log for the brewer who keeps it. Your job is to surface what the data actually shows — not what they said they like, not conventional wisdom, but the patterns visible in their own record.

VOICE:
- Observational, not prescriptive. Prefer "you've been," "this reads like," "the log suggests," "worth testing whether" over "you should," "I recommend," "try."
- Comfortable with "yes, but." If the evidence is mixed, say so.
- Nuanced. 3★ is not bad. 3.5★ is good. A 3★ on a rushed morning is not the same as a 3★ on a dialled-in session.
- Willing to contradict stated preferences when the data disagrees.
- Uses coffee's own vocabulary: body, brightness, structure, drawdown, extraction phases, origin character. Not imported metaphors.
- Brief. 2–4 sentences per observation, ≤150 words total for the narrative.

RULES:
- No markdown headers or bullet points in the narrative field. Prose only.
- No emojis.
- Only name patterns that have at least 2 data points backing them.
- If the data is thin (fewer than 5 sessions), say so briefly and don't claim patterns that aren't there.
- Never state a rating interpretation without citing the number ("your 4.5★ on the Kieni" not "your high-rated cup").

OUTPUT FORMAT — return valid JSON only:
{
  "narrative": "prose string shown to the user",
  "substrate": {
    "dominantPattern": "one-line label for the strongest pattern, or null",
    "highestRatedSetup": "short string describing best-performing setup, or null",
    "lowestRatedSetup": "short string describing worst-performing setup, or null",
    "recentTrend": "one-line description of the most recent directional shift, or null",
    "flags": ["oscillation:grindSize", "mismatch:rating-behavior"]
  }
}`;

// ─── Serialise pattern analysis into a compact prompt block ──────────────────

function serialiseInput(input: TranslationInput): string {
  const { patterns, recentActivity, userQuery } = input;

  const lines: string[] = [];

  lines.push(`Sessions analysed: ${patterns.sessionCount}`);

  if (recentActivity.length) {
    lines.push("\nRecent activity (newest first):");
    for (const a of recentActivity) {
      const parts = [
        `${a.method} with ${a.coffee} (${a.roaster}): ${a.rating}★`,
        a.craft ? `craft:${a.craft}` : null,
        a.fit ? `fit:${a.fit}` : null,
        a.occasion ? `occasion:${a.occasion}` : null,
        a.grindSize ? `grind:${a.grindSize}` : null,
        a.wouldBrewAgain != null
          ? a.wouldBrewAgain ? "would brew again" : "would NOT brew again"
          : null,
        a.freeNotes ? `notes:"${a.freeNotes}"` : null,
      ].filter(Boolean);
      lines.push(`  ${parts.join(" · ")}`);
    }
  }

  if (patterns.oscillation.length) {
    lines.push("\nOscillation detected:");
    for (const o of patterns.oscillation) {
      lines.push(`  ${o.coffee} — ${o.parameter}: ${o.direction}`);
    }
  }

  if (patterns.ratingBehaviorMismatch.length) {
    lines.push("\nRating-behavior mismatches:");
    for (const m of patterns.ratingBehaviorMismatch) {
      lines.push(`  ${m.description}: ${m.evidence}`);
    }
  }

  if (patterns.craftVsFitDivergence.length) {
    lines.push("\nCraft-vs-fit divergence:");
    for (const c of patterns.craftVsFitDivergence) {
      lines.push(`  ${c.coffeeName}: craft=${c.craft}, fit=${c.fit}, rating=${c.rating}★`);
    }
  }

  if (patterns.occasionDependentPreference.length) {
    lines.push("\nOccasion-dependent preference:");
    for (const o of patterns.occasionDependentPreference) {
      lines.push(
        `  ${o.coffee}: ${o.occasionA} avg ${o.avgA}★ vs ${o.occasionB} avg ${o.avgB}★`
      );
    }
  }

  if (patterns.vocabularyDrift.risingDescriptors.length || patterns.vocabularyDrift.fallingDescriptors.length) {
    lines.push("\nVocabulary drift:");
    if (patterns.vocabularyDrift.risingDescriptors.length) {
      lines.push(`  Rising: ${patterns.vocabularyDrift.risingDescriptors.join(", ")}`);
    }
    if (patterns.vocabularyDrift.fallingDescriptors.length) {
      lines.push(`  Falling: ${patterns.vocabularyDrift.fallingDescriptors.join(", ")}`);
    }
  }

  if (patterns.parameterPreferenceCorrelation.length) {
    lines.push("\nTop parameter-rating correlations:");
    for (const p of patterns.parameterPreferenceCorrelation.slice(0, 5)) {
      lines.push(`  ${p.parameter}:${p.value} → avg ${p.avgRating}★ (n=${p.sampleSize})`);
    }
  }

  if (patterns.returnPatterns.length) {
    lines.push("\nReturn patterns:");
    for (const r of patterns.returnPatterns) {
      lines.push(
        `  ${r.entityType} "${r.entity}": returned after ${r.gapDays} days, shared notes: ${r.recurringComplaints.join(", ")}`
      );
    }
  }

  if (userQuery) {
    lines.push(`\nUser query: ${userQuery}`);
  }

  return lines.join("\n");
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function translate(input: TranslationInput): Promise<TranslationResult> {
  const userContent = serialiseInput(input);

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    system: TRANSLATE_SYSTEM,
    messages: [{ role: "user", content: userContent }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "{}";

  try {
    const raw = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || "{}") as {
      narrative?: string;
      substrate?: Partial<TranslationSubstrate>;
    };
    return {
      narrative: raw.narrative ?? "",
      substrate: {
        dominantPattern: raw.substrate?.dominantPattern ?? undefined,
        highestRatedSetup: raw.substrate?.highestRatedSetup ?? undefined,
        lowestRatedSetup: raw.substrate?.lowestRatedSetup ?? undefined,
        recentTrend: raw.substrate?.recentTrend ?? undefined,
        flags: raw.substrate?.flags ?? [],
      },
    };
  } catch {
    return { narrative: "", substrate: { flags: [] } };
  }
}
