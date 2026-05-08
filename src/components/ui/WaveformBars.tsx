"use client";
import { useEffect, useRef } from "react";

interface WaveformBarsProps {
  /** Returns the current peak amplitude (0..1). */
  getLevel: () => number;
  /** Number of bars to render. */
  bars?: number;
  /** Tailwind/style color for the bars. */
  color?: string;
  /** Container className. */
  className?: string;
  /** Bar height ceiling in px. */
  height?: number;
}

/**
 * Live waveform — bars driven by AnalyserNode (spec §6.3). Each frame we
 * shift the existing levels left by one and push the latest peak on the
 * right, so bars scroll right-to-left like a tape readout.
 *
 * Implementation note: levels live in a ref + we mutate DOM heights
 * directly via rAF. React state would re-render at 60 fps and choke the
 * main thread on iOS Safari. This is one of the few cases where direct
 * DOM mutation beats declarative rendering.
 */
export default function WaveformBars({
  getLevel,
  bars = 28,
  color = "var(--text-accent)",
  className = "",
  height = 40,
}: WaveformBarsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const levelsRef = useRef<number[]>(Array(bars).fill(0));

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const next = getLevel();
      const arr = levelsRef.current;
      // Shift left, append the latest peak (with a tiny floor so silence
      // shows as a thin baseline rather than disappearing entirely).
      for (let i = 0; i < arr.length - 1; i++) arr[i] = arr[i + 1];
      arr[arr.length - 1] = Math.max(next, 0.04);
      const container = containerRef.current;
      if (container) {
        const children = container.children;
        for (let i = 0; i < children.length && i < arr.length; i++) {
          const el = children[i] as HTMLElement;
          el.style.height = `${Math.round(arr[i] * height)}px`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [getLevel, height]);

  return (
    <div
      ref={containerRef}
      className={`flex items-center justify-center gap-[3px] ${className}`}
      style={{ height }}
      aria-hidden="true"
    >
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className="rounded-full"
          style={{
            display: "inline-block",
            width: 3,
            height: 2,
            background: color,
            transition: "height 60ms linear",
          }}
        />
      ))}
    </div>
  );
}
