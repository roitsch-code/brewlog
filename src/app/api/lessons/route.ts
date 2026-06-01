/**
 * GET /api/lessons
 *
 * Returns every lesson row, shaped for the standalone /lessons page.
 * Dismissed rows are included so the page can show them under a
 * "dismissed" affordance and the user can re-activate them; /recommend
 * filters dismissed separately (loadLessonsForRecommend).
 *
 * For level='coffee' rows we also join the coffees table so the page
 * can (a) hide out-of-rotation coffees under an "Archived" drawer by
 * default and (b) show a friendly "Roaster — Coffee Name" label
 * instead of the raw scope id (e.g. "ineffable_coffee_roasters__la_coipa").
 *
 * Optional query params:
 *   - level: 'coffee' | 'roaster' | 'method-style' | 'process-roast'
 *   - includeDismissed: 'false' to hide dismissed rows (default: include)
 */
import { NextRequest, NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { coffees, lessons } from "@/lib/db/schema";
import type { LessonLevel } from "@/lib/db/schema";

const VALID_LEVELS: LessonLevel[] = [
  "coffee",
  "roaster",
  "method-style",
  "process-roast",
];

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const levelParam = url.searchParams.get("level");
    const includeDismissed = url.searchParams.get("includeDismissed") !== "false";

    let rows;
    if (levelParam && (VALID_LEVELS as string[]).includes(levelParam)) {
      rows = await db
        .select()
        .from(lessons)
        .where(eq(lessons.level, levelParam as LessonLevel))
        .orderBy(desc(lessons.updatedAt));
    } else {
      rows = await db.select().from(lessons).orderBy(desc(lessons.updatedAt));
    }

    const filtered = includeDismissed
      ? rows
      : rows.filter((r) => r.status !== "dismissed");

    // For coffee-level rows, attach rotation status + friendly display
    // name by joining the coffees table. Single point-lookup query;
    // no N+1.
    const coffeeIds = Array.from(
      new Set(
        filtered.filter((r) => r.level === "coffee").map((r) => r.scope),
      ),
    );
    const coffeeMeta = new Map<
      string,
      { inRotation: boolean; roaster: string; name: string }
    >();
    if (coffeeIds.length > 0) {
      const coffeeRows = await db
        .select({
          id: coffees.id,
          inRotation: coffees.inRotation,
          roaster: coffees.roaster,
          name: coffees.name,
        })
        .from(coffees)
        .where(inArray(coffees.id, coffeeIds));
      for (const c of coffeeRows) {
        coffeeMeta.set(c.id, {
          inRotation: c.inRotation,
          roaster: c.roaster,
          name: c.name,
        });
      }
    }

    return NextResponse.json(
      filtered.map((r) => ({
        id: r.id,
        level: r.level,
        scope: r.scope,
        content: r.content,
        confidenceN: r.confidenceN,
        evidenceSessionIds: r.evidenceSessionIds,
        source: r.source,
        status: r.status,
        userNote: r.userNote,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        coffeeMeta:
          r.level === "coffee" ? coffeeMeta.get(r.scope) ?? null : null,
      })),
    );
  } catch (err) {
    console.error("lessons GET error:", err);
    return NextResponse.json({ error: "Failed to load lessons" }, { status: 500 });
  }
}
