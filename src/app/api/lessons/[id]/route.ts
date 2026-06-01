/**
 * PATCH /api/lessons/[id]
 *
 * Two-way edit of a single lesson row.
 *
 * Body shape (all fields optional, at least one required):
 *   - status:   'active' | 'dismissed'           — thumbs dismiss / restore
 *   - content:  string                           — user-rewritten directive
 *   - userNote: string | null                    — free annotation
 *   - confirm:  true                             — mark as user-confirmed
 *                                                  (promotes source)
 *
 * Auto-source policy:
 *   - Editing content sets source='user-edited' (and locks the row
 *     against auto-overwrite by future distillations — see upsertLesson
 *     in src/lib/claude/lessons.ts).
 *   - confirm:true sets source='user-confirmed' but leaves content as
 *     the auto-distilled paragraph — re-distillation can still refine.
 *   - Pure status / userNote changes do NOT change source.
 *
 * DELETE /api/lessons/[id] — hard delete. Should be rare; prefer
 * status='dismissed'. Provided so the user can clear an obviously
 * wrong row when they want it gone, not just hidden.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { lessons } from "@/lib/db/schema";
import type { LessonSource } from "@/lib/db/schema";

const PatchSchema = z.object({
  status: z.enum(["active", "dismissed"]).optional(),
  content: z.string().min(1).max(2000).optional(),
  userNote: z.string().max(1000).nullable().optional(),
  confirm: z.literal(true).optional(),
});

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json();
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid patch body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { status, content, userNote, confirm } = parsed.data;

    const existingRows = await db
      .select()
      .from(lessons)
      .where(eq(lessons.id, params.id))
      .limit(1);
    if (existingRows.length === 0) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (status) updates.status = status;
    if (typeof content === "string") {
      updates.content = content.trim();
      updates.source = "user-edited" satisfies LessonSource;
    } else if (confirm === true) {
      updates.source = "user-confirmed" satisfies LessonSource;
    }
    if (userNote !== undefined) updates.userNote = userNote;

    await db.update(lessons).set(updates).where(eq(lessons.id, params.id));
    const refreshed = await db
      .select()
      .from(lessons)
      .where(eq(lessons.id, params.id))
      .limit(1);
    const r = refreshed[0];
    return NextResponse.json({
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
    });
  } catch (err) {
    console.error("lessons PATCH error:", err);
    return NextResponse.json({ error: "Failed to update lesson" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await db.delete(lessons).where(eq(lessons.id, params.id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("lessons DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete lesson" }, { status: 500 });
  }
}
