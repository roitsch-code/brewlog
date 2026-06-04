import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { insights } from "@/lib/db/schema";
import type { InsightStatus } from "@/lib/db/schema";
import { getOrGenerateInsights } from "@/lib/claude/insights";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const STATUS_VALUES: readonly InsightStatus[] = ["new", "trying", "confirmed", "doesnt-apply", "snoozed"] as const;

// Snooze window — when the user taps "Skip" on a saved card, the row is
// hidden from all surfaces until this many days have passed, then
// resurfaces in the queue. Matches the conversations TTL cadence.
const SNOOZE_DAYS = 7;

// Hides actively-snoozed rows. A row counts as "expired snooze" once
// snoozed_until has passed — those resurface and behave like 'new'
// from the consumer's point of view.
const snoozeVisibilityFilter = or(
  sql`${insights.status} != 'snoozed'`,
  isNull(insights.snoozedUntil),
  lte(insights.snoozedUntil, new Date()),
);

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
      // If the caller explicitly asked for 'snoozed', surface every snoozed
      // row (debug / admin); otherwise hide active snoozes.
      const callerWantsSnoozed = requested.includes("snoozed");
      const whereClause = callerWantsSnoozed
        ? inArray(insights.status, requested)
        : and(inArray(insights.status, requested), snoozeVisibilityFilter);
      const rows = await db
        .select()
        .from(insights)
        .where(whereClause);
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
    // generation, returns everything for client-side filtering. Active
    // snoozes are hidden so the queue doesn't show them; once a snooze
    // expires the row is treated like 'new' (regeneration replaces it
    // OR it appears in the queue with its preserved observation).
    const result = await getOrGenerateInsights();
    const nowMs = Date.now();
    const visible = result.insights.filter((row) => {
      if (row.status !== "snoozed") return true;
      if (!row.snoozedUntil) return true;
      return row.snoozedUntil.getTime() <= nowMs;
    });
    return NextResponse.json({
      insights: visible.map((row) => ({
        id: row.id,
        observation: row.observation,
        suggestion: row.suggestion,
        citationFields: row.citationFields ?? [],
        // Expired snoozes resurface as 'new' — they earned the second
        // look. The DB row keeps status='snoozed' until regen rewrites
        // it or the user acts; the consumer doesn't need to know.
        status:
          row.status === "snoozed" && row.snoozedUntil && row.snoozedUntil.getTime() <= nowMs
            ? "new"
            : row.status,
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
  status: z.enum(["new", "trying", "confirmed", "doesnt-apply", "snoozed"]),
});

/**
 * PATCH — Update an insight's workflow status.
 *
 * Two-stage workflow (PR ⟨coach-redesign⟩):
 *   New stage (status='new'):
 *     - 'trying'       (Save to try)    → stays visible on /taste in
 *                                         the saved/highlighted state.
 *     - 'confirmed'    (Confirmed)      → user saw the pattern hold;
 *                                         bumps source for /recommend.
 *     - 'doesnt-apply' (Doesn't apply)  → soft-rejects, preserved across
 *                                         regens.
 *   Saved stage (status='trying'):
 *     - 'confirmed'    (It helped)      → same as above.
 *     - 'doesnt-apply' (Didn't help)    → same as above.
 *     - 'snoozed'      (Skip — remind   → hidden for SNOOZE_DAYS, then
 *                       me later)         resurfaces in the /taste queue.
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
    const snoozedUntil =
      status === "snoozed"
        ? new Date(now.getTime() + SNOOZE_DAYS * 24 * 60 * 60 * 1000)
        : null;
    await db
      .update(insights)
      .set({
        status,
        snoozedUntil,
        // Mirror dismissedAt for legacy code paths that still read it
        // (e.g. the GET cache check). 'doesnt-apply' is the spiritual
        // successor of dismissed.
        dismissedAt: status === "doesnt-apply" ? now : null,
        // Confirmation also bumps source so /recommend can weight it.
        // Any other transition resets to 'opus'.
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
