/**
 * BTTS Insights — multivariate coach pass over the full session corpus.
 *
 * Why this exists (and why it isn't `lessons.ts`):
 *   - Lessons writes one row per (level, scope) tuple, with each scope
 *     seeing only its own brews. That single-axis aggregation
 *     structurally cannot produce "low dose × delicate Pink Bourbons ×
 *     peak freshness → higher scores" — the observation lives across
 *     dose × variety × process × rating simultaneously, but lessons
 *     indexes by ONE axis at a time.
 *   - Insights runs Opus once over the whole corpus with the dormant
 *     multivariate pipeline (extractor + patterns + brewSignature)
 *     pre-computed, and asks it to spot the cross-axis stories.
 *
 * Pipeline:
 *   1. Load all rated sessions (single indexed query).
 *   2. Build brew signatures + run extractor + detect patterns.
 *   3. Serialise the structured analysis into the prompt as evidence.
 *   4. Opus writes 5–8 insights (observation + suggestion, both one
 *      sentence each, REAL numbers required).
 *   5. Replace insights rows older than the current latest-session-ms.
 *
 * Cache key: latestSessionMs on the rows. The /api/insights endpoint
 * compares it against the corpus's latest session and only re-runs Opus
 * when new brews have arrived since.
 */
import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";
import { desc, gte, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { insights, sessions } from "@/lib/db/schema";
import { rowToSession } from "@/lib/db/helpers";
import type { InsightRow } from "@/lib/db/schema";
import type { Session } from "@/lib/types/session";
import { parseClaudeJson, z } from "./parseJson";
import { buildSignatures } from "./brewSignature";
import { extract, serialiseForEscher } from "./extractor";
import { detectPatterns } from "./patterns";
import type { PatternAnalysis } from "./patterns";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const InsightItemSchema = z.object({
  observation: z.string().min(10).max(400),
  suggestion: z.string().min(10).max(400),
  citationFields: z.array(z.string().max(60)).max(8).default([]),
});

const InsightsResponseSchema = z.object({
  insights: z.array(InsightItemSchema).min(0).max(10),
});

export type InsightItem = z.infer<typeof InsightItemSchema>;

const SYSTEM_PROMPT = `You are the BrewLog Coach. You read a user's entire coffee brewing log and surface concrete, multivariate insights — observations that span TWO OR MORE axes (variety × process × freshness × method × dose × rating, etc.). Single-axis observations ("you like washed coffees") are forbidden.

Voice
- Two short sentences per insight: the observation (with real counts), then the suggestion or open question.
- No labels. No "Observation:", no "Hypothesis:", no "Suggestion:". The terminology shows up IN the writing, never as a header.
- Direct, plain English. No emoji, no markdown, no exclamation marks.

Concreteness — non-negotiable
- Every observation cites at least one real count from the data. Examples of the shape:
  - "19 of 28 washed brews scored 4★+ when in peak freshness; only 3 of 9 past-peak."
  - "Your AeroPress 1:18 brews on naturals average 4.1★ across 7 sessions; your V60 1:16 on the same naturals average 2.9★."
  - "Every 5★ you've logged on a Pink Bourbon used the championship water blend; the same beans on tap water average 3.4★."
- If a candidate insight can be written as a single-axis statement, drop it.
- If the data doesn't support 5–8 multivariate insights, return fewer. Do not invent.

Suggestion line
- Either a concrete next move ("Open the Hoppenworth Geisha tomorrow morning — your Geisha brews under 1:16.7 ratio score 4.5★ on average.")
- Or a precise question the user could test ("Would the Tegu hit your usual mark if you brewed it past day 21 next time — only one past-peak brew is logged, scoring 3.0★.")
- Never both. Never vague.

CitationFields
- List the 2–5 data fields the observation actually cites (e.g. ["variety", "freshness", "rating"], ["process", "method", "ratio"]). Used downstream to rank insights when the recommend flow sees a matching brew context.

Output ONLY a JSON object: { "insights": [ { "observation": "...", "suggestion": "...", "citationFields": ["...", "..."] } ] }. No prose around it, no markdown fences.`;

interface CoffeeAggregate {
  name: string;
  roaster: string;
  variety: string;
  process: string;
  roastLevel: string;
  origin: string;
  count: number;
  ratings: number[];
  avgRating: number;
  fieldZones?: unknown;
}

function buildCoffeeAggregates(sessionList: Session[]): CoffeeAggregate[] {
  const acc: Record<string, CoffeeAggregate> = {};
  for (const s of sessionList) {
    if (!s.coffee?.name) continue;
    const key = `${s.coffee.roaster ?? ""}__${s.coffee.name}`.toLowerCase();
    const entry = acc[key] ?? {
      name: s.coffee.name,
      roaster: s.coffee.roaster ?? "",
      variety: s.coffee.variety ?? "",
      process: s.coffee.process ?? "",
      roastLevel: s.coffee.roastLevel ?? "",
      origin: s.coffee.origin ?? "",
      count: 0,
      ratings: [] as number[],
      avgRating: 0,
    };
    entry.count += 1;
    if (s.result?.rating != null) entry.ratings.push(s.result.rating);
    acc[key] = entry;
  }
  for (const entry of Object.values(acc)) {
    entry.avgRating = entry.ratings.length
      ? Number((entry.ratings.reduce((a, b) => a + b, 0) / entry.ratings.length).toFixed(2))
      : 0;
  }
  return Object.values(acc).sort((a, b) => b.count - a.count);
}

function serialiseSessionForCoach(s: Session): string {
  const date = new Date(s.createdAt).toISOString().slice(0, 10);
  const c = s.coffee;
  const r = s.result;
  const b = s.brew;
  const rec = s.recommendation;
  const brewedRecipe =
    (b?.selectedCandidateIdx != null
      ? rec?.candidates?.[b.selectedCandidateIdx]?.recipe
      : undefined) ?? rec?.primaryRecipe;

  const tasteBits: string[] = [];
  if (r?.body) tasteBits.push(`body=${r.body}`);
  if (r?.acidity) tasteBits.push(`acid=${r.acidity}`);
  if (r?.sweetness) tasteBits.push(`sweet=${r.sweetness}`);
  if (r?.bitterness) tasteBits.push(`bitter=${r.bitterness}`);
  if (r?.finish) tasteBits.push(`finish=${r.finish}`);
  if (r?.clarity) tasteBits.push(`clarity=${r.clarity}`);

  const meta: string[] = [];
  if (c?.variety) meta.push(`var=${c.variety}`);
  if (c?.process) meta.push(`proc=${c.process}`);
  if (c?.roastLevel) meta.push(`roast=${c.roastLevel}`);
  if (c?.origin) meta.push(`origin=${c.origin}`);
  if (c?.roastDate) {
    const days = Math.floor((Date.now() - new Date(c.roastDate).getTime()) / 86_400_000);
    if (days >= 0) meta.push(`fresh=d${days}`);
  }

  const recipe: string[] = [];
  if (b?.methodUsed || rec?.primaryMethod) recipe.push(`m=${b?.methodUsed ?? rec?.primaryMethod}`);
  if (brewedRecipe?.doseGrams && brewedRecipe?.waterGrams) {
    recipe.push(`${brewedRecipe.doseGrams}g/${brewedRecipe.waterGrams}g`);
    recipe.push(`r=1:${Math.round((brewedRecipe.waterGrams / brewedRecipe.doseGrams) * 10) / 10}`);
  }
  if (b?.grindSettingUsed ?? brewedRecipe?.grindSize) recipe.push(`grind=${b?.grindSettingUsed ?? brewedRecipe?.grindSize}`);
  if (b?.actualTempC ?? brewedRecipe?.waterTempC) recipe.push(`${b?.actualTempC ?? brewedRecipe?.waterTempC}°C`);
  if (b?.actualTimeSec) recipe.push(`t=${b.actualTimeSec}s`);
  if (b?.flow && b.flow !== "na") recipe.push(`flow=${b.flow}`);
  if (s.context?.waterSource) recipe.push(`water=${s.context.waterSource}`);
  if (s.context?.occasion) recipe.push(`occ=${s.context.occasion}`);

  const quality: string[] = [];
  if (r?.craft) quality.push(`craft=${r.craft}`);
  if (r?.fit) quality.push(`fit=${r.fit}`);
  if (r?.roastQuality) quality.push(`roastQ=${r.roastQuality}`);
  if (r?.wouldBrewAgain != null) quality.push(`again=${r.wouldBrewAgain ? "y" : "n"}`);
  if (r?.improvedWhileCooling) quality.push("cooled-better");
  if (r?.matchedIntention != null) quality.push(`matched=${r.matchedIntention ? "y" : "n"}`);

  const flavors = (r?.flavorNotes ?? []).slice(0, 6).join("/");

  const rating = r?.rating != null ? `${r.rating}★` : "?";

  const coffeeLabel = c ? `${c.roaster ?? ""} ${c.name ?? ""}`.trim() : "unknown";

  const parts = [
    date,
    rating,
    coffeeLabel,
    meta.join(" "),
    recipe.join(" "),
    quality.join(" "),
    flavors ? `[${flavors}]` : "",
    r?.freeNotes ? `note="${r.freeNotes.slice(0, 120)}"` : "",
  ].filter(Boolean);

  return `- ${parts.join(" · ")}`;
}

function formatPatternAnalysis(p: PatternAnalysis): string {
  const lines: string[] = [];
  lines.push(`Sessions analysed: ${p.sessionCount}`);
  if (!p.hasEnoughData) {
    lines.push("Not enough data for confident pattern claims — surface gaps and missing-axis observations instead.");
    return lines.join("\n");
  }
  if (p.oscillation.length > 0) {
    lines.push("Grind/temp oscillations:");
    p.oscillation.forEach((o) => lines.push(`  - ${o.coffee}: ${o.direction}`));
  }
  if (p.returnPatterns.length > 0) {
    lines.push("Recurring-complaint returns:");
    p.returnPatterns.forEach((r) =>
      lines.push(`  - ${r.entity} (${r.entityType}) gap=${r.gapDays}d shared=${r.recurringComplaints.join(",")}`),
    );
  }
  if (p.ratingBehaviorMismatch.length > 0) {
    lines.push("Rating-behaviour mismatches:");
    p.ratingBehaviorMismatch.forEach((m) => lines.push(`  - ${m.description} (${m.evidence})`));
  }
  if (p.craftVsFitDivergence.length > 0) {
    lines.push("Craft-vs-fit divergences:");
    p.craftVsFitDivergence.forEach((c) =>
      lines.push(`  - ${c.coffeeName}: craft=${c.craft} fit=${c.fit} rating=${c.rating}`),
    );
  }
  if (p.occasionDependentPreference.length > 0) {
    lines.push("Occasion-dependent preferences:");
    p.occasionDependentPreference.forEach((o) =>
      lines.push(`  - ${o.coffee}: ${o.occasionA}=${o.avgA}★ vs ${o.occasionB}=${o.avgB}★`),
    );
  }
  if (p.parameterPreferenceCorrelation.length > 0) {
    lines.push("Parameter-preference correlations (avg rating | n):");
    p.parameterPreferenceCorrelation.slice(0, 12).forEach((c) =>
      lines.push(`  - ${c.parameter}=${c.value}: ${c.avgRating}★ (n=${c.sampleSize})`),
    );
  }
  if (p.vocabularyDrift.risingDescriptors.length > 0 || p.vocabularyDrift.fallingDescriptors.length > 0) {
    lines.push("Flavor vocabulary drift (recent vs early):");
    if (p.vocabularyDrift.risingDescriptors.length > 0) {
      lines.push(`  - Rising: ${p.vocabularyDrift.risingDescriptors.join(", ")}`);
    }
    if (p.vocabularyDrift.fallingDescriptors.length > 0) {
      lines.push(`  - Falling: ${p.vocabularyDrift.fallingDescriptors.join(", ")}`);
    }
  }
  return lines.join("\n");
}

function formatCoffeeAggregates(aggregates: CoffeeAggregate[]): string {
  const lines = ["Coffees brewed (most-brewed first):"];
  aggregates.slice(0, 30).forEach((c) => {
    lines.push(
      `  - ${c.roaster} ${c.name} | var=${c.variety || "?"} proc=${c.process || "?"} roast=${c.roastLevel || "?"} origin=${c.origin || "?"} n=${c.count} avg=${c.avgRating}★`,
    );
  });
  return lines.join("\n");
}

/**
 * Find the most recent session timestamp in the corpus.
 * Used as the insights cache key — re-generating insights is only useful
 * once at least one new brew has been logged.
 */
function latestSessionMs(sessionList: Session[]): number {
  return sessionList.reduce((max, s) => {
    const ms = new Date(s.createdAt).getTime();
    return ms > max ? ms : max;
  }, 0);
}

export interface GenerateInsightsResult {
  insights: InsightRow[];
  generated: boolean; // true if Opus was called this turn, false if a cached set was returned
  corpusSize: number;
  latestSessionMs: number;
}

/**
 * Idempotent entry point used by /api/insights and the Taste Profile page.
 * Returns the active insight rows; only calls Opus when the corpus has
 * advanced past the most recent insight's latestSessionMs (or when no
 * insights exist yet).
 */
export async function getOrGenerateInsights(): Promise<GenerateInsightsResult> {
  // 1. Load the rated session corpus (last ~120 brews is more than enough
  // signal density; older sessions are still in the DB if a future model
  // wants them).
  const sinceMs = Date.now() - 1000 * 60 * 60 * 24 * 365 * 2; // 2-year window
  const rows = await db
    .select()
    .from(sessions)
    .where(gte(sessions.createdAtMs, sinceMs))
    .orderBy(desc(sessions.createdAtMs))
    .limit(150);
  const sessionList = rows.map(rowToSession).filter((s) => s.result?.rating != null);

  const corpusLatest = latestSessionMs(sessionList);

  // 2. Check cache — return existing rows if the corpus hasn't advanced.
  const existing = await db
    .select()
    .from(insights)
    .orderBy(desc(insights.latestSessionMs), desc(insights.createdAt));

  const cachedLatest = existing[0]?.latestSessionMs ?? 0;
  if (existing.length > 0 && cachedLatest >= corpusLatest && sessionList.length > 0) {
    return {
      insights: existing,
      generated: false,
      corpusSize: sessionList.length,
      latestSessionMs: cachedLatest,
    };
  }

  // 3. Don't generate against an empty / tiny corpus — coach has nothing
  // to say across two brews and shouldn't pretend it does.
  if (sessionList.length < 4) {
    return {
      insights: existing,
      generated: false,
      corpusSize: sessionList.length,
      latestSessionMs: cachedLatest,
    };
  }

  // 4. Build the structured analysis evidence.
  const signatures = buildSignatures(sessionList);
  const extractorOutput = extract(signatures, {});
  const patternOutput = detectPatterns(sessionList);
  const aggregates = buildCoffeeAggregates(sessionList);

  // 5. Compose the Opus prompt.
  const promptSections = [
    `Brew log — ${sessionList.length} rated sessions, most recent first.`,
    sessionList.map(serialiseSessionForCoach).join("\n"),
    "",
    "── Structured analysis (multivariate signal) ──",
    serialiseForEscher(extractorOutput),
    "",
    formatPatternAnalysis(patternOutput),
    "",
    formatCoffeeAggregates(aggregates),
    "",
    "Write 5–8 multivariate insights now. JSON only.",
  ];

  const userMessage = promptSections.join("\n");

  // 6. Opus call. Multivariate reasoning, not summarisation — Haiku
  // flattens. Per CLAUDE.md, /recommend is the Opus-engineered surface;
  // insights joins it.
  const newItems = await callOpusForInsights(userMessage);
  if (newItems == null) {
    // Opus call failed — return what we have (cached rows are still
    // useful, and the next page-mount will retry).
    return {
      insights: existing,
      generated: false,
      corpusSize: sessionList.length,
      latestSessionMs: cachedLatest,
    };
  }

  // 7. Replace the old insight set with the freshly generated one.
  // Insights age out by construction (every regeneration uses the full
  // corpus, so all observations are re-derived). User-dismissed rows
  // stay dismissed across regenerations by id-stable hashing of the
  // observation text.
  await replaceInsights(newItems, corpusLatest);

  const fresh = await db
    .select()
    .from(insights)
    .orderBy(desc(insights.latestSessionMs), desc(insights.createdAt));

  return {
    insights: fresh,
    generated: true,
    corpusSize: sessionList.length,
    latestSessionMs: corpusLatest,
  };
}

async function callOpusForInsights(userMessage: string): Promise<InsightItem[] | null> {
  try {
    const msg = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });
    const text = msg.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const parsed = parseClaudeJson(text, InsightsResponseSchema);
    return parsed?.insights ?? null;
  } catch (err) {
    console.error("insights Opus call failed:", err);
    return null;
  }
}

