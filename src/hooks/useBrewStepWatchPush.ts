"use client";
import { useEffect, useRef } from "react";
import { type BrewBoundary } from "@/lib/native/brewNotifications";
import { isNativeWatch, pushWatchCue } from "@/lib/native/watchPush";

/**
 * Fire ONE buzz to the paired Apple Watch at each brew step — the same instant
 * the phone buzzes itself (`useBrewStepHaptics` fires the strong step buzz on
 * the same boundary). The push travels phone → server → APNs → watch, so the
 * wrist cue is driven off the phone's own timer and lands together, and works
 * with the watch app CLOSED.
 *
 * No 3-2-1 countdown here (owner's call): just one cue at the step. A late-skip
 * guard means a visibilitychange snap / Stop→Resume marks skipped boundaries
 * done WITHOUT pushing, so the watch never gets a backlog dumped on it.
 *
 * Native-shell-only; a clean no-op in the browser.
 */
export function useBrewStepWatchPush(
  boundaries: BrewBoundary[],
  elapsed: number,
  started: boolean,
): void {
  const boundariesRef = useRef(boundaries);
  useEffect(() => {
    boundariesRef.current = boundaries;
  }, [boundaries]);

  const firedRef = useRef<Set<number>>(new Set());
  const prevElapsedRef = useRef(-1);

  // Reset on brew reset (elapsed 0) or before start so a re-brew re-pushes.
  if (!started || elapsed === 0) {
    if (firedRef.current.size > 0) firedRef.current.clear();
    prevElapsedRef.current = elapsed;
  }

  useEffect(() => {
    if (!started || elapsed < 1) return;
    if (!isNativeWatch()) return;
    if (elapsed === prevElapsedRef.current) return;
    prevElapsedRef.current = elapsed;

    const LATE_TOLERANCE = 1; // seconds — still push if at most 1 s late
    for (const b of boundariesRef.current) {
      if (firedRef.current.has(b.atSec)) continue;
      if (elapsed >= b.atSec) {
        firedRef.current.add(b.atSec);
        if (elapsed - b.atSec <= LATE_TOLERANCE) pushWatchCue(b.title, b.body);
      }
    }
  }, [elapsed, started, boundaries]);
}
