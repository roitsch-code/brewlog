"use client";

import { useMemo } from "react";
import { fieldBlobColors } from "@/lib/field/composeGradient";
import type { FieldZones } from "@/lib/field/types";

// Per-blob autonomous drift: keyframe name + duration + negative start-delay
// (begin mid-phase so the four never sit at 0% together on first paint).
// Co-prime-ish durations → the composite never visibly re-syncs. Keyframes
// live in globals.css and translate in vmax (the drift layer is 0-size, so a
// % translate would resolve against 0).
const DRIFT = [
  { name: "blob-drift-1", dur: "23s", delay: "-8s" },
  { name: "blob-drift-2", dur: "31s", delay: "-19s" },
  { name: "blob-drift-3", dur: "29s", delay: "-3s" },
  { name: "blob-drift-4", dur: "37s", delay: "-25s" },
];

// Two of the four pick up scroll-momentum parallax (§D) for a sense of depth.
const PARALLAX = [false, true, true, false];

/**
 * The drifting colour blobs of the living Field. Each blob is three nested
 * layers so the ONLY continuously-animating element (the drift layer) carries
 * a transform-only keyframe with NO filter — it stays on the GPU compositor —
 * while the blurred colour disc underneath is painted once and merely moved:
 *
 *   anchor + interaction   absolute at cx/cy %, transform from --field-* vars
 *                          (recomputes only on scroll/touch/tap)
 *   drift                  slow transform keyframe (continuous; data-field-blob)
 *   visual                 the blurred radial-gradient disc, centred, STATIC
 *
 * Bold-tier hook (deferred): an feDisplacementMap "quicksilver lens" would
 * wrap the visual layer here. Out of this slice (GPU + taste risk).
 */
export default function FieldBlobs({ fieldZones }: { fieldZones: FieldZones }) {
  const blobs = useMemo(() => fieldBlobColors(fieldZones), [fieldZones]);

  return (
    <>
      {blobs.map((b, i) => {
        const drift = DRIFT[i % DRIFT.length];
        const y = PARALLAX[i]
          ? "calc(var(--field-drift-y, 0px) + var(--field-scroll, 0px))"
          : "var(--field-drift-y, 0px)";
        return (
          <div
            key={i}
            aria-hidden
            className="absolute"
            style={{
              left: `${b.cx}%`,
              top: `${b.cy}%`,
              transform: `translate(var(--field-drift-x, 0px), ${y}) rotate(var(--field-tilt, 0deg)) scale(calc(1 + var(--field-pulse, 0) * 0.03))`,
            }}
          >
            <div
              data-field-blob
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                willChange: "transform",
                animationName: drift.name,
                animationDuration: drift.dur,
                animationDelay: drift.delay,
                animationTimingFunction: "ease-in-out",
                animationIterationCount: "infinite",
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
                  filter: "blur(36px)",
                }}
              />
            </div>
          </div>
        );
      })}
    </>
  );
}
