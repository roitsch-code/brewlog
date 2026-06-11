"use client";

import { useMemo } from "react";
import { fieldBlobColors } from "@/lib/field/composeGradient";
import type { FieldZones } from "@/lib/field/types";

// Co-prime-ish durations + negative start-delays so the four drifts never sit
// at 0% together and the composite doesn't visibly re-sync.
const DRIFT = [
  "blobflow-1 15s ease-in-out -4s infinite",
  "blobflow-2 19s ease-in-out -11s infinite",
  "blobflow-3 17s ease-in-out -2s infinite",
  "blobflow-4 23s ease-in-out -15s infinite",
];

/**
 * The drifting colour blobs of the living Field. The keyframes are co-located
 * HERE (styled-jsx global) — the same path as the haiku entrance, which renders
 * reliably — instead of globals.css, so an installed PWA can never animate the
 * blobs against a stale cached stylesheet (the cause of "haiku moves, blobs
 * dead"). Three nested layers: the outer leans from the --field-* vars, the
 * middle runs the transform-only drift keyframe (GPU compositor, no filter), the
 * inner is the blurred colour disc — painted once and merely moved. Travel is
 * big and the discs are smallish so the flow is unmistakable on the pale field.
 */
export default function FieldBlobs({ fieldZones }: { fieldZones: FieldZones }) {
  const blobs = useMemo(() => fieldBlobColors(fieldZones), [fieldZones]);

  return (
    <>
      <style jsx global>{`
        @keyframes blobflow-1 {
          0% { transform: translate3d(0, 0, 0) scale(1); }
          33% { transform: translate3d(18vmax, -14vmax, 0) scale(1.18); }
          66% { transform: translate3d(-14vmax, 16vmax, 0) scale(0.86); }
          100% { transform: translate3d(0, 0, 0) scale(1); }
        }
        @keyframes blobflow-2 {
          0% { transform: translate3d(0, 0, 0) rotate(0deg) scale(1); }
          50% { transform: translate3d(-20vmax, -12vmax, 0) rotate(12deg) scale(1.14); }
          100% { transform: translate3d(0, 0, 0) rotate(0deg) scale(1); }
        }
        @keyframes blobflow-3 {
          0% { transform: translate3d(0, 0, 0) scale(1); }
          40% { transform: translate3d(13vmax, 19vmax, 0) scale(1.12); }
          75% { transform: translate3d(-16vmax, -12vmax, 0) scale(0.88); }
          100% { transform: translate3d(0, 0, 0) scale(1); }
        }
        @keyframes blobflow-4 {
          0% { transform: translate3d(0, 0, 0) rotate(0deg) scale(1); }
          50% { transform: translate3d(17vmax, 15vmax, 0) rotate(-10deg) scale(1.2); }
          100% { transform: translate3d(0, 0, 0) rotate(0deg) scale(1); }
        }
      `}</style>
      {blobs.map((b, i) => (
        <div
          key={i}
          aria-hidden
          className="absolute"
          style={{
            left: `${b.cx}%`,
            top: `${b.cy}%`,
            transform:
              "translate(var(--field-drift-x, 0px), var(--field-drift-y, 0px)) rotate(var(--field-tilt, 0deg)) scale(calc(1 + var(--field-pulse, 0) * 0.05))",
          }}
        >
          <div
            data-field-blob
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              willChange: "transform",
              animation: DRIFT[i % DRIFT.length],
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: "48vmax",
                height: "48vmax",
                transform: "translate(-50%, -50%)",
                borderRadius: "50%",
                background: `radial-gradient(circle, ${b.color} 0%, transparent 68%)`,
                filter: "blur(30px)",
              }}
            />
          </div>
        </div>
      ))}
    </>
  );
}
