"use client";

import { useMemo } from "react";
import { fieldBlobColors } from "@/lib/field/composeGradient";
import type { FieldZones } from "@/lib/field/types";

// Round-2 rework — "murmuration". The old version drifted four discs on
// independent co-prime timers, which read as scattered blobs ("too crazy
// bunt"). Now ALL masses ride one SHARED slow sweep (`field-flow`) so they move
// together like a flock and the whole colour field slowly turns direction
// (diagonal → vertical → other diagonal). Each mass adds only a small slow
// individual drift (`murmur-*`) for gentle internal life — the dominant motion
// stays coherent.
//
// VISIBILITY: the masses are large + soft, so the travel has to be generous or
// the motion is mathematically present but optically frozen (the first cut used
// ±8vmax / 120 s and looked dead). Amplitudes below are tuned so the coordinated
// flow actually reads while staying graceful. The base gradient underneath is
// opaque + full-bleed, so even big blob travel never reveals an edge.
//
// Dials: `field-flow` amplitude/period (the shared sweep), `MURMUR` amplitude/
// period (per-mass life), disc size/blur. Keyframes are co-located HERE
// (styled-jsx global), never globals.css — an installed PWA serves a stale
// cached globals.css and the motion would silently die (see docs/liquid-design.md).
// data-field-blob marks the animated nodes so the reduced-motion block freezes them.

// Per-mass drifts: varied periods so the flock shimmers without breaking the
// shared sweep's coherence.
const MURMUR = [
  "murmur-1 27s ease-in-out -5s infinite",
  "murmur-2 33s ease-in-out -14s infinite",
  "murmur-3 30s ease-in-out -3s infinite",
  "murmur-4 37s ease-in-out -21s infinite",
];

export default function FieldBlobs({ fieldZones }: { fieldZones: FieldZones }) {
  const blobs = useMemo(() => fieldBlobColors(fieldZones), [fieldZones]);

  return (
    <>
      <style jsx global>{`
        /* The shared murmuration sweep — slow, coordinated, turns direction.
           Generous translate + rotate so the big soft masses visibly flow. */
        @keyframes field-flow {
          0% { transform: translate3d(-18vmax, 11vmax, 0) rotate(-12deg) scale(1.04); }
          25% { transform: translate3d(14vmax, -9vmax, 0) rotate(7deg) scale(1.14); }
          50% { transform: translate3d(19vmax, 15vmax, 0) rotate(13deg) scale(1.06); }
          75% { transform: translate3d(-11vmax, -13vmax, 0) rotate(-6deg) scale(1.15); }
          100% { transform: translate3d(-18vmax, 11vmax, 0) rotate(-12deg) scale(1.04); }
        }
        /* Per-mass internal life — smaller than the sweep so the flock coheres. */
        @keyframes murmur-1 {
          0% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(13vmax, -11vmax, 0) scale(1.1); }
          100% { transform: translate3d(0, 0, 0) scale(1); }
        }
        @keyframes murmur-2 {
          0% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(-14vmax, 12vmax, 0) scale(0.9); }
          100% { transform: translate3d(0, 0, 0) scale(1); }
        }
        @keyframes murmur-3 {
          0% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(12vmax, 13vmax, 0) scale(1.09); }
          100% { transform: translate3d(0, 0, 0) scale(1); }
        }
        @keyframes murmur-4 {
          0% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(-13vmax, -12vmax, 0) scale(0.91); }
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
            animation: "field-flow 70s ease-in-out infinite",
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
                  width: "96vmax",
                  height: "96vmax",
                  transform: "translate(-50%, -50%)",
                  borderRadius: "50%",
                  background: `radial-gradient(circle, ${b.color} 0%, transparent 66%)`,
                  filter: "blur(50px)",
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
