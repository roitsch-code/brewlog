"use client";
import { useEffect, useRef } from "react";
import { type BrewBoundary } from "@/lib/native/brewNotifications";
import { startBrewOnWatch, endBrewOnWatch, isNativeWatch } from "@/lib/native/brewWatch";

/**
 * Hand the whole step schedule to the paired Apple Watch, so the watch app runs
 * the timeline itself and buzzes the wrist per step (even with the iPhone screen
 * on). The schedule carries a stable brewId (the wall-clock anchor); the watch
 * dedupes on it, so we can RE-SEND safely.
 *
 * We re-send every ~3 s for the whole brew (build 18): the watch app may not be
 * reachable at the exact instant the brew starts (screen off / wrist down), and
 * a single send would then be lost. Re-sending means the watch picks the brew up
 * the moment it next becomes reachable — and the brewId dedupe stops the re-send
 * from ever restarting an already-running brew.
 *
 * A wall-clock anchor drift > 1.5 s (Stop→Resume / visibilitychange snap) starts
 * a fresh brewId. Ends the brew on the watch on Reset and on unmount.
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
  const lastSendMsRef = useRef(0);

  useEffect(() => {
    if (!isNativeWatch()) return;

    // Reset → tell the watch to stop and clear our anchor.
    if (!started || elapsed === 0) {
      if (sentAnchorRef.current !== null) {
        sentAnchorRef.current = null;
        lastSendMsRef.current = 0;
        endBrewOnWatch();
      }
      return;
    }
    if (elapsed < 1) return;

    const now = Date.now();
    const impliedStartMs = now - elapsed * 1000;
    const isNewBrew =
      sentAnchorRef.current === null ||
      Math.abs(impliedStartMs - sentAnchorRef.current) > 1500;

    if (isNewBrew) {
      sentAnchorRef.current = impliedStartMs;
    }
    // Send on a new brew, and re-send every ~3 s on the SAME stable anchor so a
    // missed reachability window recovers (the watch dedupes on the anchor).
    if (isNewBrew || now - lastSendMsRef.current > 3000) {
      lastSendMsRef.current = now;
      startBrewOnWatch(boundariesRef.current, sentAnchorRef.current!, recipeNameRef.current);
    }
  }, [elapsed, started, boundaries]);

  // End the brew on the watch if the screen unmounts mid-brew.
  useEffect(() => {
    return () => {
      if (isNativeWatch()) endBrewOnWatch();
    };
  }, []);
}
