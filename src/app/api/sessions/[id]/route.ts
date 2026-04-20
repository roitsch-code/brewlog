import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sessions, coffees } from "@/lib/db/schema";
import { rowToSession } from "@/lib/db/helpers";

export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const rows = await db.select().from(sessions).where(eq(sessions.id, params.id)).limit(1);
    if (rows.length === 0) return NextResponse.json(null, { status: 404 });
    return NextResponse.json(rowToSession(rows[0]));
  } catch (err) {
    console.error("session GET error:", err);
    return NextResponse.json(null, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const data = await req.json();
  const patch: Partial<typeof sessions.$inferInsert> = {};
  if (data.coffee !== undefined) patch.coffee = data.coffee;
  if (data.place !== undefined) patch.place = data.place;
  if (data.context !== undefined) patch.context = data.context;
  if (data.recommendation !== undefined) patch.recommendation = data.recommendation;
  if (data.brew !== undefined) patch.brew = data.brew;
  if (data.result !== undefined) patch.result = data.result;
  if (Object.keys(patch).length > 0) {
    await db.update(sessions).set(patch).where(eq(sessions.id, params.id));
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  const rows = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const session = rows[0];

  await db.delete(sessions).where(eq(sessions.id, id));

  const sessionCoffee = session.coffee;
  if (sessionCoffee?.name && sessionCoffee?.roaster) {
    const coffeeKey = `${sessionCoffee.roaster}__${sessionCoffee.name}`
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_");

    const existingRows = await db.select().from(coffees).where(eq(coffees.id, coffeeKey)).limit(1);
    const existing = existingRows[0];
    if (existing) {
      const sessionIds = (existing.sessionIds ?? []).filter(sid => sid !== id);
      if (sessionIds.length === 0) {
        await db.delete(coffees).where(eq(coffees.id, coffeeKey));
      } else {
        const deletedRating = session.result?.rating;
        const hasRating = typeof deletedRating === "number";
        const prevSum = Number(existing.ratingSum ?? 0);
        const prevCount = existing.ratingCount ?? 0;
        const ratingSum = Math.max(0, prevSum - (hasRating ? deletedRating! : 0));
        const ratingCount = Math.max(0, prevCount - (hasRating ? 1 : 0));
        const avgRating = ratingCount > 0 ? ratingSum / ratingCount : null;

        await db
          .update(coffees)
          .set({
            sessionIds,
            sessionCount: sessionIds.length,
            ratingSum: String(ratingSum),
            ratingCount,
            avgRating: avgRating != null ? String(avgRating) : null,
          })
          .where(eq(coffees.id, coffeeKey));
      }
    }
  }

  return NextResponse.json({ success: true });
}
