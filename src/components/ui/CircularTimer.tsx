"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils/cn";

interface CircularTimerProps {
  targetSeconds?: number;
  onComplete?: (elapsed: number) => void;
  onTick?: (elapsed: number) => void;
  className?: string;
}

export default function CircularTimer({ targetSeconds, onComplete, onTick, className }: CircularTimerProps) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Keep latest callbacks in refs so the interval closure never goes stale
  const onCompleteRef = useRef(onComplete);
  const onTickRef = useRef(onTick);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { onTickRef.current = onTick; }, [onTick]);

  const elapsedRef = useRef(0);

  const stop = useCallback(() => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    onCompleteRef.current?.(elapsedRef.current);
  }, []);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setElapsed(e => {
          const next = e + 1;
          elapsedRef.current = next;
          onTickRef.current?.(next);
          return next;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  // Auto-stop when target reached
  useEffect(() => {
    if (targetSeconds && elapsed >= targetSeconds && running) {
      stop();
    }
  }, [elapsed, targetSeconds, running, stop]);

  const reset = () => {
    setRunning(false);
    setElapsed(0);
    elapsedRef.current = 0;
    onTickRef.current?.(0);
  };

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const progress = targetSeconds ? Math.min(elapsed / targetSeconds, 1) : 0;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className={cn("flex flex-col items-center gap-5", className)}>
      {/* Circular progress */}
      <div className="relative">
        <svg width="180" height="180" className="-rotate-90">
          <circle cx="90" cy="90" r={radius} fill="none" stroke="#1E1E1E" strokeWidth="5" />
          <circle
            cx="90" cy="90" r={radius}
            fill="none"
            stroke="#F0EDE8"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={targetSeconds ? dashOffset : circumference * 0.15}
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono-num text-4xl font-medium text-white tabular-nums">{timeStr}</span>
          {targetSeconds && (
            <span className="text-brew-muted text-xs mt-1">
              / {Math.floor(targetSeconds / 60)}:{String(targetSeconds % 60).padStart(2, "0")}
            </span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        {elapsed > 0 && !running && (
          <button
            type="button"
            onClick={reset}
            className="w-10 h-10 rounded-full bg-brew-surface border border-brew-border text-brew-muted flex items-center justify-center active:scale-95 transition-transform"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={() => running ? stop() : setRunning(true)}
          className={cn(
            "px-10 py-4 rounded-full font-semibold text-base transition-all active:scale-95",
            running
              ? "bg-brew-surface border border-brew-border text-white"
              : "bg-white text-black"
          )}
        >
          {running ? "Stop" : elapsed > 0 ? "Resume" : "Start Brew"}
        </button>
      </div>
    </div>
  );
}
