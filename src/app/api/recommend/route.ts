import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/requireAuth";
import { runRecommendation } from "@/lib/recommend/run";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Synchronous recommendation — generate and return in one request. Kept for
 * back-compat; the brew flow now uses the background-job path
 * (`/api/recommend/start` + `/api/recommend/status`) so generation survives the
 * app being backgrounded. Both share `runRecommendation`.
 */
export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const recommendation = await runRecommendation(body);
    return NextResponse.json(recommendation);
  } catch (err) {
    console.error("recommend error:", err);
    return NextResponse.json({ error: "Recommendation failed" }, { status: 500 });
  }
}
