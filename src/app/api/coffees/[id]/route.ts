import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, sql, desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { coffees, sessions } from "@/lib/db/schema";
import { rowToCoffee } from "@/lib/db/helpers";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const rows = await db.select().from(coffees).where(eq(coffees.id, params.id)).limit(1);
    if (rows.length === 0) return NextResponse.json(null, { status: 404 });

    // The documented bag flavors live in the scanned identity on the coffee's
    // latest session — the `coffees` row's `common_notes` is unpopulated in
    // production. Surface them so the brew-log flavor suggestions can show THIS
    // bag's printed notes even when the brew was started from a shortcut
    // (library list / Action Pill / Brew Again) whose synthesized identity
    // carried no notes. Cheap (single-user table); newest session wins.
    // Find the most recent session for this coffee that actually has bag tasting notes.
    // Brew-again / shortcut sessions never carry tastingNotesFromBag in their JSONB,
    // so querying the LATEST session always returns [] for frequently-brewed rotation bags.
    // The scan session that holds the notes may be older — filter to only sessions where
    // the array is non-empty so we always surface the real bag notes.
    const noteRows = await db
      .select({ coffee: sessions.coffee })
      .from(sessions)
      .where(sql`${sessions.coffee}->>'coffeeId' = ${params.id}
        AND jsonb_array_length(COALESCE((${sessions.coffee}->'tastingNotesFromBag')::jsonb, '[]'::jsonb)) > 0`)
      .orderBy(desc(sessions.createdAtMs))
      .limit(1);
    const tastingNotesFromBag = noteRows[0]?.coffee?.tastingNotesFromBag ?? [];

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
