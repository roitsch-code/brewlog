"use client";
import { useEffect, useRef } from "react";
import { type BrewBoundary } from "@/lib/native/brewNotifications";
import { COUNTDOWN_SECONDS, countdownTap, stepBuzz, isNativeHaptics } from "@/lib/native/brewHaptics";

/**
 * Foreground Taptic cues for an active brew (iOS shell). Pure no-op in browsers
 * and on the lock-screen-notification path — see brewHaptics.ts for why this is
 * native-only and separate from notifications.
 *
 * Unlike notifications (scheduled once, fired by iOS even when JS is frozen),
 * haptics must fire LIVE at the moment — so this runs off the timer's own
 * integer-second `elapsed`. The app is foregrounded + wake-locked during a
 * brew, so the tick keeps coming and JS is alive to fire each cue.
 *
 * For every step boundary it fires: a short MEDIUM tap at t-3 / t-2 / t-1 (the
 * 3-2-1 countdown), then a strong, longer buzz AT the boundary ("act now").
 *
 * A cue fires only when `elapsed` lands on (or within 1 s late of) its moment.
 * If `elapsed` jumps forward — a visibilitychange snap after a tab switch /
 * Stop→Resume — the skipped cues are marked done WITHOUT buzzing, so the phone
 * never machine-guns a backlog of stale taps.
 */
export function useBrewStepHaptics(
  boundaries: BrewBoundary[],
  elapsed: number,
  started: boolean,
): void {
  const boundariesRef = useRef(boundaries);
  useEffect(() => {
    boundariesRef.current = boundaries;
  }, [boundaries]);

  const firedRef = useRef<Set<string>>(new Set());
  const prevElapsedRef = useRef(-1);

  // Reset the fired-set whenever the brew resets (Reset emits elapsed 0) or
  // hasn't started — so a re-brew in the same mounted component replays cues.
  if (!started || elapsed === 0) {
    if (firedRef.current.size > 0) firedRef.current.clear();
    prevElapsedRef.current = elapsed;
  }

  useEffect(() => {
    if (!started || elapsed < 1) return;
    if (!isNativeHaptics()) return;
    // Act only on genuine ticks — a re-render with no elapsed change must not
    // re-evaluate (and an integer that repeats across two 500 ms syncs is fine,
    // the fired-set guards each cue anyway).
    if (elapsed === prevElapsedRef.current) return;
    prevElapsedRef.current = elapsed;

    const LATE_TOLERANCE = 1; // seconds: still fire if we're at most 1 s late

    for (const b of boundariesRef.current) {
      // 3-2-1 countdown taps.
      for (const lead of COUNTDOWN_SECONDS) {
        const at = b.atSec - lead;
        if (at <= 0) continue;
        const key = `t@${at}`;
        if (firedRef.current.has(key)) continue;
        if (elapsed >= at) {
          firedRef.current.add(key);
          if (elapsed - at <= LATE_TOLERANCE) countdownTap();
        }
      }
      // Strong "act now" buzz at the boundary.
      const key = `b@${b.atSec}`;
      if (!firedRef.current.has(key) && elapsed >= b.atSec) {
        firedRef.current.add(key);
        if (elapsed - b.atSec <= LATE_TOLERANCE) stepBuzz();
      }
    }
  }, [elapsed, started, boundaries]);
}
