"use client";

import { useEffect, useState } from "react";
import { buildCraftingPhases } from "@/lib/craftingPhases";

/**
 * Recipe-crafting status line — replaces the old static uppercase-grey
 * "CRAFTING YOUR RECIPE…" eyebrow. Black, sentence-case, in the card-title
 * style (Chivo 15/500 anthracite — see CardTitle in Card.tsx), with an animated
 * 1-2-3 ellipsis and a cycling phase that walks the REAL factors going into the
 * recipe for this bean (passed in via `phases` — see buildCraftingPhases).
 *
 * The recipe is a single /recommend Opus call with no streamed sub-steps, so
 * the walk is paced (not live progress): it advances through the factors and
 * HOLDS on the last ("Adapting it to your beans") so a long wait doesn't loop.
 * PHASE_MS is sized so the walk spans the real ~minute rather than racing.
 *
 * Keyframes co-located (styled-jsx) per the PWA-cache rule; reduced motion
 * freezes the dots and swaps phases instantly.
 */

const DEFAULT_PHASES = buildCraftingPhases();
const PHASE_MS = 4800;

export default function CraftingStatus({
  phases = DEFAULT_PHASES,
  className,
}: {
  phases?: string[];
  className?: string;
}) {
  const [i, setI] = useState(0);
  const last = Math.max(phases.length - 1, 0);

  useEffect(() => {
    if (i >= last) return; // hold on the final factor
    const t = setTimeout(() => setI((n) => Math.min(n + 1, last)), PHASE_MS);
    return () => clearTimeout(t);
  }, [i, last]);

  return (
    <p
      aria-live="polite"
      className={`font-chivo text-[15px] font-medium leading-tight text-light-foreground ${className ?? ""}`}
    >
      <span key={i} className="craft-phrase">
        {phases[i] ?? ""}
      </span>
      <span className="craft-dots" aria-hidden>
        <span>.</span>
        <span>.</span>
        <span>.</span>
      </span>
      <style jsx>{`
        .craft-phrase {
          display: inline-block;
          animation: craft-fade 420ms ease-out;
        }
        @keyframes craft-fade {
          from {
            opacity: 0.2;
          }
          to {
            opacity: 1;
          }
        }
        .craft-dots span {
          opacity: 0;
        }
        .craft-dots span:nth-child(1) {
          animation: craft-d1 1.6s infinite;
        }
        .craft-dots span:nth-child(2) {
          animation: craft-d2 1.6s infinite;
        }
        .craft-dots span:nth-child(3) {
          animation: craft-d3 1.6s infinite;
        }
        @keyframes craft-d1 {
          0% { opacity: 0; }
          8%, 92% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes craft-d2 {
          0%, 30% { opacity: 0; }
          38%, 92% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes craft-d3 {
          0%, 54% { opacity: 0; }
          62%, 92% { opacity: 1; }
          100% { opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .craft-phrase {
            animation: none;
          }
          .craft-dots span {
            opacity: 1;
            animation: none;
          }
        }
      `}</style>
    </p>
  );
}
