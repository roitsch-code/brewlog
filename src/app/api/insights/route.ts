import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { insights } from "@/lib/db/schema";
import { getOrGenerateInsights } from "@/lib/claude/insights";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET — Returns the active coach insights for the Taste Profile page.
 * Idempotent. Calls Opus only when the corpus has advanced past the
 * cached set's latestSessionMs (or the cache is empty). The Taste
 * Profile page mounts → calls this → renders. No client cache needed:
 * the cache is at the data layer.
 */
export async function GET() {
  try {
    const result = await getOrGenerateInsights();
    return NextResponse.json({
      insights: result.insights.map((row) => ({
        id: row.id,
        observation: row.observation,
        suggestion: row.suggestion,
        citationFields: row.citationFields ?? [],
        dismissed: !!row.dismissedAt,
        source: row.source,
      })),
      generated: result.generated,
      corpusSize: result.corpusSize,
    });
  } catch (err) {
    console.error("insights GET error:", err);
    return NextResponse.json(
      { insights: [], generated: false, corpusSize: 0 },
      { status: 500 },
    );
  }
}

const PatchSchema = z.object({
  id: z.string().min(1),
  dismissed: z.boolean(),
});

/**
 * PATCH — Toggle dismissed on a single insight row. Dismissed insights
 * stay out of /recommend and the Taste Profile page until re-enabled.
 * Survives regeneration (similar-text matching in replaceInsights).
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const now = new Date();
    await db
      .update(insights)
      .set({
        dismissedAt: parsed.data.dismissed ? now : null,
        updatedAt: now,
      })
      .where(eq(insights.id, parsed.data.id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("insights PATCH error:", err);
    return NextResponse.json({ error: "Failed to update insight" }, { status: 500 });
  }
}
