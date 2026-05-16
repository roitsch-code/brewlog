import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { analyzeBagImage } from "@/lib/claude/analyzeBag";
import { getRoasterPrior, canonicalRoasterSlug } from "@/lib/roasters/priors";
import { db } from "@/lib/db/client";
import { roasters } from "@/lib/db/schema";
import type { RoasterPrior } from "@/lib/roasters/priors";
import { mapNotesToZones } from "@/lib/field/mapNotesToZones";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mimeType = file.type || "image/jpeg";

    const { result } = await analyzeBagImage(base64, mimeType);

    // Field-zone mapping runs in parallel with the roaster-prior lookup —
    // both are sequential add-ons to the bag extraction, neither blocks
    // the other. mapNotesToZones swallows errors and returns null, so a
    // Haiku outage doesn't fail the scan; clients fall back to Default.
    const notes = result.extracted.tastingNotesFromBag ?? [];
    const fieldZonesPromise = notes.length > 0 ? mapNotesToZones(notes) : Promise.resolve(null);

    // Roaster prior lookup: user-saved Firestore record takes priority over built-in list.
    // Fallback priors carry no real signal and are omitted to avoid noise.
    const roasterName = result.extracted.roaster;
    let roasterPrior = undefined;
    if (roasterName) {
      let prior: RoasterPrior | null = null;
      try {
        const slug = canonicalRoasterSlug(roasterName);
        const direct = await db.select().from(roasters).where(eq(roasters.slug, slug)).limit(1);
        if (direct.length > 0) {
          prior = direct[0].data as RoasterPrior;
        } else {
          const viaAlias = await db
            .select()
            .from(roasters)
            .where(sql`${roasters.aliases} @> ${JSON.stringify([slug])}::jsonb`)
            .limit(1);
          if (viaAlias.length > 0) prior = viaAlias[0].data as RoasterPrior;
        }
      } catch {}

      // 2. Fall back to built-in list
      if (!prior) {
        const builtIn = getRoasterPrior(roasterName);
        if (builtIn.confidence !== "fallback") prior = builtIn;
      }

      if (prior) {
        roasterPrior = {
          name: prior.name,
          region: prior.region,
          styleSummary: prior.styleSummary,
          roastTendency: prior.roastTendency,
          clarityVsSweetnessBias: prior.clarityVsSweetnessBias,
          tempBias: prior.tempBias,
          ratioBias: prior.ratioBias,
          methodAffinities: prior.methodAffinities,
          extractionRisks: prior.extractionRisks,
          notes: prior.notes,
          confidence: prior.confidence,
        };
      }
    }

    const fieldZones = await fieldZonesPromise;
    return NextResponse.json({ ...result, roasterPrior, fieldZones });
  } catch (err) {
    console.error("analyze-bag error:", err);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
