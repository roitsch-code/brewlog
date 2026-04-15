import { NextRequest, NextResponse } from "next/server";
import { generateRecommendation } from "@/lib/claude/recommend";
import { getAdminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/auth/requireAuth";
import type { UserPreferences } from "@/lib/types/preferences";
import type { RoasterPrior } from "@/lib/roasters/priors";

function toSlug(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, "-");
}

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
        const snap = await db.collection("roasters").doc(toSlug(coffee.roaster)).get();
        if (snap.exists) userRoasterPrior = snap.data() as RoasterPrior;
      } catch {}
    }

    const { recommendation } = await generateRecommendation(coffee, context, prefs, pastSessions || [], userRoasterPrior ?? undefined);
    return NextResponse.json(recommendation);
  } catch (err) {
    console.error("recommend error:", err);
    return NextResponse.json({ error: "Recommendation failed" }, { status: 500 });
  }
}
