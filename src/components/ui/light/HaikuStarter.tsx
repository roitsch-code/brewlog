"use client";

import { useMemo } from "react";
import { usePresence } from "@/hooks/usePresence";

const EXIT_MS = 280;
const WORD_STAGGER_MS = 70;
const SETTLE_MS = 600;

const P_CLASS =
  "font-fraunces text-[40px] font-semibold leading-[1.05] tracking-[-0.01em] text-light-foreground";

function HaikuSkeleton() {
  // Three stacked bars with a slow sheen so the slot breathes while
  // /api/greeting resolves, instead of sitting blank.
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
 * Home welcome-haiku with a liquid lifecycle (fluidity pass §E): shimmer while
 * it loads → a per-word blur-into-focus entrance → a soft dissolve (not a hard
 * cut) when the user starts composing. usePresence keeps the node mounted
 * through the exit so the dissolve can play. Motion gated by
 * prefers-reduced-motion in globals.css.
 *
 * The words render as inline-block spans for the WHOLE life of the haiku —
 * entrance AND settled — never swapping to a single text node. That swap used
 * to re-wrap the line the instant the entrance finished: it let "stone-fruit"
 * break at the hyphen and yanked the whole poem up a line (the jump Markus
 * caught). One structure → the line is laid out once and never reflows, and a
 * whole word (inline-block) can't break internally.
 *
 * Rendered as an absolute, pointer-events-none overlay so it can dissolve over
 * the ChatThread that mounts underneath when the user starts composing.
 */
export default function HaikuStarter({ text, show }: { text: string; show: boolean }) {
  const { mounted, state } = usePresence(show, EXIT_MS);
  const loading = text.trim() === "";
  const words = useMemo(() => text.split(/(\s+)/), [text]);

  if (!mounted) return null;

  const exiting = state === "exit";

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center px-5">
      {loading ? (
        <HaikuSkeleton />
      ) : (
        // The exit dissolve animates the whole <p>; the word spans inside hold
        // their settled state and ride along — no structure change, no reflow.
        <p
          className={exiting ? `${P_CLASS} haiku-exit` : P_CLASS}
          style={
            exiting ? { animation: `haiku-dissolve ${EXIT_MS}ms ease-in forwards` } : undefined
          }
        >
          {words.map((w, i) =>
            w.trim() === "" ? (
              <span key={i}>{w}</span>
            ) : (
              <span
                key={i}
                className="haiku-word inline-block"
                style={{
                  animation: `haiku-settle ${SETTLE_MS}ms ease-out both`,
                  animationDelay: `${i * WORD_STAGGER_MS}ms`,
                }}
              >
                {w}
              </span>
            ),
          )}
        </p>
      )}
    </div>
  );
}
