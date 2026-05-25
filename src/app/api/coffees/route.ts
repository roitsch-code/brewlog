import { NextRequest, NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { coffees, roasters } from "@/lib/db/schema";
import { rowToCoffee } from "@/lib/db/helpers";
import { getRoasterPrior } from "@/lib/roasters/priors";

export const dynamic = "force-dynamic";

export interface RoasterSummary {
  region?: string;
  styleSummary?: string;
  confidence: string;
}

export async function GET(req: NextRequest) {
  try {
    const rows = await db.select().from(coffees);
    const all = rows.map(rowToCoffee);

    if (req.nextUrl.searchParams.get("roasters") === "true") {
      const names = Array.from(new Set(all.map(c => c.roaster).filter(Boolean))).sort((a, b) => a.localeCompare(b));
      return NextResponse.json(names);
    }

    if (req.nextUrl.searchParams.get("roasterSummaries") === "true") {
      const roasterNames = Array.from(new Set(all.map(c => c.roaster).filter(Boolean)));
      const summaries: Record<string, RoasterSummary> = {};

      // Load every matching roaster row in a single query (was one query per
      // roaster — an N+1 that grew with the library).
      const slugByName = new Map(
        roasterNames.map(name => [name, name.toLowerCase().trim().replace(/\s+/g, "-")])
      );
      const slugs = Array.from(new Set(slugByName.values()));
      const savedRows = slugs.length > 0
        ? await db.select().from(roasters).where(inArray(roasters.slug, slugs))
        : [];
      const savedBySlug = new Map(savedRows.map(r => [r.slug, r]));

      for (const name of roasterNames) {
        const saved = savedBySlug.get(slugByName.get(name)!);
        if (saved) {
          summaries[name] = {
            region: saved.region ?? undefined,
            styleSummary: saved.styleSummary ?? undefined,
            confidence: saved.confidence ?? "user",
          };
          continue;
        }

        const prior = getRoasterPrior(name);
        if (prior.confidence !== "fallback") {
          summaries[name] = { region: prior.region, styleSummary: prior.styleSummary, confidence: prior.confidence };
        }
      }

      return NextResponse.json(summaries);
    }

    if (req.nextUrl.searchParams.get("match") === "true") {
      const name = (req.nextUrl.searchParams.get("name") || "").toLowerCase().trim();
      const roaster = (req.nextUrl.searchParams.get("roaster") || "").toLowerCase().trim();
      if (!name && !roaster) return NextResponse.json(null);
      const match = all.find(c =>
        (name ? c.name?.toLowerCase().trim() === name : true) &&
        (roaster ? c.roaster?.toLowerCase().trim() === roaster : true)
      ) ?? null;
      return NextResponse.json(match);
    }

    return NextResponse.json(all);
  } catch (err) {
    console.error("coffees GET error:", err);
    return NextResponse.json({ error: "Failed to load coffees" }, { status: 500 });
  }
}
