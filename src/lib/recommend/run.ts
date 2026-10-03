import { and, desc, eq, isNull, lte, ne, or, sql } from "drizzle-orm";
import { generateRecommendation, type RecommendInsight } from "@/lib/claude/recommend";
import { buildEscherTerrain } from "@/lib/claude/escher";
import { db } from "@/lib/db/client";
import { loadRecentSessions } from "@/lib/claude/sessionCorpus";
import { coffees, preferences as preferencesTable, roasters, insights as insightsTable } from "@/lib/db/schema";
import { canonicalRoasterSlug } from "@/lib/roasters/priors";
import type { UserPreferences } from "@/lib/types/preferences";
import type { RoasterPrior } from "@/lib/roasters/priors";
import type { CoffeeIdentity, Recommendation, Session, SessionContext } from "@/lib/types/session";

/**
 * The full recommendation pipeline minus auth/HTTP: parallel DB lookups
 * (roaster prior, Escher terrain, coffee history, coach insights) →
 * generateRecommendation. Shared by the legacy synchronous `/api/recommend`
 * POST and the background job kicked off in `/api/recommend/start`. Lives in
 * lib (not a route) so neither route imports another route's module.
 */

/**
 * Aggregated tasting history for this coffee — what the user actually tastes
 * across logged sessions, plus the AI brew memory. Both are written by the
 * weekly /api/coffees/compact cron and may be undefined for first brews or
 * coffees with <2 sessions.
 */
interface CoffeeHistory {
  commonNotes?: string[];
  writtenSummary?: string;
  /** The coffee's own coach card (coffees.coach_insight), unless rejected. */
  coachCard?: { observation: string; suggestion: string; status: string };
}

function mapCoffeeHistory(row: {
  commonNotes: unknown;
  writtenSummary: string | null;
  coachInsight?: unknown;
}): CoffeeHistory | undefined {
  const notes = Array.isArray(row.commonNotes) ? (row.commonNotes as string[]) : undefined;
  const summary = row.writtenSummary ?? undefined;
  const card = row.coachInsight as
    | { observation?: unknown; suggestion?: unknown; status?: unknown; snoozedUntil?: unknown }
    | null
    | undefined;
  const snoozeActive =
    card?.status === "snoozed" &&
    typeof card.snoozedUntil === "string" &&
    Date.parse(card.snoozedUntil) > Date.now();
  const coachCard =
    card &&
    typeof card.observation === "string" &&
    typeof card.suggestion === "string" &&
    typeof card.status === "string" &&
    card.status !== "doesnt-apply" &&
    !snoozeActive
      ? { observation: card.observation, suggestion: card.suggestion, status: card.status }
      : undefined;
  if ((!notes || notes.length === 0) && !summary && !coachCard) return undefined;
  return {
    commonNotes: notes && notes.length > 0 ? notes : undefined,
    writtenSummary: summary,
    coachCard,
  };
}

async function loadCoffeeHistory(
  coffeeId: string | undefined,
  roaster: string | undefined,
  name: string | undefined,
): Promise<CoffeeHistory | undefined> {
  try {
    if (coffeeId) {
      const direct = await db
        .select({
          commonNotes: coffees.commonNotes,
          writtenSummary: coffees.writtenSummary,
          coachInsight: coffees.coachInsight,
        })
        .from(coffees)
        .where(eq(coffees.id, coffeeId))
        .limit(1);
      if (direct.length > 0) return mapCoffeeHistory(direct[0]);
    }
    if (roaster && name) {
      const fallback = await db
        .select({
          commonNotes: coffees.commonNotes,
          writtenSummary: coffees.writtenSummary,
          coachInsight: coffees.coachInsight,
        })
        .from(coffees)
        .where(and(eq(coffees.roaster, roaster), eq(coffees.name, name)))
        .limit(1);
      if (fallback.length > 0) return mapCoffeeHistory(fallback[0]);
    }
  } catch (err) {
    console.error("loadCoffeeHistory error:", err);
  }
  return undefined;
}

