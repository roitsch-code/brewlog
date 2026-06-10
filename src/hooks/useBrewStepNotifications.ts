"use client";
import { useEffect, useRef, useCallback } from "react";
import {
  type BrewBoundary,
  ensurePermission,
  scheduleBrew,
  cancelBrew,
  isNativeShell,
} from "@/lib/native/brewNotifications";

/**
 * Glue between the brew timer and the native notification bridge (iOS shell
 * Phase 1 — see docs/ios-shell-roadmap.md). Pure no-op in browsers.
 *
 * Lifecycle, all driven by the timer's existing signals — no new events:
 *  - SCHEDULE at the first tick (`started && elapsed ≥ 1`, the same moment the
 *    wake lock engages). Anchor = Date.now() − elapsed·1000, i.e. the same
 *    wall-clock brew start the timer itself runs on.
 *  - RESCHEDULE when the anchor drifts > 1.5 s (Stop → Resume shifts the
 *    timer's start timestamp by the pause length).
 *  - CANCEL on Reset (CircularTimer emits onTick(0)), on Done (the component
 *    calls `cancelAll()`), on unmount (navigating away mid-brew), and when the
 *    watchdog sees *visible-but-paused* — ticks stall on both Stop and
 *    backgrounding, but only Stop leaves `visibilityState === "visible"`.
 *    Backgrounding must NOT cancel: surviving it is the whole point.
 */
export function useBrewStepNotifications(
  boundaries: BrewBoundary[],
  elapsed: number,
  started: boolean,
): { cancelAll: () => void } {
  const scheduledRef = useRef(false);
  const anchorRef = useRef(0);
  const prevElapsedRef = useRef(-1);
  const lastTickAtRef = useRef(0);
  const boundariesRef = useRef(boundaries);
  useEffect(() => {
    boundariesRef.current = boundaries;
  }, [boundaries]);

  const cancelAll = useCallback(() => {
    if (scheduledRef.current) {
      scheduledRef.current = false;
      void cancelBrew();
    }
  }, []);

  useEffect(() => {
    if (!isNativeShell()) return;

    // Track genuine ticks only (renders can fire without an elapsed change).
    if (elapsed !== prevElapsedRef.current) {
      prevElapsedRef.current = elapsed;
      lastTickAtRef.current = Date.now();
    }

    if (started && elapsed >= 1) {
      const anchor = Date.now() - elapsed * 1000;
      if (!scheduledRef.current) {
        scheduledRef.current = true;
        anchorRef.current = anchor;
        void ensurePermission().then(async (ok) => {
          if (!ok) {
            scheduledRef.current = false;
            return;
          }
          await scheduleBrew(boundariesRef.current, anchorRef.current);
          // Reset/Done may have raced the permission round-trip.
          if (!scheduledRef.current) void cancelBrew();
        });
      } else if (Math.abs(anchor - anchorRef.current) > 1500) {
        anchorRef.current = anchor;
        void scheduleBrew(boundariesRef.current, anchor);
      }
    }

    if (scheduledRef.current && elapsed === 0) {
      cancelAll(); // Reset pressed
    }
  }, [elapsed, started, boundaries, cancelAll]);

  // Visible-but-paused watchdog (1 s cadence; ticks land ~1/s while running).
  useEffect(() => {
    if (!isNativeShell()) return;
    const id = setInterval(() => {
      if (
        scheduledRef.current &&
        document.visibilityState === "visible" &&
        Date.now() - lastTickAtRef.current > 2500
      ) {
        cancelAll(); // Stop pressed — ticks stalled while the page stayed visible
      }
    }, 1000);
    return () => clearInterval(id);
  }, [cancelAll]);

  useEffect(() => () => cancelAll(), [cancelAll]);

  return { cancelAll };
}
