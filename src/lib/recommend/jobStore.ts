/**
 * Recommendation job store (server-side, in-memory).
 *
 * `/api/recommend` is a ~1-minute blocking Opus call. Held in the client it
 * dies the moment the iOS PWA is backgrounded (the WebView suspends and the
 * in-flight connection is torn down). So instead the SERVER owns the work:
 * `/api/recommend/start` kicks off generation as a detached task, parks the
 * result here, and the client polls `/api/recommend/status`. A suspended
 * client no longer kills the job; when it foregrounds and polls, the finished
 * recipe is waiting.
 *
 * Single-user app → a handful of jobs at most. The standalone Next server is
 * one long-running process, so this module-level Map persists across requests
 * (same mechanism `src/lib/native/liveActivitySchedule.ts` relies on). A
 * process restart mid-generation loses the in-flight job — the client then
 * reads `error` and offers retry. Acceptable per spec.
 */
import type { Recommendation } from "@/lib/types/session";

export type RecommendJobStatus = "running" | "done" | "error";

export interface RecommendJob {
  status: RecommendJobStatus;
  recommendation?: Recommendation;
  error?: string;
  createdAt: number;
}

const jobs = new Map<string, RecommendJob>();

// Keep the map from growing unbounded if a client never polls a job to
// completion. Generation is capped at 120s, so 10 min is comfortable.
const TTL_MS = 10 * 60 * 1000;

function evictStale(): void {
  const cutoff = Date.now() - TTL_MS;
  for (const id of Array.from(jobs.keys())) {
    const job = jobs.get(id);
    if (job && job.createdAt < cutoff) jobs.delete(id);
  }
}

/** Create a `running` job and return its id. */
export function createJob(): string {
  evictStale();
  const id = crypto.randomUUID();
  jobs.set(id, { status: "running", createdAt: Date.now() });
  return id;
}

export function getJob(id: string): RecommendJob | undefined {
  return jobs.get(id);
}

export function markDone(id: string, recommendation: Recommendation): void {
  const job = jobs.get(id);
  if (!job) return; // evicted (TTL) or superseded — nothing to update
  job.status = "done";
  job.recommendation = recommendation;
}

export function markError(id: string, error: string): void {
  const job = jobs.get(id);
  if (!job) return;
  job.status = "error";
  job.error = error;
}
