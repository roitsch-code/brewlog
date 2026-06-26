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

    // The documented bag flavors live in the scanned identity on this coffee's
    // SCAN session — the `coffees` row's `common_notes` is unpopulated in
    // production, so the session JSONB is the only source. Surface them so the
    // brew-log flavor suggestions + the detail page can show THIS bag's printed
    // notes even when the brew was started from a shortcut (library list /
    // Action Pill / Brew Again) whose synthesized identity carried no notes.
    //
    // IMPORTANT: the scan session is created BEFORE the coffee row exists, so
    // its `coffee` JSONB has NO `coffeeId`. Matching notes on
    // `coffee->>'coffeeId' = id` (what we used to do) therefore matched NOTHING
    // for every bag — the only notes-bearing session is the scan, and it has no
    // coffeeId. Match on the coffee row's own `sessionIds` instead (which always
    // includes the scan session), then take the most recent of those sessions
    // that actually carries notes (brew-again/shortcut sessions carry none).
    const sessionIds = rows[0].sessionIds ?? [];
    let tastingNotesFromBag: string[] = [];
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
