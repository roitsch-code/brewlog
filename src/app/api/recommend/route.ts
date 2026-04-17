import { NextRequest, NextResponse } from "next/server";
import { generateRecommendation } from "@/lib/claude/recommend";
import { buildEscherTerrain } from "@/lib/claude/escher";
import { getAdminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/auth/requireAuth";
import { canonicalRoasterSlug } from "@/lib/roasters/priors";
import type { UserPreferences } from "@/lib/types/preferences";
import type { RoasterPrior } from "@/lib/roasters/priors";

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  try {
    const { coffee, context, pastSessions } = await req.json();

    let preferences: UserPreferences | null = null;
    try {
      const db = getAdminDb();
      const snap = await db.collection("preferences").doc("default").get();
      if (snap.exists) preferences = snap.data() as UserPreferences;
    } catch {}
    const prefs = preferences || {
      equipment: ["V60", "V60 + Drip Assist", "OreaV4", "Kalita", "CleverDripper", "AeroPress", "Moccamaster"],
      grinder: "Niche Zero",
      tasteProfile: { preferredBodyLevel: "medium", preferredAcidityLevel: "medium-high", likedOrigins: ["Ethiopia", "Brazil", "Kenya", "Costa Rica"], likedProcesses: ["Natural", "Washed", "Honey"], avoidProcesses: ["Anaerobic"] },
      defaultAmount: "small",
      onboardingComplete: true,
    };

    // Check Firestore for a user-saved roaster profile — takes priority over built-in list
    let userRoasterPrior: RoasterPrior | null = null;
    if (coffee?.roaster) {
      try {
        const db = getAdminDb();
        const slug = canonicalRoasterSlug(coffee.roaster);
        const direct = await db.collection("roasters").doc(slug).get();
        if (direct.exists) {
          userRoasterPrior = direct.data() as RoasterPrior;
        } else {
          const aliasSnap = await db
            .collection("roasters")
            .where("aliases", "array-contains", slug)
            .limit(1)
            .get();
          if (!aliasSnap.empty) userRoasterPrior = aliasSnap.docs[0].data() as RoasterPrior;
        }
      } catch {}
    }

    // Build Escher terrain in parallel with nothing (it's the first async call)
    // Only run when there are enough sessions to have something meaningful
    const sessions = pastSessions || [];
    const terrain = sessions.length >= 3
      ? await buildEscherTerrain(sessions, coffee).catch(() => "")
      : "";

    const { recommendation } = await generateRecommendation(
      coffee, context, prefs, sessions, userRoasterPrior ?? undefined, terrain || undefined
    );
    return NextResponse.json(recommendation);
  } catch (err) {
    console.error("recommend error:", err);
    return NextResponse.json({ error: "Recommendation failed" }, { status: 500 });
  }
}
