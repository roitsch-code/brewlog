import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/requireAuth";
import { getJob } from "@/lib/recommend/jobStore";

export const dynamic = "force-dynamic";

/**
 * Poll the status of a background recommendation job. Returns the recommendation
 * once `done`. An unknown id (TTL-evicted, or dropped by a server restart
 * mid-generation) reads as `error` so the client surfaces retry rather than
 * polling forever.
 */
export async function GET(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "Missing jobId" }, { status: 400 });

  const job = getJob(jobId);
  if (!job) {
    return NextResponse.json({ status: "error", error: "Recommendation expired" });
  }

  if (job.status === "done") {
    return NextResponse.json({ status: "done", recommendation: job.recommendation });
  }
  if (job.status === "error") {
    return NextResponse.json({ status: "error", error: job.error ?? "Recommendation failed" });
  }
  return NextResponse.json({ status: "running" });
}
