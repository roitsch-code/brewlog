import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { cafeVisits } from "@/lib/db/schema";
import type { CafeVisit } from "@/lib/types/cafes";

export const dynamic = "force-dynamic";

const VisitSchema = z.object({
  cafeName: z.string().min(1).max(200),
  location: z.string().max(300).optional(),
  rating: z.enum(["come-back", "wont-return"]),
  notes: z.string().max(2000).optional(),
});

function rowToVisit(r: typeof cafeVisits.$inferSelect): CafeVisit {
  return {
    id: r.id,
    cafeName: r.cafeName,
    location: r.location ?? undefined,
    rating: r.rating,
    notes: r.notes ?? undefined,
    visitedAt: r.visitedAt.toISOString(),
    visitedAtMs: r.visitedAtMs,
  };
}

export async function GET(req: NextRequest) {
  const cafeName = req.nextUrl.searchParams.get("cafeName");
  try {
    const rows = cafeName
      ? await db.select().from(cafeVisits).where(eq(cafeVisits.cafeName, cafeName)).orderBy(desc(cafeVisits.visitedAtMs))
      : await db.select().from(cafeVisits).orderBy(desc(cafeVisits.visitedAtMs)).limit(200);
    return NextResponse.json(rows.map(rowToVisit));
  } catch (err) {
    console.error("cafe-visits GET error:", err);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = VisitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.issues }, { status: 400 });
    }
    const now = new Date();
    const id = randomUUID();
    await db.insert(cafeVisits).values({
      id,
      cafeName: parsed.data.cafeName,
      location: parsed.data.location,
      rating: parsed.data.rating,
      notes: parsed.data.notes,
      visitedAt: now,
      visitedAtMs: now.getTime(),
    });
    return NextResponse.json({
      id,
      cafeName: parsed.data.cafeName,
      location: parsed.data.location,
      rating: parsed.data.rating,
      notes: parsed.data.notes,
      visitedAt: now.toISOString(),
      visitedAtMs: now.getTime(),
    } satisfies CafeVisit, { status: 201 });
  } catch (err) {
    console.error("cafe-visits POST error:", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
