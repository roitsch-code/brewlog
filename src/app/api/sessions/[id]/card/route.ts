import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sessions, coffees } from "@/lib/db/schema";
import { rowToSession } from "@/lib/db/helpers";
import { buildBrewCardData } from "@/lib/share/brewCard";
import type { FieldZones } from "@/lib/field/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/sessions/[id]/card — the data of the shareable brew card plus the
 * coffee's Field composition (the card's background). Behind the cookie gate
 * like every session read; the PNG itself is painted on the phone.
 */
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const rows = await db.select().from(sessions).where(eq(sessions.id, params.id)).limit(1);
    if (rows.length === 0) return NextResponse.json(null, { status: 404 });
    const session = rowToSession(rows[0]);
    const card = buildBrewCardData(session);
    if (!card) return NextResponse.json({ error: "This session has no recipe to share." }, { status: 422 });

    let fieldZones: FieldZones | null = null;
    const coffeeId = session.coffee?.coffeeId;
    if (coffeeId) {
      const cRows = await db.select({ fieldZones: coffees.fieldZones }).from(coffees).where(eq(coffees.id, coffeeId)).limit(1);
      fieldZones = (cRows[0]?.fieldZones as FieldZones | null | undefined) ?? null;
    }
    return NextResponse.json({ card, fieldZones });
  } catch (err) {
    console.error("session card GET error:", err);
    return NextResponse.json(null, { status: 500 });
  }
}
