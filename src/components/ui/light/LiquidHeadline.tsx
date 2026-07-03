"use client";

import { useMemo, useState, useEffect, type CSSProperties } from "react";
import { usePresence } from "@/hooks/usePresence";

/**
 * LiquidHeadline — the welcome-haiku's per-word "liquid" entrance, extracted so
 * any big Fraunces headline can use it: the Hero questions ("What are you
 * brewing today?", "What's the vibe?") and the recipe-crafting insight.
 *
 * Each word is an inline-block span that springs in from a scattered,
 * non-left-to-right order with an overshoot (`lh-pop-*`). When `show` flips
 * false the line leaves THE SAME WAY IN REVERSE: each word retreats one after
 * another (the assembly played backwards — last word in, first word out),
 * scattered + staggered, NOT a one-shot whole-line fade. `dissolveDir` only
 * sets where the words drift as they go: "up" floats + grows (like the haiku),
 * "down" sinks + shrinks (the opposite — used by the recipe screen).
 *
 * Timings are props (`popMs` / `staggerMs` / `exitMs`) so a calm, slow surface
 * (the rotating recipe insight) and a snappy one (the Hero) can differ. Defaults
 * keep the Hero at its original speed.
 *
 * Keyframes are co-located here (styled-jsx global), NOT in globals.css — the
 * installed PWA serves a stale cached globals.css, so iterated keyframes there
 * silently don't animate (see docs/liquid-design.md). Reduced motion is gated
 * in the same block. No touch-lens (that stays haiku-only).
 */

export const LH_POP_MS = 770; // default per-word entrance duration
export const LH_STAGGER_MS = 64; // default gap between words

// Transparent vertical room around every word so the descenders (g/y/j/p) + the
// entrance blur halo are ALWAYS inside the element's box. While a word animates
// (transform/filter) it's on a WebKit/iOS compositing layer whose backing store
// is rasterized from this box — without the room the layer is the line-height
// box and the descenders get sheared off DURING the whole build-up (not just at
// rest). The equal negative margin cancels the layout + baseline effect, so this
// is invisible except that the descenders now paint in full at every frame.
const WORD_BOX = {
  paddingTop: "0.5em",
  paddingBottom: "0.5em",
  marginTop: "-0.5em",
  marginBottom: "-0.5em",
} as const;

/** Time from mount until the whole line has settled, for a given word count. */
export function liquidEntranceMs(
  wordCount: number,
  popMs = LH_POP_MS,
  staggerMs = LH_STAGGER_MS,
): number {
  return wordCount * staggerMs + popMs;
}

/** Time from `show=false` until the whole line has left (drives `usePresence`). */
export function liquidExitMs(wordCount: number, exitMs: number, staggerMs = LH_STAGGER_MS): number {
  return Math.max(0, wordCount - 1) * staggerMs + exitMs;
}

// Deterministic scatter: a shuffled (LCG) per-word delay so words pop in a
// non-typewriter order. Same text → same scatter. Mirrors HaikuStarter.
function scatterDelays(n: number, staggerMs: number): number[] {
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
    delay[origIdx] = pos * staggerMs;
  });
  return delay;
}

interface LiquidHeadlineProps {
  text: string;
  /** When this flips false the line leaves (per-word, reversed), then unmounts. Default true. */
  show?: boolean;
  /** Where words drift as they leave. "up" = like the haiku; "down" = the opposite. */
  dissolveDir?: "up" | "down";
  /** Element tag — "h1" for a page hero (keeps heading semantics), else "p". */
  as?: "h1" | "p";
  /** Classes for the line (typography, alignment). */
  className?: string;
  /** Per-word entrance duration (ms). */
  popMs?: number;
  /** Gap between words for both entrance and exit (ms). */
  staggerMs?: number;
  /** Per-word exit duration (ms). Defaults to `popMs`. */
  exitMs?: number;
}

