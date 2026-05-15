import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { conversations, conversationMessages } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/requireAuth";

export const dynamic = "force-dynamic";

interface NavActionDTO {
  destination: string;
  label: string;
  reason?: string;
  id?: string;
}

interface AppendBody {
  conversationId?: string;
  role: "user" | "assistant";
  content?: string;
  imageUrl?: string | null;
  coffeeRef?: { id: string; roaster: string; name: string } | null;
  actions?: NavActionDTO[] | null;
}

/**
 * BTTS conversations endpoint — specs/home.md §10.
 *
 *   GET  → list archived conversations (date, preview, count) for the
 *          Past Conversations view (§7.2 / PR2l).
 *   POST → append a message to an existing conversation, or create a
 *          new one when no id is provided. Returns the conversationId
 *          so the client can stash it for subsequent appends.
 */

export async function GET(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const rows = await db
    .select({
      id: conversations.id,
      startedAt: conversations.startedAt,
      lastMessageAt: conversations.lastMessageAt,
      archivedAt: conversations.archivedAt,
      messageCount: conversations.messageCount,
      firstUserMessage: conversations.firstUserMessage,
    })
    .from(conversations)
    .where(isNotNull(conversations.archivedAt))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(200);

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const body = (await req.json().catch(() => null)) as AppendBody | null;
  if (!body || (body.role !== "user" && body.role !== "assistant")) {
    return NextResponse.json({ error: "role required" }, { status: 400 });
  }
  const content = body.content ?? "";
  const hasAttachment = !!(body.imageUrl || body.coffeeRef);
  if (!content && !hasAttachment && (!body.actions || body.actions.length === 0)) {
    return NextResponse.json({ error: "empty message" }, { status: 400 });
  }

  let conversationId = body.conversationId ?? null;

  // Create the conversation lazily on the first append.
  if (!conversationId) {
    const [created] = await db
      .insert(conversations)
      .values({
        firstUserMessage: body.role === "user" ? content.slice(0, 200) || null : null,
      })
      .returning({ id: conversations.id });
    conversationId = created.id;
  }

  await db.insert(conversationMessages).values({
    conversationId,
    role: body.role,
    content,
    imageUrl: body.imageUrl ?? null,
    coffeeRefId: body.coffeeRef?.id ?? null,
    coffeeRefRoaster: body.coffeeRef?.roaster ?? null,
    coffeeRefName: body.coffeeRef?.name ?? null,
    actions: body.actions ?? null,
  });

  // Bump conversation metadata. If this is the first user message and
  // firstUserMessage is still null (e.g. a stale row), backfill it.
  await db
    .update(conversations)
    .set({
      lastMessageAt: new Date(),
      messageCount: sql`${conversations.messageCount} + 1`,
      ...(body.role === "user" && content
        ? { firstUserMessage: sql`COALESCE(${conversations.firstUserMessage}, ${content.slice(0, 200)})` }
        : {}),
    })
    .where(eq(conversations.id, conversationId));

  return NextResponse.json({ conversationId });
}
