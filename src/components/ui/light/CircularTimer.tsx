"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Light System fork of /components/ui/CircularTimer.tsx.
 *
 * Identical timer mechanics: Date.now() wall-clock anchor (immune to
 * setInterval drift), visibilitychange snap so an iOS tab switch
 * recovers the right elapsed value, no auto-stop. Only the visual
 * layer changes.
 *
 * Colour map vs Dark:
 *   - Track ring:    #1E1E1E      → hsl(0 0% 14% / 0.12)   warm-near-black
 *                                                            at 12% (subtle)
 *   - Progress ring: #F0EDE8      → hsl(0 0% 14%)          solid foreground
 *   - Overtime ring: #F59E0B      → hsl(28 95% 45%)        amber-600 darker so
 *                                                            it reads on cream
 *   - Time text:     text-white   → text-light-foreground
 *   - Reset btn:     bg-brew-surface border → light glass card
 *   - Primary CTA:   bg-white text-black → bg-light-foreground text-cream
 *
 * Mounted only by LightStepBrew while the brew flow is on /brew/preview.
 * Dark CircularTimer keeps painting /brew/new and any other Dark consumer.
 */

interface CircularTimerProps {
  targetSeconds?: number;
  onComplete?: (elapsed: number) => void;
  onTick?: (elapsed: number) => void;
  className?: string;
}

export default function LightCircularTimer({ targetSeconds, onComplete, onTick, className }: CircularTimerProps) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef(onComplete);
  const onTickRef = useRef(onTick);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { onTickRef.current = onTick; }, [onTick]);

  const elapsedRef = useRef(0);
  const startTimestampRef = useRef<number | null>(null);

  const syncElapsed = useCallback(() => {
    if (startTimestampRef.current === null) return;
    const next = Math.round((Date.now() - startTimestampRef.current) / 1000);
    setElapsed(next);
    elapsedRef.current = next;
    onTickRef.current?.(next);
  }, []);

  const stop = useCallback(() => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    onCompleteRef.current?.(elapsedRef.current);
  }, []);

  useEffect(() => {
    if (running) {
      startTimestampRef.current = Date.now() - elapsedRef.current * 1000;
      intervalRef.current = setInterval(syncElapsed, 500);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, syncElapsed]);

  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden && running) syncElapsed();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [running, syncElapsed]);

  const reset = () => {
    setRunning(false);
    setElapsed(0);
    elapsedRef.current = 0;
    startTimestampRef.current = null;
    onTickRef.current?.(0);
  };

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  const overtime = targetSeconds ? elapsed > targetSeconds : false;
  const overSec = overtime && targetSeconds ? elapsed - targetSeconds : 0;

  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const progress = targetSeconds ? Math.min(elapsed / targetSeconds, 1) : 0;
  const dashOffset = circumference * (1 - progress);
  // Inline SVG strokes can't read Tailwind tokens; mirror the
  // `light-foreground` (anthracite) and `light-accent-overtime` (amber)
  // tokens here so the same single source applies to ring, time text,
  // and the "Done" button tint below. `withAlpha` produces variants
  // (e.g. amber at 12% for the "Done" background tint).
  const ANTHRACITE = "hsl(0 0% 14%)";
  const OVERTIME = "hsl(28 95% 45%)";
  const withAlpha = (color: string, a: number) => color.replace(")", ` / ${a})`);
  const trackColor = withAlpha(ANTHRACITE, 0.12);
  const ringColor = overtime ? OVERTIME : ANTHRACITE;
  const timeColor = overtime ? OVERTIME : ANTHRACITE;

  return (
    <div className={cn("flex flex-col items-center gap-5", className)}>
      <div className="relative">
        <svg width="180" height="180" className="-rotate-90">
          <circle cx="90" cy="90" r={radius} fill="none" stroke={trackColor} strokeWidth="5" />
          <circle
            cx="90"
            cy="90"
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={targetSeconds ? dashOffset : circumference * 0.15}
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-mono-num text-4xl font-medium tabular-nums"
            style={{ color: timeColor }}
          >
            {timeStr}
          </span>
          {targetSeconds && !overtime && (
            <span className="text-light-muted-foreground text-xs mt-1">
              / {Math.floor(targetSeconds / 60)}:{String(targetSeconds % 60).padStart(2, "0")}
            </span>
          )}
          {overtime && (
            <span className="text-xs mt-1 font-mono-num" style={{ color: withAlpha(OVERTIME, 0.85) }}>
              +{Math.floor(overSec / 60)}:{String(overSec % 60).padStart(2, "0")} over
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {elapsed > 0 && !running && (
          <button
            type="button"
            onClick={reset}
            aria-label="Reset"
            className="w-10 h-10 rounded-full bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 text-light-muted-foreground flex items-center justify-center active:scale-95 transition-transform"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={() => (running ? stop() : setRunning(true))}
          className={cn(
            "px-10 py-4 rounded-full font-semibold text-base transition-all active:scale-95",
            running && overtime
              ? "border"
              : running
                ? "bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 text-light-foreground"
                : "bg-light-foreground text-light-text-on-dark",
          )}
          style={
            running && overtime
              ? {
                  background: withAlpha(OVERTIME, 0.12),
                  borderColor: withAlpha(OVERTIME, 0.5),
                  color: OVERTIME,
                }
              : undefined
          }
        >
          {running && overtime ? "Done" : running ? "Stop" : elapsed > 0 ? "Resume" : "Start Brew"}
        </button>
      </div>
    </div>
  );
}