export async function runRecommendation(body: {
  coffee: unknown;
  context: unknown;
  pastSessions?: unknown;
}): Promise<Recommendation> {
  const { coffee, context, pastSessions } = body as {
    coffee: CoffeeIdentity;
    context: SessionContext;
    pastSessions?: Session[];
  };

  let preferences: UserPreferences | null = null;
  try {
    const rows = await db.select().from(preferencesTable).where(eq(preferencesTable.key, "default")).limit(1);
    if (rows.length > 0) preferences = rows[0].data as UserPreferences;
  } catch {}
  const prefs = preferences || {
    equipment: ["V60", "OreaV4", "Kalita", "Chemex", "Origami (cone)", "Origami (wave)", "CleverDripper", "AeroPress", "Moccamaster"],
    grinder: "Niche Zero",
    tasteProfile: { preferredBodyLevel: "medium", preferredAcidityLevel: "medium-high", likedOrigins: ["Ethiopia", "Brazil", "Kenya", "Costa Rica"], likedProcesses: ["Natural", "Washed", "Honey"], avoidProcesses: ["Anaerobic"] },
    defaultAmount: "small",
    onboardingComplete: true,
  };

  // Run DB roaster lookup, corpus + Escher terrain, coffee-history lookup, and
  // multivariate coach insights in parallel — saves 3–5s vs sequential.
  //
  // The corpus read belongs INSIDE this block, not in front of it: it is a
  // 400-row query, and putting it on the critical path adds its full latency
  // to every recipe the user waits for. Escher is the only consumer that needs
  // the sessions, so it chains off the same branch instead of blocking the
  // other three lookups.
  const [
    userRoasterPriorResult,
    corpus,
    coffeeHistory,
    coachInsights,
  ] = await Promise.all([
    (async (): Promise<RoasterPrior | null> => {
      if (!coffee?.roaster) return null;
      try {
        const slug = canonicalRoasterSlug(coffee.roaster);
        const direct = await db.select().from(roasters).where(eq(roasters.slug, slug)).limit(1);
        if (direct.length > 0) return direct[0].data as RoasterPrior;
        const viaAlias = await db
          .select()
          .from(roasters)
          .where(sql`${roasters.aliases} @> ${JSON.stringify([slug])}::jsonb`)
          .limit(1);
        if (viaAlias.length > 0) return viaAlias[0].data as RoasterPrior;
      } catch {}
      return null;
    })(),
    // Corpus + the terrain derived from it. Read here rather than trusting the
    // client's array: the client used to POST its last 100 sessions with every
    // request, which capped what the recommender could learn from (184 brews
    // logged, 84 invisible) AND put the whole payload on the wire. Timing
    // calibration and method rotation scan this list, so the window matters
    // most for the brewers used least often — their handful of samples is
    // exactly what falls off the end of a short window.
    (async () => {
      const loaded = await loadRecentSessions(400);
      const sessions = loaded.length > 0 ? loaded : pastSessions || [];
      const terrain =
        sessions.length >= 3
          ? await buildEscherTerrain(sessions, coffee).catch(() => "")
          : "";
      return { sessions, terrain };
    })(),
    loadCoffeeHistory(coffee?.coffeeId, coffee?.roaster, coffee?.name),
    // Coach insights — exclude doesnt-apply AND actively-snoozed at the query
    // layer. Ordered confirmed → trying → new (then newest first) BEFORE the
    // limit, and the status/source travel with each row: until 2026-10-03 this
    // query had no ORDER BY (an arbitrary 20 rows) and the mapping below dropped
    // the status, so a row the user had confirmed on /taste read exactly like a
    // fresh one — the comment here claimed a weighting that did not exist.
    db
      .select()
      .from(insightsTable)
      .where(
        and(
          ne(insightsTable.status, "doesnt-apply"),
          or(
            ne(insightsTable.status, "snoozed"),
            isNull(insightsTable.snoozedUntil),
            lte(insightsTable.snoozedUntil, new Date()),
          ),
        ),
      )
      .orderBy(
        sql`CASE ${insightsTable.status} WHEN 'confirmed' THEN 0 WHEN 'trying' THEN 1 WHEN 'new' THEN 2 ELSE 3 END`,
        desc(insightsTable.latestSessionMs),
        desc(insightsTable.createdAt),
      )
      .limit(30)
      .catch(() => []),
  ]);
  const userRoasterPrior = userRoasterPriorResult;
  const { sessions, terrain } = corpus;

  const allInsights: RecommendInsight[] = Array.isArray(coachInsights)
    ? coachInsights.map((row) => ({
        observation: row.observation,
        suggestion: row.suggestion,
        citationFields: row.citationFields ?? [],
        status: row.status,
        source: row.source,
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : undefined,
      }))
    : [];

  const { recommendation, usage } = await generateRecommendation(
    coffee,
    context,
    prefs,
    sessions,
    userRoasterPrior ?? undefined,
    terrain || undefined,
    coffeeHistory,
    allInsights.length > 0 ? allInsights : undefined,
  );
  // The one number that says how long the user waited: output tokens are the
  // latency (~70 tok/s on Opus), `calls` says whether a repair round fired.
  // recommend-logs.yml greps the `[recommend]` prefix, so this is the
  // production before/after for every output-slimming change.
  console.log(
    `[recommend] usage in=${usage.input_tokens} out=${usage.output_tokens} calls=${usage.calls} candidates=${recommendation.candidates.length}`,
  );
  // The terrain rides on the recommendation so the post-brew insight can
  // reuse it — the Summary used to make the identical Sonnet call again.
  return terrain ? { ...recommendation, terrain } : recommendation;
}
