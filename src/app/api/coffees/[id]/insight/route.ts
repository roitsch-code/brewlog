import { NextRequest, NextResponse } from "next/server";
import { eq, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { coffees, sessions } from "@/lib/db/schema";
import type { CoffeeCoachInsight } from "@/lib/db/schema";
import { rowToCoffee, rowToSession } from "@/lib/db/helpers";
import { generateCoffeeInsight } from "@/lib/claude/coffeeInsight";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface RouteParams {
  params: { id: string };
}

/**
 * GET — Per-coffee coach insight.
 *
 * Returns the cached insight if it's still fresh against this coffee's
 * latest session. Regenerates via Opus when:
 *   - the cache is missing, OR
 *   - the cache is older than the latest session of THIS coffee,
 *     AND the cache status is 'new' or 'doesnt-apply' (statuses
 *     'trying' / 'confirmed' mean the user is mid-act-on-it; don't
 *     change the card under them)
 *
 * 404 if the coffee doesn't exist.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const coffeeRow = await db
      .select()
      .from(coffees)
      .where(eq(coffees.id, params.id))
      .limit(1);
    if (coffeeRow.length === 0) {
      return NextResponse.json({ error: "Coffee not found" }, { status: 404 });
    }

    const coffee = rowToCoffee(coffeeRow[0]);
    // jsonb column — Drizzle returns it untyped; we know the shape we wrote.
    const cached = (coffeeRow[0].coachInsight ?? null) as CoffeeCoachInsight | null;

    // Latest session for THIS coffee = cache key.
    const latestSessionRow = await db
      .select({ ms: sessions.createdAtMs })
      .from(sessions)
      .where(sql`${sessions.coffee}->>'coffeeId' = ${params.id}`)
      .orderBy(desc(sessions.createdAtMs))
      .limit(1);
    const latestSessionMs = latestSessionRow[0]?.ms ?? 0;

    const userInMidFlight =
      cached?.status === "trying" || cached?.status === "confirmed";
    const cacheIsFresh =
      cached != null && cached.generatedAtSessionMs >= latestSessionMs;

    if (cached && (cacheIsFresh || userInMidFlight)) {
      return NextResponse.json({ insight: cached });
    }

    // Regenerate.
    const sessionRows = await db
      .select()
      .from(sessions)
      .where(sql`${sessions.coffee}->>'coffeeId' = ${params.id}`)
      .orderBy(desc(sessions.createdAtMs))
      .limit(30);
    const sessionList = sessionRows.map(rowToSession);

    const generated = await generateCoffeeInsight(coffee, sessionList);
    if (!generated) {
      // Opus call failed — return whatever we have (might be null).
      return NextResponse.json({ insight: cached });
    }

    const next: CoffeeCoachInsight = {
      observation: generated.observation,
      suggestion: generated.suggestion,
      status: "new",
      generatedAtSessionMs: latestSessionMs,
      generatedAt: new Date().toISOString(),
    };

    await db
      .update(coffees)
      .set({ coachInsight: next })
      .where(eq(coffees.id, params.id));

    return NextResponse.json({ insight: next });
  } catch (err) {
    console.error("coffee insight GET error:", err);
    return NextResponse.json({ error: "Failed to load insight" }, { status: 500 });
  }
}

const PatchSchema = z.object({
  status: z.enum(["new", "trying", "confirmed", "doesnt-apply"]),
});

/**
 * PATCH — Update the per-coffee insight's workflow status.
 *
 *   trying        → quiet reminder pill in /brew/new Context when the
 *                   user opens this coffee in the brew flow.
 *   confirmed     → preserved across regenerations until user dismisses.
 *   doesnt-apply  → soft-dismiss; next regeneration replaces it.
 *
 * If there's no cached insight to update, returns 404.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const body = await req.json();
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const row = await db
      .select()
      .from(coffees)
      .where(eq(coffees.id, params.id))
      .limit(1);
    if (row.length === 0) {
      return NextResponse.json({ error: "Coffee not found" }, { status: 404 });
    }
    const current = (row[0].coachInsight ?? null) as CoffeeCoachInsight | null;
    if (!current) {
      return NextResponse.json({ error: "No insight to update" }, { status: 404 });
    }
    const next: CoffeeCoachInsight = { ...current, status: parsed.data.status };
    await db
      .update(coffees)
      .set({ coachInsight: next })
      .where(eq(coffees.id, params.id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("coffee insight PATCH error:", err);
    return NextResponse.json({ error: "Failed to update insight" }, { status: 500 });
  }
}
