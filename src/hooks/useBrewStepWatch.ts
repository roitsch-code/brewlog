"use client";
import { useEffect, useRef } from "react";
import { type BrewBoundary } from "@/lib/native/brewNotifications";
import { startBrewOnWatch, endBrewOnWatch, isNativeWatch } from "@/lib/native/brewWatch";

/**
 * Hand the whole step schedule to the paired Apple Watch at brew start, so the
 * watch app runs the timeline itself and buzzes the wrist per step (even with
 * the iPhone screen on). We send ONCE at start (not per step), so a phone↔watch
 * hiccup can't drop a single buzz — the watch holds every fire time.
 *
 * Resends only if the wall-clock anchor drifts > 1.5 s (a Stop→Resume or
 * visibilitychange snap). Ends the brew on the watch on Reset and on unmount.
 * Native-shell-only; a clean no-op in the browser.
 */
export function useBrewStepWatch(
  boundaries: BrewBoundary[],
  elapsed: number,
  started: boolean,
  recipeName: string,
): void {
  const boundariesRef = useRef(boundaries);
  const recipeNameRef = useRef(recipeName);
  useEffect(() => {
    boundariesRef.current = boundaries;
    recipeNameRef.current = recipeName;
  }, [boundaries, recipeName]);

  const sentAnchorRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isNativeWatch()) return;

    // Reset → tell the watch to stop and clear our anchor.
    if (!started || elapsed === 0) {
      if (sentAnchorRef.current !== null) {
        sentAnchorRef.current = null;
        endBrewOnWatch();
      }
      return;
    }
    if (elapsed < 1) return;

    const impliedStartMs = Date.now() - elapsed * 1000;
    if (
      sentAnchorRef.current === null ||
      Math.abs(impliedStartMs - sentAnchorRef.current) > 1500
    ) {
      sentAnchorRef.current = impliedStartMs;
      startBrewOnWatch(boundariesRef.current, impliedStartMs, recipeNameRef.current);
    }
  }, [elapsed, started, boundaries]);

  // End the brew on the watch if the screen unmounts mid-brew.
  useEffect(() => {
    return () => {
      if (isNativeWatch()) endBrewOnWatch();
    };
  }, []);
}
