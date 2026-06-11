"use client";

import { useMemo } from "react";
import { fieldBlobColors } from "@/lib/field/composeGradient";
import type { FieldZones } from "@/lib/field/types";

// Per-blob autonomous drift (name + duration + negative start-delay so the four
// never sit at 0% together). Co-prime-ish durations → the composite never
// visibly re-syncs. Shorthand `animation` (the form the haiku entrance uses and
// that renders reliably). Keyframes in globals.css, in vmax (the drift layer is
// 0-size, so a % translate would resolve against 0).
const DRIFT = [
  "blob-drift-1 16s ease-in-out -6s infinite",
  "blob-drift-2 21s ease-in-out -13s infinite",
  "blob-drift-3 18s ease-in-out -3s infinite",
  "blob-drift-4 24s ease-in-out -17s infinite",
];

/**
 * The drifting colour blobs of the living Field. Three nested layers so the
 * only continuously-animating element (the drift layer) carries a transform-
 * only keyframe with NO filter — it stays on the GPU compositor — while the
 * blurred colour disc underneath is painted once and merely moved. The outer
 * layer leans/scales from the --field-* interaction vars.
 */
export default function FieldBlobs({ fieldZones }: { fieldZones: FieldZones }) {
  const blobs = useMemo(() => fieldBlobColors(fieldZones), [fieldZones]);

  return (
    <>
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
                width: "62vmax",
                height: "62vmax",
                transform: "translate(-50%, -50%)",
                borderRadius: "50%",
                background: `radial-gradient(circle, ${b.color} 0%, transparent 70%)`,
                filter: "blur(40px)",
              }}
            />
          </div>
        </div>
      ))}
    </>
  );
}