async function replaceInsights(items: InsightItem[], latestMs: number): Promise<void> {
  // Preservation across regenerations:
  //   - source='user-confirmed'                          → keep verbatim, ALWAYS
  //     (user-authored or user-endorsed notes are never deleted by regen —
  //     not even after a snooze expires; they resurface in the queue instead)
  //   - status='trying' | 'confirmed' | 'doesnt-apply'   → keep verbatim
  //   - status='snoozed' AND snoozed_until > now()       → keep verbatim
  //   - status='snoozed' AND snoozed_until <= now()      → treat as 'new'
  //                                                        (replaceable)
  //   - status='new'                                     → replaceable
  //
  // Acted observation text is indexed so a re-emitted similar observation
  // inherits the existing user status instead of popping back as 'new'.
  const now = new Date();
  const old = await db.select().from(insights);

  const isActiveSnooze = (row: typeof old[number]) =>
    row.status === "snoozed" && row.snoozedUntil != null && row.snoozedUntil > now;
  const isPreserved = (row: typeof old[number]) =>
    row.source === "user-confirmed" ||
    row.status === "trying" || row.status === "confirmed" || row.status === "doesnt-apply" || isActiveSnooze(row);

  const acted = old.filter(isPreserved);
  const actedTextIndex = new Map<string, typeof acted[number]>();
  for (const row of acted) {
    actedTextIndex.set(row.observation.slice(0, 80).toLowerCase(), row);
  }

  // Replaceable rows = 'new' + expired snoozes. Snoozes that have passed
  // their window get rewritten by the fresh Opus pass like any other 'new'
  // row — they earned the second look.
  const replaceableIds = old
    .filter((r) => !isPreserved(r))
    .map((r) => r.id);
  if (replaceableIds.length > 0) {
    await db.delete(insights).where(inArray(insights.id, replaceableIds));
  }

  for (const item of items) {
    const key = item.observation.slice(0, 80).toLowerCase();
    const existingActed = actedTextIndex.get(key);
    // If Opus re-emitted an observation the user already acted on, skip
    // — the existing row (kept above) carries the user's status forward.
    if (existingActed) continue;
    await db.insert(insights).values({
      id: randomUUID(),
      observation: item.observation,
      suggestion: item.suggestion,
      citationFields: item.citationFields ?? [],
      latestSessionMs: latestMs,
      source: "opus",
      status: "new",
      dismissedAt: null,
      snoozedUntil: null,
      userNote: null,
      createdAt: now,
      updatedAt: now,
    });
  }
}
