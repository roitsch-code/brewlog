"use client";
import { useEffect, useRef } from "react";
import { type BrewBoundary } from "@/lib/native/brewNotifications";
import { startBrewOnWatch, endBrewOnWatch, isNativeWatch } from "@/lib/native/brewWatch";

/**
 * Hand the Apple Watch the brew schedule for the duration of an active brew
 * (iOS shell). Pure no-op in browsers and on any build without the watch app.
 *
 * Unlike the foreground haptics hook — which must fire each cue LIVE because
 * the phone owns the timer — this sends the WHOLE schedule ONCE when the brew
 * starts. The watch then runs the timeline itself and buzzes the wrist at each
 * boundary, so it works while the phone screen is on (the wake-locked brew
 * case) and survives a phone↔watch link hiccup mid-brew. The phone never sends
 * a per-step message, so no individual buzz can be dropped.
 *
 * Re-sends only on a wall-clock anchor drift > 1.5 s (a Stop→Resume or a
 * visibilitychange snap moved when "zero" was) — the plugin's startBrew
 * replaces the prior timeline. Schedule contents don't change mid-brew, so the
 * (re-derived-every-render) `boundaries` array identity is deliberately NOT a
 * re-send trigger.
 */
export function useBrewStepWatch(
  boundaries: BrewBoundary[],
  elapsed: number,
  started: boolean,
  recipeName: string,
): void {
  const boundariesRef = useRef(boundaries);
  useEffect(() => {
    boundariesRef.current = boundaries;
  }, [boundaries]);

  const recipeNameRef = useRef(recipeName);
  useEffect(() => {
    recipeNameRef.current = recipeName;
  }, [recipeName]);

  // The startedAtMs (epoch) anchor we last handed the watch, or null if no brew
  // is currently mirrored to the wrist.
  const sentAnchorRef = useRef<number | null>(null);

  // Reset → tell the watch to stop its timeline. Done synchronously in render
  // (matches the haptics hook) so a re-brew in the same mounted component
  // re-hands the schedule cleanly.
  if ((!started || elapsed === 0) && sentAnchorRef.current !== null) {
    sentAnchorRef.current = null;
    endBrewOnWatch();
  }

  useEffect(() => {
    if (!started || elapsed < 1) return;
    if (!isNativeWatch()) return;

    // Wall-clock moment the timer hit zero (the timer is Date.now()-anchored, so
    // this is stable across renders barring a genuine Stop→Resume / snap).
    const impliedStartMs = Date.now() - elapsed * 1000;

    const prior = sentAnchorRef.current;
    const isFirstSend = prior === null;
    const drifted = prior !== null && Math.abs(impliedStartMs - prior) > 1500;
    if (!isFirstSend && !drifted) return;

    sentAnchorRef.current = impliedStartMs;
    startBrewOnWatch(boundariesRef.current, impliedStartMs, recipeNameRef.current);
  }, [elapsed, started]);

  // Stop the watch timeline if the brew screen unmounts mid-brew.
  useEffect(() => {
    return () => {
      if (sentAnchorRef.current !== null) {
        sentAnchorRef.current = null;
        endBrewOnWatch();
      }
    };
  }, []);
}
