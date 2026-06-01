/**
 * GET /api/lessons
 *
 * Returns every lesson row, shaped for the standalone /lessons page.
 * Dismissed rows are included so the page can show them under a
 * "dismissed" affordance and the user can re-activate them; /recommend
 * filters dismissed separately (loadLessonsForRecommend).
 *
 * Optional query params:
 *   - level: 'coffee' | 'roaster' | 'method-style' | 'process-roast'
 *   - includeDismissed: 'false' to hide dismissed rows (default: include)
 */
import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { lessons } from "@/lib/db/schema";
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
      })),
    );
  } catch (err) {
    console.error("lessons GET error:", err);
    return NextResponse.json({ error: "Failed to load lessons" }, { status: 500 });
  }
}
