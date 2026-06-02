import { NextRequest, NextResponse } from "next/server";
import { and, eq, ne, sql } from "drizzle-orm";
import { generateRecommendation, type RecommendInsight } from "@/lib/claude/recommend";
import { buildEscherTerrain } from "@/lib/claude/escher";
import { db } from "@/lib/db/client";
import { coffees, preferences as preferencesTable, roasters, insights as insightsTable } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/requireAuth";
import { canonicalRoasterSlug } from "@/lib/roasters/priors";
import type { UserPreferences } from "@/lib/types/preferences";
import type { RoasterPrior } from "@/lib/roasters/priors";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Aggregated tasting history for this coffee — what the user actually
 * tastes across logged sessions, plus the AI brew memory. Both are
 * written by the weekly /api/coffees/compact cron and may be undefined
 * for first brews or coffees with <2 sessions.
 */
interface CoffeeHistory {
  commonNotes?: string[];
  writtenSummary?: string;
}

function mapCoffeeHistory(row: {
  commonNotes: unknown;
  writtenSummary: string | null;
}): CoffeeHistory | undefined {
  const notes = Array.isArray(row.commonNotes) ? (row.commonNotes as string[]) : undefined;
  const summary = row.writtenSummary ?? undefined;
  if ((!notes || notes.length === 0) && !summary) return undefined;
  return {
    commonNotes: notes && notes.length > 0 ? notes : undefined,
    writtenSummary: summary,
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

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  try {
    const { coffee, context, pastSessions } = await req.json();

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

    const sessions = pastSessions || [];

    // Run DB roaster lookup, Escher terrain, coffee-history lookup, and
    // multivariate coach insights in parallel — saves 3–5s vs sequential.
    const [
      userRoasterPriorResult,
      terrain,
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
      sessions.length >= 3
        ? buildEscherTerrain(sessions, coffee).catch(() => "")
        : Promise.resolve(""),
      loadCoffeeHistory(coffee?.coffeeId, coffee?.roaster, coffee?.name),
      // Coach insights — exclude only doesnt-apply at the query layer.
      // new / trying / confirmed all feed the prompt, with confirmed
      // ranked higher in the recommend prompt block builder.
      db
        .select()
        .from(insightsTable)
        .where(ne(insightsTable.status, "doesnt-apply"))
        .limit(20)
        .catch(() => []),
    ]);
    const userRoasterPrior = userRoasterPriorResult;

    const allInsights: RecommendInsight[] = Array.isArray(coachInsights)
      ? coachInsights.map((row) => ({
          observation: row.observation,
          suggestion: row.suggestion,
          citationFields: row.citationFields ?? [],
        }))
      : [];

    const { recommendation } = await generateRecommendation(
      coffee,
      context,
      prefs,
      sessions,
      userRoasterPrior ?? undefined,
      terrain || undefined,
      coffeeHistory,
      allInsights.length > 0 ? allInsights : undefined,
    );
    return NextResponse.json(recommendation);
  } catch (err) {
    console.error("recommend error:", err);
    return NextResponse.json({ error: "Recommendation failed" }, { status: 500 });
  }
}
