/**
 * BTTS Insights — the GENERAL coach over the full session corpus.
 *
 * What it writes (since 2026-10-17): patterns in the owner's technique,
 * habits and taste — never advice about one bag. Per-coffee advice lives in
 * `coffeeInsight.ts` and shows on /coffees/[id]. The rows feed three surfaces:
 * the /taste queue (Save to try / Confirmed / Doesn't apply), /recommend's
 * COACH INSIGHTS block, and /greeting's COACH SIGNAL.
 *
 * Pipeline:
 *   1. Load all rated sessions (single indexed query).
 *   2. Count the technique/habit/preference evidence (techniqueSummary.ts),
 *      build brew signatures, run extractor + pattern detection.
 *   3. Serialise all of it into the prompt as evidence, with the coach's own
 *      earlier rows and the user's verdicts on them (coachPriors.ts).
 *   4. The coach model writes 4–7 insights (observation + tip, one sentence
 *      each, REAL counts required).
 *   5. Replace the replaceable rows (status 'new'); keep everything the user
 *      acted on.
 *
 * Cache key: latestSessionMs on the rows, plus COACH_PROMPT_CHANGED_AT_MS so a
 * prompt change regenerates once without waiting for the next brew.
 */
import { randomUUID } from "crypto";
import { desc, gte, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { insights, sessions } from "@/lib/db/schema";
import { rowToSession } from "@/lib/db/helpers";
import type { InsightRow } from "@/lib/db/schema";
import type { Session } from "@/lib/types/session";
import { parseClaudeJson, z } from "./parseJson";
import { buildSignatures } from "./brewSignature";
import { formatMeasuredPour } from "@/lib/brew/flowAnalysis";
import { resolveBrewedRecipe } from "@/lib/utils/resolveRecipe";
import { extract, serialiseForEscher } from "./extractor";
import { detectPatterns } from "./patterns";
import type { PatternAnalysis } from "./patterns";
import { callCoachModel } from "@/lib/ai/coachProvider";
import { formatPriorInsightsForCoach } from "./coachPriors";
import { formatTechniqueSummary } from "./techniqueSummary";

const InsightItemSchema = z.object({
  observation: z.string().min(10).max(400),
  suggestion: z.string().min(10).max(400),
  citationFields: z.array(z.string().max(60)).max(8).default([]),
});

const InsightsResponseSchema = z.object({
  insights: z.array(InsightItemSchema).min(0).max(10),
});

export type InsightItem = z.infer<typeof InsightItemSchema>;

/**
 * The GENERAL coach (2026-10-17). Until then this prompt asked for
 * "multivariate" insights and every example it gave was about one bag ("Open
 * the Hoppenworth Geisha tomorrow"), so the Taste Profile filled up with
 * per-coffee advice that duplicated the card on /coffees/[id]. The owner's
 * ask: kill the bag-specific coach here; detect patterns, behaviours, taste
 * preferences and general tips instead ("pour more consistently — aggressive
 * flows disturb the bed", "you tend to prefer washed Central and South
 * Americans"). Per-coffee advice stays on the coffee's own page.
 */
const SYSTEM_PROMPT = `You are the BrewLog Coach. You read one person's entire coffee brewing log and tell them what THEY do — as a brewer and as a taster. You coach the person, not a bag of coffee.

What an insight is about — exactly one of these
- Technique: how they pour (steadiness, pace, running ahead of the plan), how their brew time lands against the plan, grind that drifts back and forth, agitation habits, whether following the recipe or changing it serves them better.
- Habits: which brewers, waters, occasions and times of day they reach for, what they do when a cup misses, what they never vary.
- Taste preferences: what kinds of coffee they keep rating high or low — by process, origin, variety, roast level, brewer, water — and the sensory shape of their favourites (body, acidity, sweetness, clarity).
- A general tip that follows from one of the above.

Never about one coffee
- An insight is never about a single bag, roaster or coffee. It must hold across the log, or across at least two different coffees. If the only evidence is one coffee, drop it — the coffee's own page has a card for that.
- A coffee may be NAMED only as one example inside a pattern that spans several ("…as with the Guji and the Tegu").
- No "open X tomorrow", no "brew Y again", no recipe for a particular bag.

Voice
- Two short sentences per insight: the observation (with real counts from the log), then the tip or the question to test.
- Speak to the person: "you pour", "you rate", "you tend to".
- No labels. No "Observation:", no "Suggestion:". Direct, plain English. No emoji, no markdown, no exclamation marks.

Concreteness — non-negotiable
- Every observation cites at least one real count from the data. Shapes that work:
  - "Your even pours average 4.3★ over 9 brews; the 5 uneven ones average 3.4★."
  - "You pour at 4–6 g/s and the cups you rate 4★+ sit at the slow end of that range."
  - "16 of your 21 washed Colombian and Guatemalan brews earned 4★ or more; naturals from anywhere sit at 3.5★ across 12."
  - "You changed the recipe on 14 of the last 30 brews; those average 3.6★ against 4.1★ when you followed it."
- The log is selection-biased: they buy the coffees they expect to like, so the absence of a flavour, origin or process is NOT evidence of a dislike. Say what they rate high; do not infer what they avoid.
- If the data does not support 4–7 such insights, return fewer. Do not invent, do not pad.

Tip line
- A general move for the next brews ("Pour the main pours at the slow end of your range and watch whether the 4★ share holds.")
- Or a precise question they could test across several brews ("Does a washed natural from Ethiopia land where your Central Americans do if you brew it on the Orea instead of the V60?")
- Never both. Never vague. Never aimed at one bag.

CitationFields
- List the 2–5 data fields the observation actually cites (e.g. ["method", "rating"], ["process", "origin", "rating"], ["pour", "rating"]). Used downstream to rank insights when the recommend flow sees a matching brew context.

Output ONLY a JSON object: { "insights": [ { "observation": "...", "suggestion": "...", "citationFields": ["...", "..."] } ] }. No prose around it, no markdown fences.`;

/**
 * Rows the model wrote under the old per-coffee prompt are stale evidence, but
 * the cache key (latestSessionMs) would keep serving them until the next rated
 * brew. Any replaceable row (source 'opus', status 'new') created before this
 * instant forces one regeneration. Rows the user acted on are untouched: they
 * are his, whatever prompt wrote them. Bump when the prompt changes again.
 */
export const COACH_PROMPT_CHANGED_AT_MS = Date.parse("2026-10-17T00:00:00Z");

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

/** Exported for tests: this is the line the coach model actually reads, so a
 *  field that never reaches it is a field the coach cannot use. */
export function serialiseSessionForCoach(s: Session): string {
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
  // The clearest over-extraction marker in the log — a dry, puckering finish
  // means ground too fine / too hot / too long, which "bitter" alone does not
  // distinguish from a dark-roast bitterness the brew can't fix. Collected on
  // every tasting and read by no prompt until 2026-08-23.
  if (r?.astringency) tasteBits.push(`astringent=${r.astringency}`);
  if (r?.balance) tasteBits.push(`balance=${r.balance}`);

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
  // WHICH recipe the brew followed. Never in this line before 2026-10-03, so
  // the coach could not learn "reference X suits coffee type Y" — the single
  // question the recommender most needs answered about this user.
  {
    const cand = resolveBrewedRecipe(s).candidate;
    const ref = cand?.basedOn?.trim() || cand?.title?.trim();
    if (ref) recipe.push(`rec="${ref.slice(0, 60)}"`);
  }
  if (brewedRecipe?.doseGrams && brewedRecipe?.waterGrams) {
    recipe.push(`${brewedRecipe.doseGrams}g/${brewedRecipe.waterGrams}g`);
    recipe.push(`r=1:${Math.round((brewedRecipe.waterGrams / brewedRecipe.doseGrams) * 10) / 10}`);
  }
  if (b?.grindSettingUsed ?? brewedRecipe?.grindSize) recipe.push(`grind=${b?.grindSettingUsed ?? brewedRecipe?.grindSize}`);
  if (b?.actualTempC ?? brewedRecipe?.waterTempC) recipe.push(`${b?.actualTempC ?? brewedRecipe?.waterTempC}°C`);
  if (b?.actualTimeSec) recipe.push(`t=${b.actualTimeSec}s`);
  if (b?.flow && b.flow !== "na") recipe.push(`flow=${b.flow}`);
  // Logged on every brew, read by nothing until 2026-10-03: the user's own
  // timing verdict, whether the recipe was followed, and what they actually did.
  if (b?.timing) recipe.push(`timing=${b.timing}`);
  if (b?.followedRecipe === true) recipe.push("followed=y");
  if (b?.modifications?.trim()) recipe.push(`did="${b.modifications.trim().slice(0, 80)}"`);
  if (b?.agitationNote?.trim()) recipe.push(`agit="${b.agitationNote.trim().slice(0, 60)}"`);
  // Objective pour measurement from a connected scale, when captured — the
  // channeling/overshoot signal the coach needs to tell "your technique" from
  // "the bean". Was stored and read by no prompt until now.
  { const mp = formatMeasuredPour(b?.flowAnalysis); if (mp) recipe.push(`pour[${mp}]`); }
  if (s.context?.waterSource) recipe.push(`water=${s.context.waterSource}`);
  if (s.context?.occasion) recipe.push(`occ=${s.context.occasion}`);

  const quality: string[] = [];
  if (r?.craft) quality.push(`craft=${r.craft}`);
  if (r?.fit) quality.push(`fit=${r.fit}`);
  if (r?.roastQuality) quality.push(`roastQ=${r.roastQuality}`);
  // "What held it back most?" — the user's own blame. held=recipe means the
  // recommended recipe was the fault, not the hand or the bean (2026-10-10).
  if (r?.attribution) quality.push(`held=${r.attribution}`);
  if (r?.wouldBrewAgain != null) quality.push(`again=${r.wouldBrewAgain ? "y" : "n"}`);
  if (r?.improvedWhileCooling) quality.push("cooled-better");
  if (r?.matchedIntention != null) quality.push(`matched=${r.matchedIntention ? "y" : "n"}`);
  // The user's own verdict against the previous brew of the same coffee
  // (2026-10-03). "vs=better(4→4.5)" is worth more to the coach than either
  // star alone: it is the one comparison the user made with both cups in mind.
  if (r?.vsPrevious) {
    const pair = r.previousRating != null && r.rating != null ? `(${r.previousRating}→${r.rating})` : "";
    quality.push(`vs=${r.vsPrevious}${pair}`);
  }

  const flavors = (r?.flavorNotes ?? []).slice(0, 6).join("/");

  const rating = r?.rating != null ? `${r.rating}★` : "?";

  const coffeeLabel = c ? `${c.roaster ?? ""} ${c.name ?? ""}`.trim() : "unknown";

  const parts = [
    date,
    rating,
    coffeeLabel,
    meta.join(" "),
    recipe.join(" "),
    // The per-session sensory reading. Assembled since this formatter was
    // written and, until 2026-08-23, JOINED INTO NOTHING — `tasteBits` was
    // built and then never placed in this array, so body/acidity/sweetness/
    // bitterness/finish/clarity reached the coach on no session, ever (git
    // log -S 'tasteBits.join' returns no commit). The coach was left inferring
    // taste from the flavour-note list and the star rating alone, which is
    // precisely the axis it is asked to reason across.
    tasteBits.join(" "),
    quality.join(" "),
    flavors ? `[${flavors}]` : "",
    r?.freeNotes ? `note="${r.freeNotes.slice(0, 120)}"` : "",
    // The post-rating micro-dialogue. When a rating was ambiguous the app asked
    // ONE targeted question and the user answered it — the single most direct
    // statement of what they actually tasted that the corpus contains. It was
    // stored and then read by nobody, so the app was spending the user's
    // attention mid-log and discarding the reply.
    r?.coachAnswer?.answer
      ? `asked="${r.coachAnswer.question.slice(0, 90)}" answered="${r.coachAnswer.answer.slice(0, 90)}"`
      : "",
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
  // 80, not 30: with 63 coffees in the library a 30-cap dropped half of them
  // from the aggregate the coach reasons over — and the dropped half is the
  // long tail, exactly where a cross-coffee pattern would show up.
  aggregates.slice(0, 80).forEach((c) => {
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
  // 1. Load the rated session corpus. The window has to sit ABOVE the actual
  // brew count or the coach silently reasons about a subset — at 184 logged
  // brews the old 150 cap hid the earliest ~34, which is where the long-run
  // patterns it exists to find actually live.
  const sinceMs = Date.now() - 1000 * 60 * 60 * 24 * 365 * 2; // 2-year window
  const rows = await db
    .select()
    .from(sessions)
    .where(gte(sessions.createdAtMs, sinceMs))
    .orderBy(desc(sessions.createdAtMs))
    .limit(400);
  const sessionList = rows.map(rowToSession).filter((s) => s.result?.rating != null);

  const corpusLatest = latestSessionMs(sessionList);

  // 2. Check cache — return existing rows if the corpus hasn't advanced.
  const existing = await db
    .select()
    .from(insights)
    .orderBy(desc(insights.latestSessionMs), desc(insights.createdAt));

  const cachedLatest = existing[0]?.latestSessionMs ?? 0;
  const writtenByOldPrompt = existing.some(
    (r) => r.source === "opus" && r.status === "new" && r.createdAt.getTime() < COACH_PROMPT_CHANGED_AT_MS,
  );
  if (existing.length > 0 && cachedLatest >= corpusLatest && sessionList.length > 0 && !writtenByOldPrompt) {
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
    // The general coach's evidence: pour steadiness and pace, timing against
    // the plan, recipe adherence, blame, and rating by attribute across bags —
    // all counted, never estimated (techniqueSummary.ts).
    formatTechniqueSummary(sessionList),
    "",
    "── Structured analysis ──",
    serialiseForEscher(extractorOutput),
    "",
    formatPatternAnalysis(patternOutput),
    "",
    formatCoffeeAggregates(aggregates),
    "",
    // The coach's own earlier rows with the user's verdicts (coachPriors.ts).
    // Without this a rejected insight came back reworded as `new`, and a
    // confirmed one was neither built on nor kept out of the way.
    formatPriorInsightsForCoach(
      existing.map((r) => ({
        observation: r.observation,
        suggestion: r.suggestion,
        status: r.status,
        source: r.source,
        createdAt: r.createdAt,
      })),
    ),
    "",
    "Write 4–7 insights about this person's technique, habits and taste now — none about a single coffee. JSON only.",
  ];

  const userMessage = promptSections.join("\n");

  // 6. Coach model call. Multivariate reasoning, not summarisation — Haiku
  // flattens. Routes through coachProvider (Mistral Large when the coach key
  // is set, else Opus; auto-fallback to Opus on a Mistral error).
  const newItems = await callCoachForInsights(userMessage);
  if (newItems == null) {
    // Model call failed — return what we have (cached rows are still
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

async function callCoachForInsights(userMessage: string): Promise<InsightItem[] | null> {
  try {
    const { text } = await callCoachModel({
      system: SYSTEM_PROMPT,
      user: userMessage,
      maxTokens: 3000,
    });
    const parsed = parseClaudeJson(text, InsightsResponseSchema);
    return parsed?.insights ?? null;
  } catch (err) {
    console.error("insights coach call failed:", err);
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
