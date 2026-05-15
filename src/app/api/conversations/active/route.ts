import { NextRequest, NextResponse } from "next/server";
import { asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { conversations, conversationMessages } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/requireAuth";

export const dynamic = "force-dynamic";

/**
 * BTTS active-conversation lookup — specs/home.md §10.
 *
 * Returns the most recently-touched non-archived conversation and its
 * messages, or null when there's nothing live. Home checks the
 * conversation's `lastMessageAt` against the 30-min idle window
 * client-side; if it's older the client calls /api/conversations/archive
 * to retire it and falls back to the daily Starter.
 */
export async function GET(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const [active] = await db
    .select()
    .from(conversations)
    .where(isNull(conversations.archivedAt))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(1);

  if (!active) {
    return NextResponse.json(null);
  }

  const messages = await db
    .select()
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, active.id))
    .orderBy(asc(conversationMessages.createdAt));

  return NextResponse.json({
    conversation: active,
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
