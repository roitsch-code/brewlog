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

    // Hide actively-snoozed cards from the consumer. Once the snooze
    // window has passed, the row behaves like 'new' from the GET's
    // point of view — the next regen replaces it OR it surfaces with
    // the original observation.
    const snoozeActive =
      cached?.status === "snoozed" &&
      typeof cached.snoozedUntil === "string" &&
      Date.parse(cached.snoozedUntil) > Date.now();

    if (cached && (cacheIsFresh || userInMidFlight) && !snoozeActive) {
      return NextResponse.json({ insight: cached });
    }

    // Active snooze: don't regenerate, just hide. The card will come
    // back once the snooze passes.
    if (snoozeActive) {
      return NextResponse.json({ insight: null });
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
  status: z.enum(["new", "trying", "confirmed", "doesnt-apply", "snoozed"]),
});

const SNOOZE_DAYS = 7;

/**
 * PATCH — Update the per-coffee insight's workflow status.
 *
 *   new          → fresh card (just generated)
 *   trying       → user tapped Save to try; card stays on /coffees/[id]
 *                  in the highlighted saved state, AND surfaces as a
 *                  quiet reminder in /brew/new Context.
 *   confirmed    → user tapped Confirmed or It helped; preserved across
 *                  regenerations.
 *   doesnt-apply → user tapped Doesn't apply or Didn't help; soft-rejects.
 *   snoozed      → user tapped Skip (saved-stage); hidden for SNOOZE_DAYS,
 *                  then resurfaces as if new.
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
    const next: CoffeeCoachInsight = {
      ...current,
      status: parsed.data.status,
      snoozedUntil:
        parsed.data.status === "snoozed"
          ? new Date(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000).toISOString()
          : undefined,
    };
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