export default function LiquidHeadline({
  text,
  show = true,
  dissolveDir = "up",
  as: Tag = "p",
  className,
  popMs = LH_POP_MS,
  staggerMs = LH_STAGGER_MS,
  exitMs,
}: LiquidHeadlineProps) {
  const resolvedExitMs = exitMs ?? popMs;
  const tokens = useMemo(() => text.split(/(\s+)/), [text]);
  const wordCount = useMemo(() => tokens.filter((t) => t.trim() !== "").length, [tokens]);
  const enterDelays = useMemo(() => scatterDelays(wordCount, staggerMs), [wordCount, staggerMs]);
  // Exit plays the assembly in reverse: the last word to arrive leaves first.
  const maxEnter = enterDelays.length ? Math.max(...enterDelays) : 0;
  const exitDelays = useMemo(
    () => enterDelays.map((d) => maxEnter - d),
    [enterDelays, maxEnter],
  );

  const { mounted, state } = usePresence(show, liquidExitMs(wordCount, resolvedExitMs, staggerMs));
  const exiting = state === "exit";

  // Once the entrance has finished, DROP the animation class from every word so
  // it renders in the normal (non-composited) paint path. This is THE fix for
  // the clipped Fraunces descenders (g/y/j/p): a word that keeps an assigned
  // `animation` (even with `fill-mode: both` ending on transform/filter: none)
  // stays on a WebKit/iOS compositing layer whose backing store is clipped to
  // the line-height box, cutting the descenders that overflow it. Zeroing the
  // final keyframe (#467, #471) did NOT help because the animation is still
  // assigned. HaikuStarter never clips precisely because it drops the class
  // after settling — do the same here. At rest a word is a plain inline-block:
  // no animation, no transform, no filter, no layer → descenders paint in full.
  const [settled, setSettled] = useState(false);
  // Reset synchronously when the headline text changes (React's "adjust state on
  // prop change" pattern) so a new insight starts un-settled in the SAME render —
  // no one-frame flash of the fully-formed word before its entrance replays.
  const [settledFor, setSettledFor] = useState(text);
  if (settledFor !== text) {
    setSettledFor(text);
    setSettled(false);
  }
  useEffect(() => {
    if (exiting) return; // leaving → keep the exit animation, don't settle
    const t = setTimeout(
      () => setSettled(true),
      liquidEntranceMs(wordCount, popMs, staggerMs) + 60,
    );
    return () => clearTimeout(t);
  }, [text, exiting, wordCount, popMs, staggerMs]);

  let wi = -1;
  return (
    <>
      <style jsx global>{`
        @keyframes lh-pop-1 {
          0% { opacity: 0; filter: blur(10px); transform: translate(-7px, 12px) scale(0.84) rotate(-3deg); }
          60% { opacity: 1; filter: blur(0); transform: translate(0, -2px) scale(1.07) rotate(1deg); }
          100% { opacity: 1; filter: none; transform: none; }
        }
        @keyframes lh-pop-2 {
          0% { opacity: 0; filter: blur(12px); transform: translate(9px, -10px) scale(0.8) rotate(4deg); }
          58% { opacity: 1; filter: blur(0); transform: translate(-1px, 1px) scale(1.08) rotate(-1deg); }
          100% { opacity: 1; filter: none; transform: none; }
        }
        @keyframes lh-pop-3 {
          0% { opacity: 0; filter: blur(9px); transform: translateY(16px) scale(0.9); }
          62% { opacity: 1; filter: blur(0); transform: translateY(-3px) scale(1.05); }
          100% { opacity: 1; filter: none; transform: none; }
        }
        /* Exit = the entrance in reverse: settle → slight anticipation → scatter out. */
        @keyframes lh-out-1-down {
          0% { opacity: 1; filter: blur(0); transform: translate(0, 0) scale(1) rotate(0deg); }
          35% { opacity: 1; filter: blur(0); transform: translate(1px, -3px) scale(1.05) rotate(1deg); }
          100% { opacity: 0; filter: blur(10px); transform: translate(-6px, 22px) scale(0.84) rotate(-3deg); }
        }
        @keyframes lh-out-2-down {
          0% { opacity: 1; filter: blur(0); transform: translate(0, 0) scale(1) rotate(0deg); }
          35% { opacity: 1; filter: blur(0); transform: translate(-1px, -3px) scale(1.06) rotate(-1deg); }
          100% { opacity: 0; filter: blur(12px); transform: translate(7px, 24px) scale(0.8) rotate(4deg); }
        }
        @keyframes lh-out-3-down {
          0% { opacity: 1; filter: blur(0); transform: translateY(0) scale(1); }
          35% { opacity: 1; filter: blur(0); transform: translateY(-4px) scale(1.05); }
          100% { opacity: 0; filter: blur(9px); transform: translateY(26px) scale(0.9); }
        }
        @keyframes lh-out-1-up {
          0% { opacity: 1; filter: blur(0); transform: translate(0, 0) scale(1) rotate(0deg); }
          35% { opacity: 1; filter: blur(0); transform: translate(1px, 3px) scale(1.05) rotate(1deg); }
          100% { opacity: 0; filter: blur(10px); transform: translate(-6px, -20px) scale(1.08) rotate(-3deg); }
        }
        @keyframes lh-out-2-up {
          0% { opacity: 1; filter: blur(0); transform: translate(0, 0) scale(1) rotate(0deg); }
          35% { opacity: 1; filter: blur(0); transform: translate(-1px, 3px) scale(1.06) rotate(-1deg); }
          100% { opacity: 0; filter: blur(12px); transform: translate(7px, -22px) scale(1.06) rotate(4deg); }
        }
        @keyframes lh-out-3-up {
          0% { opacity: 1; filter: blur(0); transform: translateY(0) scale(1); }
          35% { opacity: 1; filter: blur(0); transform: translateY(4px) scale(1.05); }
          100% { opacity: 0; filter: blur(9px); transform: translateY(-24px) scale(1.05); }
        }
        /* fill-mode: both pins the 100% keyframe at rest. That state MUST end on
           BOTH filter: none AND transform: none. A persistent filter OR a
           persistent transform — even an identity one like translate(0,0)
           scale(1) — promotes the inline-block word to a composited layer whose
           backing store WebKit/iOS clips to the line-height box, cutting
           Fraunces' deep descenders (g/y/j). #467 zeroed the filter but left the
           identity transform, so the clip survived. Rest state carries neither;
           the blur + move live only mid-flight. */
        .lh-word {
          animation-fill-mode: both;
          animation-duration: var(--lh-dur, ${LH_POP_MS}ms);
        }
        .lh-pop-1, .lh-pop-2, .lh-pop-3 { animation-timing-function: ease-out; }
        .lh-out-1-down, .lh-out-2-down, .lh-out-3-down,
        .lh-out-1-up, .lh-out-2-up, .lh-out-3-up { animation-timing-function: ease-in; }
        .lh-pop-1 { animation-name: lh-pop-1; }
        .lh-pop-2 { animation-name: lh-pop-2; }
        .lh-pop-3 { animation-name: lh-pop-3; }
        .lh-out-1-down { animation-name: lh-out-1-down; }
        .lh-out-2-down { animation-name: lh-out-2-down; }
        .lh-out-3-down { animation-name: lh-out-3-down; }
        .lh-out-1-up { animation-name: lh-out-1-up; }
        .lh-out-2-up { animation-name: lh-out-2-up; }
        .lh-out-3-up { animation-name: lh-out-3-up; }
        @media (prefers-reduced-motion: reduce) {
          .lh-word {
            animation: none !important;
            opacity: 1 !important;
            filter: none !important;
            transform: none !important;
          }
        }
      `}</style>
      {mounted && (
        // Key on text so a new headline always remounts → replays the entrance.
        <Tag key={text} className={className}>
          {tokens.map((w, i) => {
            if (w.trim() === "") return <span key={i}>{w}</span>;
            wi += 1;
            // Settled + not leaving → a plain inline-block word, NO animation
            // class → no compositing layer → descenders never clipped.
            if (settled && !exiting) {
              return (
                <span key={i} className="inline-block" style={WORD_BOX}>
                  {w}
                </span>
              );
            }
            const variant = (wi % 3) + 1;
            const cls = exiting ? `lh-out-${variant}-${dissolveDir}` : `lh-pop-${variant}`;
            const dur = exiting ? resolvedExitMs : popMs;
            const delay = exiting ? exitDelays[wi] : enterDelays[wi];
            return (
              <span
                key={i}
                className={`lh-word ${cls} inline-block`}
                style={
                  {
                    ...WORD_BOX,
                    "--lh-dur": `${dur}ms`,
                    animationDelay: `${delay ?? 0}ms`,
                  } as CSSProperties
                }
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
