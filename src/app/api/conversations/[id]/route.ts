import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { conversations, conversationMessages } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/requireAuth";

export const dynamic = "force-dynamic";

/**
 * BTTS individual-conversation endpoint — specs/home.md §10 / §7.2.
 *
 *   GET    → load a conversation + its messages for the read-only
 *            Past Conversations detail view.
 *   DELETE → remove a conversation from the archive. ON DELETE CASCADE
 *            on conversation_messages.conversation_id cleans up the
 *            messages too.
 */

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const [conversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, params.id))
    .limit(1);

  if (!conversation) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const messages = await db
    .select()
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, params.id))
    .orderBy(asc(conversationMessages.createdAt));

  return NextResponse.json({
    conversation,
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      imageUrl: m.imageUrl ?? undefined,
      coffeeRef:
        m.coffeeRefId && m.coffeeRefRoaster && m.coffeeRefName
          ? { id: m.coffeeRefId, roaster: m.coffeeRefRoaster, name: m.coffeeRefName }
          : undefined,
      actions: m.actions ?? undefined,
      createdAt: m.createdAt,
    })),
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  await db.delete(conversations).where(eq(conversations.id, params.id));
  return NextResponse.json({ deleted: true });
}
