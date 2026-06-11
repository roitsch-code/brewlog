"use client";

import { useEffect, useMemo, useState } from "react";
import { usePresence } from "@/hooks/usePresence";

const EXIT_MS = 280;
const WORD_STAGGER_MS = 70;
const SETTLE_MS = 600;
// Kill-switch for the warm liquid sheen that sweeps the settled haiku. The
// most taste-sensitive piece — flip to false to ship entrance + dissolve only.
const SHEEN = true;

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
 * Home welcome-haiku with a full liquid lifecycle (fluidity pass §E):
 * shimmer while it loads → a per-word blur-into-focus entrance → an optional
 * warm sheen once settled → a soft dissolve (not a hard cut) when the user
 * starts typing. usePresence keeps the node mounted through the exit so the
 * dissolve can play. All motion gated by prefers-reduced-motion in globals.css.
 *
 * Rendered as an absolute, pointer-events-none overlay so it can dissolve over
 * the ChatThread that mounts underneath when the user starts composing.
 */
export default function HaikuStarter({ text, show }: { text: string; show: boolean }) {
  const { mounted, state } = usePresence(show, EXIT_MS);
  const loading = text.trim() === "";
  const words = useMemo(() => text.split(/(\s+)/), [text]);
  const settleDoneMs = words.length * WORD_STAGGER_MS + SETTLE_MS;

  // Swap the staggered word-spans for a plain line once the entrance is done
  // (identical text + position → seamless). The plain line is where the sheen
  // lives; running it during the per-word entrance would fight the blur-in.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (loading) {
      setSettled(false);
      return;
    }
    const t = setTimeout(() => setSettled(true), settleDoneMs);
    return () => clearTimeout(t);
  }, [loading, settleDoneMs]);

  if (!mounted) return null;

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center px-5">
      {loading ? (
        <HaikuSkeleton />
      ) : state === "exit" ? (
        <p
          className={`${P_CLASS} haiku-exit`}
          style={{ animation: `haiku-dissolve ${EXIT_MS}ms ease-in forwards` }}
        >
          {text}
        </p>
      ) : settled ? (
        <p className={SHEEN ? `${P_CLASS} haiku-sheen` : P_CLASS}>{text}</p>
      ) : (
        <p className={P_CLASS}>
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
