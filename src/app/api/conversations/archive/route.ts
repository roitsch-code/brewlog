import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { conversations, conversationMessages } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/requireAuth";

export const dynamic = "force-dynamic";

interface ArchiveBody {
  conversationId: string;
}

/**
 * BTTS conversation-archive endpoint — specs/home.md §10.
 *
 * Marks the given conversation as archived. Per spec, *empty* threads —
 * those without any user message — are NOT preserved in the archive,
 * so we delete them outright instead of stamping archivedAt. Result:
 * the Past Conversations view only ever surfaces threads the user
 * actually engaged with.
 */
export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const body = (await req.json().catch(() => null)) as ArchiveBody | null;
  if (!body?.conversationId) {
    return NextResponse.json({ error: "conversationId required" }, { status: 400 });
  }

  // If there's no user-message in this thread, drop it entirely.
  const [{ userMessages }] = await db
    .select({
      userMessages: sql<number>`COUNT(*) FILTER (WHERE ${conversationMessages.role} = 'user')`.as(
        "userMessages"
      ),
    })
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, body.conversationId));

  if (Number(userMessages) === 0) {
    await db.delete(conversations).where(eq(conversations.id, body.conversationId));
    return NextResponse.json({ archived: false, deleted: true });
  }

  await db
    .update(conversations)
    .set({ archivedAt: new Date() })
    .where(and(eq(conversations.id, body.conversationId), isNull(conversations.archivedAt)));

  return NextResponse.json({ archived: true, deleted: false });
}
