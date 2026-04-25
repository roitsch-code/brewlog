import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sessions } from "@/lib/db/schema";
import type { ExternalPlace, TasteResult, CoffeeIdentity } from "@/lib/types/session";
import type { CafeSummary } from "@/lib/types/cafes";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db
    .select({
      createdAtMs: sessions.createdAtMs,
      place: sessions.place,
      coffee: sessions.coffee,
      result: sessions.result,
    })
    .from(sessions)
    .where(eq(sessions.mode, "external"))
    .orderBy(sessions.createdAtMs);

  // Group by normalised café name
  const map = new Map<string, {
    name: string;
    location?: string;
    visits: number;
    totalRating: number;
    ratedCount: number;
    coffees: string[];
    lastVisitedMs: number;
  }>();

  for (const row of rows) {
    const place = row.place as ExternalPlace | null;
    if (!place?.name) continue;

    const key = place.name.toLowerCase().trim();
    const rating = (row.result as TasteResult | null)?.rating;
    const c = row.coffee as CoffeeIdentity | null;
    const coffeeName = [c?.roaster, c?.name].filter(Boolean).join(" ").trim();

    const entry = map.get(key);
    if (entry) {
      entry.visits++;
      if (rating) { entry.totalRating += rating; entry.ratedCount++; }
      if (coffeeName && !entry.coffees.includes(coffeeName)) entry.coffees.push(coffeeName);
      entry.lastVisitedMs = Math.max(entry.lastVisitedMs, row.createdAtMs);
    } else {
      map.set(key, {
        name: place.name,
        location: place.location,
        visits: 1,
        totalRating: rating ?? 0,
        ratedCount: rating ? 1 : 0,
        coffees: coffeeName ? [coffeeName] : [],
        lastVisitedMs: row.createdAtMs,
      });
    }
  }

  const cafes: CafeSummary[] = Array.from(map.values())
    .map(c => ({
      name: c.name,
      location: c.location,
      visits: c.visits,
      avgRating: c.ratedCount > 0 ? Math.round((c.totalRating / c.ratedCount) * 10) / 10 : null,
      coffees: c.coffees.slice(0, 10),
      lastVisitedMs: c.lastVisitedMs,
    }))
    .sort((a, b) => b.lastVisitedMs - a.lastVisitedMs);

  return NextResponse.json(cafes);
}
