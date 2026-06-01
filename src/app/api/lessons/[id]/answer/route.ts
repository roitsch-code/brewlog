/**
 * POST /api/lessons/[id]/answer
 *
 * The user has answered a pending lesson's clarifying questions on the
 * /lessons page. Body shape:
 *
 *   { answers: [{ questionId, selected | null, freeText | null }, ...] }
 *
 * Triggers finaliseLessonWithAnswers() — a second Haiku turn that folds
 * the answers into the draft and commits the final directive. The row
 * flips from status='pending' to 'active' and the answers are persisted
 * for audit.
 *
 * The endpoint is synchronous (the user is waiting for confirmation,
 * unlike the fire-and-forget post-brew distillation). Total turn-around
 * is ~1–2 s for the Haiku call.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { finaliseLessonWithAnswers } from "@/lib/claude/lessons";

const AnswerSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        selected: z.string().min(1).nullable(),
        freeText: z.string().max(500).nullable(),
      }),
    )
    .min(1)
    .max(4),
});

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json();
    const parsed = AnswerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid answer body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const updated = await finaliseLessonWithAnswers(
      params.id,
      parsed.data.answers,
    );
    if (!updated) {
      return NextResponse.json(
        { error: "Lesson not found, not pending, or Haiku could not finalise." },
        { status: 409 },
      );
    }
    return NextResponse.json({
      id: updated.id,
      level: updated.level,
      scope: updated.scope,
      content: updated.content,
      confidenceN: updated.confidenceN,
      evidenceSessionIds: updated.evidenceSessionIds,
      source: updated.source,
      status: updated.status,
      userNote: updated.userNote,
      questions: updated.questions,
      answers: updated.answers,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (err) {
    console.error("lessons answer error:", err);
    return NextResponse.json(
      { error: "Failed to finalise lesson" },
      { status: 500 },
    );
  }
}
