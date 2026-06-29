"use client";

import { useMemo } from "react";
import { fieldBlobColors } from "@/lib/field/composeGradient";
import type { FieldZones } from "@/lib/field/types";

// Round-2 rework — "murmuration". The old version drifted four discs on
// independent co-prime timers, which read as scattered blobs ("too crazy
// bunt"). Now ALL masses ride one SHARED slow sweep (`field-flow`) so they move
// together like a flock and the whole colour field slowly turns direction
// (diagonal → vertical → other diagonal) over a long cycle. Each mass adds only
// a small, slow individual drift (`murmur-*`) for gentle internal life — the
// dominant motion stays coherent. Bigger + softer discs than before so they
// dissolve into one continuous directional gradient, not dots.
//
// Keyframes are co-located HERE (styled-jsx global), never globals.css — an
// installed PWA serves a stale cached globals.css and the motion would silently
// die (see docs/liquid-design.md). data-field-blob marks the animated nodes so
// the reduced-motion block in globals.css can freeze them.

// Small per-mass drifts: long, low-amplitude, varied so the flock shimmers
// without breaking the shared sweep's coherence.
const MURMUR = [
  "murmur-1 41s ease-in-out -7s infinite",
  "murmur-2 47s ease-in-out -19s infinite",
  "murmur-3 43s ease-in-out -3s infinite",
  "murmur-4 53s ease-in-out -28s infinite",
];

export default function FieldBlobs({ fieldZones }: { fieldZones: FieldZones }) {
  const blobs = useMemo(() => fieldBlobColors(fieldZones), [fieldZones]);

  return (
    <>
      <style jsx global>{`
        /* The shared murmuration sweep — slow, coordinated, turns direction. */
        @keyframes field-flow {
          0% { transform: translate3d(-8vmax, 5vmax, 0) rotate(-9deg) scale(1.05); }
          25% { transform: translate3d(6vmax, -4vmax, 0) rotate(5deg) scale(1.12); }
          50% { transform: translate3d(9vmax, 7vmax, 0) rotate(10deg) scale(1.06); }
          75% { transform: translate3d(-5vmax, -6vmax, 0) rotate(-4deg) scale(1.13); }
          100% { transform: translate3d(-8vmax, 5vmax, 0) rotate(-9deg) scale(1.05); }
        }
        /* Per-mass internal life — small amplitude so the flock stays coherent. */
        @keyframes murmur-1 {
          0% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(7vmax, -6vmax, 0) scale(1.08); }
          100% { transform: translate3d(0, 0, 0) scale(1); }
        }
        @keyframes murmur-2 {
          0% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(-8vmax, 6vmax, 0) scale(0.93); }
          100% { transform: translate3d(0, 0, 0) scale(1); }
        }
        @keyframes murmur-3 {
          0% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(6vmax, 7vmax, 0) scale(1.07); }
          100% { transform: translate3d(0, 0, 0) scale(1); }
        }
        @keyframes murmur-4 {
          0% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(-7vmax, -7vmax, 0) scale(0.94); }
          100% { transform: translate3d(0, 0, 0) scale(1); }
        }
      `}</style>
      {/* Lean wrapper — follows the finger via the --field-* vars (whole field
          leans together, which reinforces the coordinated feel). */}
      <div
        className="absolute inset-0"
        style={{
          transform:
            "translate(var(--field-drift-x, 0px), var(--field-drift-y, 0px)) rotate(var(--field-tilt, 0deg)) scale(calc(1 + var(--field-pulse, 0) * 0.05))",
        }}
      >
        {/* Shared sweep — carries every mass together (the murmuration). */}
        <div
          data-field-blob
          className="absolute inset-0"
          style={{
            transformOrigin: "50% 50%",
            willChange: "transform",
            animation: "field-flow 120s ease-in-out infinite",
          }}
        >
          {blobs.map((b, i) => (
            <div
              key={i}
              data-field-blob
              aria-hidden
              className="absolute"
              style={{
                left: `${b.cx}%`,
                top: `${b.cy}%`,
                willChange: "transform",
                animation: MURMUR[i % MURMUR.length],
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: "104vmax",
                  height: "104vmax",
                  transform: "translate(-50%, -50%)",
                  borderRadius: "50%",
                  background: `radial-gradient(circle, ${b.color} 0%, transparent 64%)`,
                  filter: "blur(56px)",
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
