import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/requireAuth";
import { runRecommendation } from "@/lib/recommend/run";
import { createJob, markDone, markError } from "@/lib/recommend/jobStore";

export const dynamic = "force-dynamic";
// The detached task does the ~1-min Opus call; keep the platform from capping
// it even though THIS handler returns in milliseconds.
export const maxDuration = 120;

/**
 * Kick off a recommendation as a server-side background job and return its id
 * immediately. The generation continues in the long-running Next process after
 * this response is sent (the same mechanism `liveActivitySchedule` relies on),
 * so a backgrounded/suspended iOS client no longer kills it. The client polls
 * `/api/recommend/status` for the result.
 */
export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  let body: { coffee: unknown; context: unknown; pastSessions?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const jobId = createJob();

  // Fire-and-forget — do NOT await. The promise keeps running on the event loop
  // after we respond; the result lands in the job store.
  void runRecommendation(body)
    .then((recommendation) => markDone(jobId, recommendation))
    .catch((err) => {
      console.error("recommend job error:", err);
      markError(jobId, "Recommendation failed");
    });

  return NextResponse.json({ jobId });
}
