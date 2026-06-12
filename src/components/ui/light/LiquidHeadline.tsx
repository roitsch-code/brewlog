"use client";

import { useMemo } from "react";
import { usePresence } from "@/hooks/usePresence";

/**
 * LiquidHeadline — the welcome-haiku's per-word "liquid" entrance, extracted so
 * any big Fraunces headline can use it: the Hero questions ("What are you
 * brewing today?", "What's the vibe?") and the recipe-crafting insight.
 *
 * Each word is an inline-block span that springs in from a scattered,
 * non-left-to-right order with an overshoot (`lh-pop-*`). When `show` flips
 * false the whole line dissolves and then unmounts (via `usePresence`):
 *   - `dissolveDir="up"`   mirrors the welcome haiku (blur + float up + grow).
 *   - `dissolveDir="down"` is the OPPOSITE (blur + sink + shrink) — used by the
 *     recipe screen so a finished insight leaves the way it didn't arrive.
 *
 * Keyframes are co-located here (styled-jsx global), NOT in globals.css — the
 * installed PWA serves a stale cached globals.css, so iterated keyframes there
 * silently don't animate (see docs/liquid-design.md). Reduced motion is gated
 * in the same block. No touch-lens (that stays haiku-only).
 */

export const LH_POP_MS = 770; // each word's spring duration
export const LH_STAGGER_MS = 64; // gap between word pops
export const LH_EXIT_MS = 360; // dissolve duration

/** Total time from mount until the whole line has settled, for a given word count. */
export function liquidEntranceMs(wordCount: number): number {
  return wordCount * LH_STAGGER_MS + LH_POP_MS;
}

// Deterministic scatter: a shuffled (LCG) per-word delay so words pop in a
// non-typewriter order. Same text → same scatter. Mirrors HaikuStarter.
function scatterDelays(n: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  let seed = 1337;
  for (let i = n - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const j = seed % (i + 1);
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }
  const delay = new Array<number>(n);
  order.forEach((origIdx, pos) => {
    delay[origIdx] = pos * LH_STAGGER_MS;
  });
  return delay;
}

interface LiquidHeadlineProps {
  text: string;
  /** When this flips false the line dissolves, then unmounts. Default true. */
  show?: boolean;
  /** Dissolve direction. "up" = like the haiku; "down" = the opposite. */
  dissolveDir?: "up" | "down";
  /** Element tag — "h1" for a page hero (keeps heading semantics), else "p". */
  as?: "h1" | "p";
  /** Classes for the line (typography, alignment). */
  className?: string;
}

export default function LiquidHeadline({
  text,
  show = true,
  dissolveDir = "up",
  as: Tag = "p",
  className,
}: LiquidHeadlineProps) {
  const { mounted, state } = usePresence(show, LH_EXIT_MS);
  const exiting = state === "exit";
  const tokens = useMemo(() => text.split(/(\s+)/), [text]);
  const wordCount = useMemo(() => tokens.filter((t) => t.trim() !== "").length, [tokens]);
  const delays = useMemo(() => scatterDelays(wordCount), [wordCount]);

  const dissolveClass = dissolveDir === "down" ? "lh-dissolve-down" : "lh-dissolve-up";
  let wi = -1;

  return (
    <>
      <style jsx global>{`
        @keyframes lh-pop-1 {
          0% { opacity: 0; filter: blur(10px); transform: translate(-7px, 12px) scale(0.84) rotate(-3deg); }
          60% { opacity: 1; filter: blur(0); transform: translate(0, -2px) scale(1.07) rotate(1deg); }
          100% { opacity: 1; filter: blur(0); transform: translate(0, 0) scale(1) rotate(0deg); }
        }
        @keyframes lh-pop-2 {
          0% { opacity: 0; filter: blur(12px); transform: translate(9px, -10px) scale(0.8) rotate(4deg); }
          58% { opacity: 1; filter: blur(0); transform: translate(-1px, 1px) scale(1.08) rotate(-1deg); }
          100% { opacity: 1; filter: blur(0); transform: translate(0, 0) scale(1) rotate(0deg); }
        }
        @keyframes lh-pop-3 {
          0% { opacity: 0; filter: blur(9px); transform: translateY(16px) scale(0.9); }
          62% { opacity: 1; filter: blur(0); transform: translateY(-3px) scale(1.05); }
          100% { opacity: 1; filter: blur(0); transform: translateY(0) scale(1); }
        }
        @keyframes lh-dissolve-up {
          from { opacity: 1; filter: blur(0); transform: translateY(0) scale(1); }
          to { opacity: 0; filter: blur(10px); transform: translateY(-8px) scale(1.03); }
        }
        @keyframes lh-dissolve-down {
          from { opacity: 1; filter: blur(0); transform: translateY(0) scale(1); }
          to { opacity: 0; filter: blur(10px); transform: translateY(14px) scale(0.95); }
        }
        .lh-word { animation-fill-mode: both; }
        .lh-pop-1 { animation-name: lh-pop-1; }
        .lh-pop-2 { animation-name: lh-pop-2; }
        .lh-pop-3 { animation-name: lh-pop-3; }
        .lh-pop-1, .lh-pop-2, .lh-pop-3 {
          animation-duration: ${LH_POP_MS}ms;
          animation-timing-function: ease-out;
        }
        .lh-dissolve-up, .lh-dissolve-down {
          animation-duration: ${LH_EXIT_MS}ms;
          animation-timing-function: ease-in;
          animation-fill-mode: forwards;
        }
        .lh-dissolve-up { animation-name: lh-dissolve-up; }
        .lh-dissolve-down { animation-name: lh-dissolve-down; }
        @media (prefers-reduced-motion: reduce) {
          .lh-word, .lh-dissolve-up, .lh-dissolve-down {
            animation: none !important;
            opacity: 1 !important;
            filter: none !important;
            transform: none !important;
          }
        }
      `}</style>
      {mounted && (
        // Key on text so a new headline always remounts → replays the entrance.
        <Tag key={text} className={`${exiting ? dissolveClass : ""}${className ? ` ${className}` : ""}`}>
          {tokens.map((w, i) => {
            if (w.trim() === "") return <span key={i}>{w}</span>;
            wi += 1;
            const variant = (wi % 3) + 1;
            return (
              <span
                key={i}
                className={`lh-word lh-pop-${variant} inline-block`}
                style={{ animationDelay: `${delays[wi] ?? 0}ms` }}
              >
                {w}
              </span>
            );
          })}
        </Tag>
      )}
    </>
  );
}
