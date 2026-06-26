import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and, inArray, sql, desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { coffees, sessions } from "@/lib/db/schema";
import { rowToCoffee } from "@/lib/db/helpers";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const rows = await db.select().from(coffees).where(eq(coffees.id, params.id)).limit(1);
    if (rows.length === 0) return NextResponse.json(null, { status: 404 });

    // Bag flavors (what's printed on the bag) now live on a first-class column
    // (`bag_flavors`, migration 0019), written on scan-save + backfilled. Prefer
    // it. Fall back to the scan session's JSONB for any coffee not yet
    // backfilled/written — IMPORTANT: that scan session is created BEFORE the
    // coffee row exists, so it has NO `coffeeId`; matching notes on
    // `coffee->>'coffeeId' = id` matched nothing, so we match on the coffee
    // row's own `sessionIds` (which always includes the scan) and take the most
    // recent of those sessions that carries notes (brew-again sessions carry none).
    const stored = Array.isArray(rows[0].bagFlavors)
      ? rows[0].bagFlavors.map((f) => String(f).trim()).filter(Boolean)
      : [];
    let tastingNotesFromBag: string[] = stored;
    if (tastingNotesFromBag.length === 0) {
      const sessionIds = rows[0].sessionIds ?? [];
      if (sessionIds.length > 0) {
        const noteRows = await db
          .select({ coffee: sessions.coffee })
          .from(sessions)
          .where(
            and(
              inArray(sessions.id, sessionIds),
              sql`jsonb_array_length(COALESCE((${sessions.coffee}->'tastingNotesFromBag')::jsonb, '[]'::jsonb)) > 0`,
            ),
          )
          .orderBy(desc(sessions.createdAtMs))
          .limit(1);
        tastingNotesFromBag = noteRows[0]?.coffee?.tastingNotesFromBag ?? [];
      }
    }

    return NextResponse.json({ ...rowToCoffee(rows[0]), tastingNotesFromBag });
  } catch (err) {
    console.error("coffee GET error:", err);
    return NextResponse.json(null, { status: 500 });
  }
}

// Either field is optional; PATCH must include at least one.
const PatchSchema = z.object({
  personalNotes: z.string().max(5000).optional(),
  inRotation: z.boolean().optional(),
}).refine(
  (v) => v.personalNotes !== undefined || v.inRotation !== undefined,
  { message: "must provide personalNotes or inRotation" },
);

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const rows = await db.select({ id: coffees.id }).from(coffees).where(eq(coffees.id, params.id)).limit(1);
    if (rows.length === 0) return NextResponse.json(null, { status: 404 });
    const updates: Record<string, unknown> = {};
    if (parsed.data.personalNotes !== undefined) updates.personalNotes = parsed.data.personalNotes;
    if (parsed.data.inRotation !== undefined) updates.inRotation = parsed.data.inRotation;
    await db.update(coffees).set(updates).where(eq(coffees.id, params.id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("coffee PATCH error:", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
