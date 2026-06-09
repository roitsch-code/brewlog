import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { and, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { insights, sessions, coffees } from "@/lib/db/schema";
import type { InsightStatus, CoffeeCoachInsight } from "@/lib/db/schema";
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
 * ?status=trying (etc.): returns only rows matching that status, skipping
 * the regeneration. ?status=trying,new (comma-separated) also accepted.
 * NOTE: currently no UI consumer — /coffees/[id] and the /brew/new Context
 * step read the per-coffee /api/coffees/[id]/insight instead (migration
 * 0015 replaced the old attribute-overlap matching). Kept as a lightweight
 * filtered read for future surfaces.
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

// Field names the recommender ranks insights by (recommend.ts insightsBlock).
// Plus 'freshness' which the coach uses in observation text. Anything else
// the chat sends is dropped — keeps the citationFields vocabulary tight.
const CITATION_FIELDS = ["variety", "process", "roast", "origin", "method", "freshness"] as const;

const RememberSchema = z.object({
  observation: z.string().min(10).max(400),
  suggestion: z.string().min(10).max(400),
  citationFields: z.array(z.string()).max(8).optional(),
  // Provenance only — the observation text carries the per-coffee targeting.
  coffeeId: z.string().optional(),
  coffeeName: z.string().optional(),
  // The endorsement strength. "trying" (default) = Save to try; "confirmed" =
  // the user is sure (the post-brew card's Confirmed action). Both the
  // insights row and the per-coffee card adopt it.
  status: z.enum(["trying", "confirmed"]).optional(),
});

/**
 * POST — Save a chat-authored coach note (tap-to-save from the home chat's
 * "Remember this for …" button). It lands in two places:
 *
 *   1. The insights table — one row that /recommend reads on the next
 *      recipe for a matching coffee, and that the /brew Context step shows
 *      as a reminder.
 *   2. The targeted coffee's `coach_insight` column — so the saved note
 *      becomes that bag's card on /coffees/[id] (the detail page reads
 *      coach_insight, NOT the insights table). The chat knows the exact
 *      coffeeId, so this is a precise per-coffee write — the user's
 *      hand-saved advice supersedes the auto-generated per-coffee insight.
 *
 * The user tapping the button is an explicit endorsement, so both are
 * written with status='trying' by default (an active reminder) — or
 * 'confirmed' when the caller passes status='confirmed' (the post-brew
 * insight card's Confirmed action). The insights row uses
 * source='user-confirmed' (an allowed CHECK value, so no migration is
 * needed). Both 'trying' and 'confirmed' are preserved by the insights
 * orchestrator across /taste regenerations AND keep the coffee card from
 * regenerating under the user, so a hand-saved note is never silently wiped.
 *
 * Callers: the home chat's "Remember this for …" pill, and the post-brew
 * Summary insight card (Save to try / Confirmed).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RememberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const { observation, suggestion } = parsed.data;
    const saveStatus: InsightStatus = parsed.data.status ?? "trying";
    const citationFields = (parsed.data.citationFields ?? [])
      .map((f) => f.trim().toLowerCase())
      .filter((f): f is (typeof CITATION_FIELDS)[number] =>
        (CITATION_FIELDS as readonly string[]).includes(f),
      );

    // (1b) Per-coffee card — when the note targets a real library bag,
    // write it into that coffee's coach_insight so it shows on /coffees/[id].
    // Runs regardless of the insights-table dedup below, so re-tapping the
    // pill re-surfaces a card the user had previously resolved/hidden.
    if (parsed.data.coffeeId) {
      const coffeeRow = await db
        .select({ id: coffees.id })
        .from(coffees)
        .where(eq(coffees.id, parsed.data.coffeeId))
        .limit(1);
      if (coffeeRow.length > 0) {
        // This coffee's own latest session = the coach_insight cache key
        // (matches the regen convention in /api/coffees/[id]/insight).
        const coffeeLatest = await db
          .select({ ms: sessions.createdAtMs })
          .from(sessions)
          .where(sql`${sessions.coffee}->>'coffeeId' = ${parsed.data.coffeeId}`)
          .orderBy(desc(sessions.createdAtMs))
          .limit(1);
        const card: CoffeeCoachInsight = {
          observation,
          suggestion,
          status: saveStatus,
          generatedAtSessionMs: coffeeLatest[0]?.ms ?? 0,
          generatedAt: new Date().toISOString(),
        };
        await db
          .update(coffees)
          .set({ coachInsight: card })
          .where(eq(coffees.id, parsed.data.coffeeId));
      }
    }

    // Dedup — if the same note was already saved (same first 80 chars of
    // observation), don't write a second copy. The table is tiny, so an
    // in-memory compare is cheaper than a wildcard query.
    const key = observation.slice(0, 80).toLowerCase();
    const existingRows = await db.select({ observation: insights.observation }).from(insights);
    if (existingRows.some((r) => r.observation.slice(0, 80).toLowerCase() === key)) {
      return NextResponse.json({ ok: true, deduped: true });
    }

    // Anchor the cache key to the current corpus so the chat note never
    // freezes /taste regeneration (a now()-based value would always look
    // "newer" than the latest session and short-circuit the cache check).
    const latestRow = await db
      .select({ ms: sessions.createdAtMs })
      .from(sessions)
      .orderBy(desc(sessions.createdAtMs))
      .limit(1);
    const latestMs = latestRow[0]?.ms ?? 0;

    const now = new Date();
    const id = randomUUID();
    await db.insert(insights).values({
      id,
      observation,
      suggestion,
      citationFields,
      latestSessionMs: latestMs,
      source: "user-confirmed",
      status: saveStatus,
      dismissedAt: null,
      snoozedUntil: null,
      userNote: null,
      createdAt: now,
      updatedAt: now,
    });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error("insights POST error:", err);
    return NextResponse.json({ error: "Failed to save insight" }, { status: 500 });
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
        // Confirmation bumps source so /recommend can weight it. Other
        // transitions leave source untouched — a chat-authored note
        // (source='user-confirmed' at creation) must keep its provenance,
        // because regeneration uses it as a never-delete tier. The old
        // reset-to-'opus' here meant Save → Skip → 7 days could silently
        // delete a note the user wrote.
        ...(status === "confirmed" ? { source: "user-confirmed" as const } : {}),
        updatedAt: now,
      })
      .where(eq(insights.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("insights PATCH error:", err);
    return NextResponse.json({ error: "Failed to update insight" }, { status: 500 });
  }
}
