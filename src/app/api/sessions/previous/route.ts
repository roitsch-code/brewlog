import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/requireAuth";
import { loadRecentSessions } from "@/lib/claude/sessionCorpus";
import { pickPreviousBrew } from "@/lib/brew/previousBrew";

/**
 * GET /api/sessions/previous?coffeeId=…&roaster=…&name=…
 *
 * The previous home brew of the coffee being logged (2026-10-03), so the
 * post-brew log can show "last time with this coffee" and ask one tap:
 * better / same / worse. Also returns the last five ratings of the coffee,
 * which drives the post-rating coach's "rating drop" signal — a trigger the
 * route had accepted since June and the client had never been able to send.
 */
export async function GET(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  const url = new URL(req.url);
  const coffeeId = url.searchParams.get("coffeeId")?.trim() || undefined;
  const roaster = url.searchParams.get("roaster")?.trim() || undefined;
  const name = url.searchParams.get("name")?.trim() || undefined;
  if (!coffeeId && !(roaster && name)) {
    return NextResponse.json({ previous: null, ratings: [], count: 0 });
  }
  try {
    const sessions = await loadRecentSessions(400);
    return NextResponse.json(pickPreviousBrew(sessions, { coffeeId, roaster, name }));
  } catch (err) {
    console.error("[sessions/previous]", err);
    return NextResponse.json({ previous: null, ratings: [], count: 0 });
  }
}
