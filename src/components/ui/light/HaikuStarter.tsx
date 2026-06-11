"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePresence } from "@/hooks/usePresence";

const EXIT_MS = 280;
const STAGGER_MS = 52;
const POP_MS = 680;
const DISTURB_MAX_BLUR = 7; // px — finger-over-haiku smudge
const DISTURB_FALLOFF = 120; // px — distance over which the blur fades to 0

const P_CLASS =
  "font-fraunces text-[40px] font-semibold leading-[1.05] tracking-[-0.01em] text-light-foreground";

// Deterministic scatter: a delay (ms) per word so they pop in a shuffled,
// non-left-to-right order — spontaneous, not a typewriter. Same text → same
// scatter (an LCG-shuffled permutation), so it's stable across re-renders.
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
    delay[origIdx] = pos * STAGGER_MS;
  });
  return delay;
}

function HaikuSkeleton() {
  const widths = ["72%", "90%", "54%"];
  return (
    <div aria-hidden className="w-full space-y-3.5">
      {widths.map((w, i) => (
        <div key={i} className="haiku-shimmer h-7 rounded-full" style={{ width: w }} />
      ))}
    </div>
  );
}

/**
 * Home welcome-haiku (fluidity pass §E). Shimmer while it loads → a LIQUID
 * per-word entrance (each word springs in from a different direction, with an
 * overshoot, in a scattered order — not a left-to-right typewriter) → a soft
 * dissolve when the user starts composing. Once settled, dragging a finger over
 * the line blurs it (the same soft blur it arrives with). One inline-block
 * structure throughout so the line never re-wraps. Motion gated by
 * prefers-reduced-motion (the .haiku-word rule in globals.css).
 */
export default function HaikuStarter({ text, show }: { text: string; show: boolean }) {
  const { mounted, state } = usePresence(show, EXIT_MS);
  const loading = text.trim() === "";
  const tokens = useMemo(() => text.split(/(\s+)/), [text]);
  const wordCount = useMemo(() => tokens.filter((t) => t.trim() !== "").length, [tokens]);
  const delays = useMemo(() => scatterDelays(wordCount), [wordCount]);
  const settleDoneMs = wordCount * STAGGER_MS + POP_MS;
  const exiting = state === "exit";

  const pRef = useRef<HTMLParagraphElement | null>(null);

  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (loading || exiting) {
      setReady(false);
      return;
    }
    const t = setTimeout(() => setReady(true), settleDoneMs);
    return () => clearTimeout(t);
  }, [loading, exiting, settleDoneMs]);

  // Finger-over-haiku smudge: blur the line by proximity to the pointer, on its
  // own rAF (direct filter, no React re-render). Only once the entrance is done
  // — during it the words own their filter, during the exit the dissolve does.
  useEffect(() => {
    const p = pRef.current;
    if (!p || !ready || exiting) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let target = 0;
    let cur = 0;
    let raf = 0;
    let running = false;
    const frame = () => {
      cur += (target - cur) * 0.2;
      p.style.filter = cur > 0.05 ? `blur(${cur.toFixed(2)}px)` : "";
      if (Math.abs(target - cur) < 0.04) {
        running = false;
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    const kick = () => {
      if (!running) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    };
    const onMove = (e: PointerEvent) => {
      const r = p.getBoundingClientRect();
      const dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right);
      const dy = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom);
      const d = Math.hypot(dx, dy);
      target = DISTURB_MAX_BLUR * Math.max(0, 1 - d / DISTURB_FALLOFF);
      kick();
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
      p.style.filter = "";
    };
  }, [ready, exiting]);

  if (!mounted) return null;

  let wi = -1;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center px-5">
      <style jsx global>{`
        @keyframes haiku-pop-1 {
          0% { opacity: 0; filter: blur(10px); transform: translate(-7px, 12px) scale(0.84) rotate(-3deg); }
          60% { opacity: 1; filter: blur(0); transform: translate(0, -2px) scale(1.07) rotate(1deg); }
          100% { opacity: 1; filter: blur(0); transform: translate(0, 0) scale(1) rotate(0deg); }
        }
        @keyframes haiku-pop-2 {
          0% { opacity: 0; filter: blur(12px); transform: translate(9px, -10px) scale(0.8) rotate(4deg); }
          58% { opacity: 1; filter: blur(0); transform: translate(-1px, 1px) scale(1.08) rotate(-1deg); }
          100% { opacity: 1; filter: blur(0); transform: translate(0, 0) scale(1) rotate(0deg); }
        }
        @keyframes haiku-pop-3 {
          0% { opacity: 0; filter: blur(9px); transform: translateY(16px) scale(0.9); }
          62% { opacity: 1; filter: blur(0); transform: translateY(-3px) scale(1.05); }
          100% { opacity: 1; filter: blur(0); transform: translateY(0) scale(1); }
        }
      `}</style>
      {loading ? (
        <HaikuSkeleton />
      ) : (
        <p
          ref={pRef}
          className={exiting ? `${P_CLASS} haiku-exit` : P_CLASS}
          style={
            exiting ? { animation: `haiku-dissolve ${EXIT_MS}ms ease-in forwards` } : undefined
          }
        >
          {tokens.map((w, i) => {
            if (w.trim() === "") return <span key={i}>{w}</span>;
            wi += 1;
            const variant = (wi % 3) + 1;
            return (
              <span
                key={i}
                className="haiku-word inline-block"
                style={{
                  animation: `haiku-pop-${variant} ${POP_MS}ms ease-out both`,
                  animationDelay: `${delays[wi] ?? 0}ms`,
                }}
              >
                {w}
              </span>
            );
          })}
        </p>
      )}
    </div>
  );
}
