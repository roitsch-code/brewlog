import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { generateRecommendation } from "@/lib/claude/recommend";
import { buildEscherTerrain } from "@/lib/claude/escher";
import { db } from "@/lib/db/client";
import { preferences as preferencesTable, roasters } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/requireAuth";
import { canonicalRoasterSlug } from "@/lib/roasters/priors";
import type { UserPreferences } from "@/lib/types/preferences";
import type { RoasterPrior } from "@/lib/roasters/priors";

export const dynamic = "force-dynamic";

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
      equipment: ["V60", "V60 + Drip Assist", "OreaV4", "Kalita", "Chemex", "Origami (cone)", "Origami (wave)", "CleverDripper", "AeroPress", "Moccamaster"],
      grinder: "Niche Zero",
      tasteProfile: { preferredBodyLevel: "medium", preferredAcidityLevel: "medium-high", likedOrigins: ["Ethiopia", "Brazil", "Kenya", "Costa Rica"], likedProcesses: ["Natural", "Washed", "Honey"], avoidProcesses: ["Anaerobic"] },
      defaultAmount: "small",
      onboardingComplete: true,
    };

    const sessions = pastSessions || [];

    // Run DB roaster lookup and Escher terrain in parallel — saves 3–5s vs sequential
    const [userRoasterPriorResult, terrain] = await Promise.all([
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
    ]);
    const userRoasterPrior = userRoasterPriorResult;

    const { recommendation } = await generateRecommendation(
      coffee, context, prefs, sessions, userRoasterPrior ?? undefined, terrain || undefined
    );
    return NextResponse.json(recommendation);
  } catch (err) {
    console.error("recommend error:", err);
    return NextResponse.json({ error: "Recommendation failed" }, { status: 500 });
  }
}
