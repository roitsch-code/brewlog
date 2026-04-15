import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { getRoasterPrior } from "@/lib/roasters/priors";
import type { Coffee } from "@/lib/types/coffee";

export const dynamic = "force-dynamic";

export interface RoasterSummary {
  region?: string;
  styleSummary?: string;
  confidence: string;
}

export async function GET(req: NextRequest) {
  try {
    const db = getAdminDb();
    const snap = await db.collection("coffees").get();

    // ?roasters=true — unique sorted roaster names
    if (req.nextUrl.searchParams.get("roasters") === "true") {
      const allNames = snap.docs.map(d => (d.data() as Coffee).roaster).filter(Boolean);
      const names = Array.from(new Set(allNames)).sort((a, b) => a.localeCompare(b));
      return NextResponse.json(names);
    }

    // ?roasterSummaries=true — { [roasterName]: { region, styleSummary, confidence } }
    if (req.nextUrl.searchParams.get("roasterSummaries") === "true") {
      const allNames = snap.docs.map(d => (d.data() as Coffee).roaster).filter(Boolean);
      const roasterNames = Array.from(new Set(allNames));
      const summaries: Record<string, RoasterSummary> = {};

      for (const name of roasterNames) {
        // Check Firestore roasters collection first (user-saved profiles)
        const slug = name.toLowerCase().trim().replace(/\s+/g, "-");
        try {
          const roasterDoc = await db.collection("roasters").doc(slug).get();
          if (roasterDoc.exists) {
            const d = roasterDoc.data()!;
            summaries[name] = { region: d.region, styleSummary: d.styleSummary, confidence: d.confidence || "user" };
            continue;
          }
        } catch {}

        // Fall back to static prior (fuzzy match handles "Friedhats Coffee Roasters" → "Friedhats")
        const prior = getRoasterPrior(name);
        if (prior.confidence !== "fallback") {
          summaries[name] = { region: prior.region, styleSummary: prior.styleSummary, confidence: prior.confidence };
        }
      }

      return NextResponse.json(summaries);
    }

    // ?match=true&name=X&roaster=Y — case-insensitive lookup for coffee recognition
    if (req.nextUrl.searchParams.get("match") === "true") {
      const name = (req.nextUrl.searchParams.get("name") || "").toLowerCase().trim();
      const roaster = (req.nextUrl.searchParams.get("roaster") || "").toLowerCase().trim();
      const match = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Coffee))
        .find(c =>
          (name ? c.name?.toLowerCase().trim() === name : true) &&
          (roaster ? c.roaster?.toLowerCase().trim() === roaster : true) &&
          (name || roaster) // need at least one filter
        ) ?? null;
      return NextResponse.json(match);
    }

    const coffees: Coffee[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Coffee));
    return NextResponse.json(coffees);
  } catch (err) {
    console.error("coffees GET error:", err);
    return NextResponse.json({ error: "Failed to load coffees" }, { status: 500 });
  }
}
