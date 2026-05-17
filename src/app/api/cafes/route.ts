import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sessions, cafeVisits } from "@/lib/db/schema";
import type { ExternalPlace, TasteResult, CoffeeIdentity } from "@/lib/types/session";
import type { CafeSummary } from "@/lib/types/cafes";

export const dynamic = "force-dynamic";

export async function GET() {
  const [sessionRows, visitRows] = await Promise.all([
    db
      .select({
        createdAtMs: sessions.createdAtMs,
        place: sessions.place,
        coffee: sessions.coffee,
        result: sessions.result,
      })
      .from(sessions)
      .where(eq(sessions.mode, "external"))
      .orderBy(sessions.createdAtMs),
    db
      .select({
        cafeName: cafeVisits.cafeName,
        location: cafeVisits.location,
        visitedAtMs: cafeVisits.visitedAtMs,
      })
      .from(cafeVisits),
  ]);
  const rows = sessionRows;

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

  // Fold in cafe_visits rows. A visit may be for a café the user has
  // ALSO brewed at (merge into existing entry) or a brand-new place
  // (new entry with no coffees / rating yet).
  for (const v of visitRows) {
    if (!v.cafeName) continue;
    const key = v.cafeName.toLowerCase().trim();
    const entry = map.get(key);
    if (entry) {
      entry.visits++;
      entry.lastVisitedMs = Math.max(entry.lastVisitedMs, v.visitedAtMs);
    } else {
      map.set(key, {
        name: v.cafeName,
        location: v.location ?? undefined,
        visits: 1,
        totalRating: 0,
        ratedCount: 0,
        coffees: [],
        lastVisitedMs: v.visitedAtMs,
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
