"use client";
import { useEffect, useRef } from "react";
import { type BrewBoundary } from "@/lib/native/brewNotifications";
import {
  currentBrewStep,
  startBrewActivity,
  updateBrewActivity,
  endBrewActivity,
  isNativeLiveActivity,
} from "@/lib/native/liveActivity";

/**
 * Runs a Live Activity for the active brew: starts it at brew start, updates the
 * step label when the step changes, ends it on reset / unmount. The timer and
 * progress bar tick natively (system-rendered), so we don't update per second —
 * only on a step change. Native-shell-only; a clean no-op in the browser.
 */
export function useBrewLiveActivity(
  boundaries: BrewBoundary[],
  elapsed: number,
  started: boolean,
  recipeName: string,
  coffeeName: string,
  targetTimeSec: number,
): void {
  const ctx = useRef({ boundaries, recipeName, coffeeName, targetTimeSec });
  useEffect(() => {
    ctx.current = { boundaries, recipeName, coffeeName, targetTimeSec };
  }, [boundaries, recipeName, coffeeName, targetTimeSec]);

  const anchorRef = useRef<number | null>(null);
  const lastStepRef = useRef<string>("");

  useEffect(() => {
    if (!isNativeLiveActivity()) return;

    // Reset → end the activity.
    if (!started || elapsed === 0) {
      if (anchorRef.current !== null) {
        anchorRef.current = null;
        lastStepRef.current = "";
        endBrewActivity();
      }
      return;
    }
    if (elapsed < 1 || targetTimeSec <= 0) return;

    const now = Date.now();
    const impliedStartMs = now - elapsed * 1000;
    const { boundaries, recipeName, coffeeName, targetTimeSec: target } = ctx.current;
    const endMs = impliedStartMs + target * 1000;
    const step = currentBrewStep(boundaries, elapsed);

    const isNew =
      anchorRef.current === null || Math.abs(impliedStartMs - anchorRef.current) > 1500;

    if (isNew) {
      anchorRef.current = impliedStartMs;
      lastStepRef.current = step.stepLabel;
      startBrewActivity({
        recipeName,
        coffeeName,
        startMs: impliedStartMs,
        endMs,
        ...step,
        paused: false,
      });
    } else if (step.stepLabel !== lastStepRef.current) {
      lastStepRef.current = step.stepLabel;
      updateBrewActivity({ endMs, ...step, paused: false });
    }
  }, [elapsed, started, targetTimeSec]);

  // End the activity if the screen unmounts mid-brew.
  useEffect(() => {
    return () => {
      if (isNativeLiveActivity()) endBrewActivity();
    };
  }, []);
}
