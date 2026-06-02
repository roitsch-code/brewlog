import { NextRequest, NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { insights } from "@/lib/db/schema";
import type { InsightStatus } from "@/lib/db/schema";
import { getOrGenerateInsights } from "@/lib/claude/insights";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const STATUS_VALUES: readonly InsightStatus[] = ["new", "trying", "confirmed", "doesnt-apply"] as const;

/**
 * GET — Returns coach insights.
 *
 * Default (no query): runs the Opus regeneration check (cache-aware) and
 * returns all rows. The /taste page filters client-side by status.
 *
 * ?status=trying (etc.): returns only rows matching that status. Used by
 * /coffees/[id] and /brew/new Context step to pull active reminders for
 * a specific coffee context — they filter further by attribute overlap
 * client-side.
 *
 * ?status=trying,new: comma-separated list also accepted for surfaces
 * that want both 'new' and 'trying' candidates (the coffee detail
 * coach card prefers 'trying' but falls back to 'new').
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status");

    // Status-filtered read: skip the Opus regeneration check entirely —
    // this is a lightweight lookup, not a full /taste page mount.
    if (statusParam) {
      const requested = statusParam
        .split(",")
        .map((s) => s.trim())
        .filter((s): s is InsightStatus => (STATUS_VALUES as readonly string[]).includes(s));
      if (requested.length === 0) {
        return NextResponse.json({ insights: [] });
      }
      const rows = await db
        .select()
        .from(insights)
        .where(inArray(insights.status, requested));
      return NextResponse.json({
        insights: rows.map((row) => ({
          id: row.id,
          observation: row.observation,
          suggestion: row.suggestion,
          citationFields: row.citationFields ?? [],
          status: row.status,
          source: row.source,
        })),
      });
    }

    // Default path — /taste page mount. Runs the full cache-aware
    // generation, returns everything for client-side filtering.
    const result = await getOrGenerateInsights();
    return NextResponse.json({
      insights: result.insights.map((row) => ({
        id: row.id,
        observation: row.observation,
        suggestion: row.suggestion,
        citationFields: row.citationFields ?? [],
        status: row.status,
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
  status: z.enum(["new", "trying", "confirmed", "doesnt-apply"]),
});

/**
 * PATCH — Update an insight's workflow status.
 *
 *   new           → fresh, in the /taste queue
 *   trying        → user is testing it; surfaces in /brew/new Context
 *   confirmed     → user saw the pattern hold; weights /recommend higher
 *   doesnt-apply  → user rejects it; soft-preserved across regens
 *
 * Status survives Opus regeneration (see replaceInsights in
 * lib/claude/insights.ts) — only 'new' rows get replaced.
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const now = new Date();
    const { id, status } = parsed.data;
    await db
      .update(insights)
      .set({
        status,
        // Mirror dismissedAt for legacy code paths that still read it
        // (e.g. the GET cache check). 'doesnt-apply' is the spiritual
        // successor of dismissed.
        dismissedAt: status === "doesnt-apply" ? now : null,
        // Confirmation also bumps source so /recommend can weight it.
        source: status === "confirmed" ? "user-confirmed" : "opus",
        updatedAt: now,
      })
      .where(eq(insights.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("insights PATCH error:", err);
    return NextResponse.json({ error: "Failed to update insight" }, { status: 500 });
  }
}
