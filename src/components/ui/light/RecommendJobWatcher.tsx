"use client";

import { useCallback, useEffect, useRef } from "react";
import { useFlowStore } from "@/store/flowStore";

const POLL_MS = 3000;

/**
 * Headless, always-mounted (in LightShell) watcher for the server-side
 * background recommendation job.
 *
 * Why this lives here and not in the recipe step: the whole point is that
 * generation survives the app being backgrounded. The server keeps working
 * while the iOS PWA is suspended; this watcher resumes polling the moment the
 * app foregrounds (`visibilitychange`) — the same proven trigger
 * ConnectionStatus uses to drain the offline queue — so the finished recipe
 * lands as soon as the user returns. The job id is persisted in the flow store
 * (localStorage), so a reload mid-generation resumes too.
 *
 * Renders nothing; the recipe screen reflects state via isRecommending /
 * recommendError / draft.recommendation.
 */
export default function RecommendJobWatcher() {
  const jobId = useFlowStore((s) => s.recommendJobId);
  const pollingRef = useRef(false);

  const poll = useCallback(async () => {
    const id = useFlowStore.getState().recommendJobId;
    if (!id || pollingRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    pollingRef.current = true;
    try {
      const res = await fetch(`/api/recommend/status?jobId=${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      // The job id may have been cleared (reset / retry) while the request was
      // in flight — don't clobber a fresh run with a stale result.
      if (useFlowStore.getState().recommendJobId !== id) return;
      const store = useFlowStore.getState();
      if (data.status === "done") {
        if (data.recommendation?.primaryMethod) {
          store.setRecommendation(data.recommendation);
        } else {
          store.setRecommendError("No recommendation returned");
        }
        store.setRecommendJobId(null);
        store.setIsRecommending(false);
      } else if (data.status === "error") {
        store.setRecommendError(data.error || "Something went wrong");
        store.setRecommendJobId(null);
        store.setIsRecommending(false);
      }
      // "running" → leave the interval to poll again.
    } catch {
      // Transient network/poll failure — keep the job alive and retry on the
      // next tick / foreground. A genuinely dead job surfaces as status:error.
    } finally {
      pollingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!jobId) return;
    // Keep the loading UI honest if a reload rehydrated a job mid-generation.
    if (!useFlowStore.getState().isRecommending) useFlowStore.getState().setIsRecommending(true);
    void poll();
    const interval = setInterval(() => void poll(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [jobId, poll]);

  return null;
}
