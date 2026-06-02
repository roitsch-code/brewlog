import { NextRequest, NextResponse } from "next/server";
import { and, isNotNull, lt } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { conversations } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/**
 * Daily cleanup cron — deletes archived conversations older than 7
 * days. Conversation messages cascade-delete via the foreign key on
 * conversation_messages.conversation_id (onDelete: cascade in
 * src/lib/db/schema.ts).
 *
 * NEVER touches the active conversation (archivedAt IS NULL) — that's
 * the live thread on /home; auto-deleting it after a quiet week would
 * surprise the user. Only archived past-conversations get the TTL.
 *
 * Triggered by Ofelia daily (see deploy/ofelia.ini). Auth via
 * CRON_SECRET bearer token, same pattern as /api/research and
 * /api/coffees/compact.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const result = await db
      .delete(conversations)
      .where(
        and(
          isNotNull(conversations.archivedAt),
          lt(conversations.archivedAt, cutoff),
        ),
      )
      .returning({ id: conversations.id });

    return NextResponse.json({
      deleted: result.length,
      cutoff: cutoff.toISOString(),
    });
  } catch (err) {
    console.error("conversations/cleanup error:", err);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
