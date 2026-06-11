"use client";

import { useContext, useMemo } from "react";
import { FieldContext } from "@/lib/field/FieldContext";
import { composeFieldGradient } from "@/lib/field/composeGradient";
import { useFieldMotion } from "@/hooks/useFieldMotion";
import FieldBlobs from "./FieldBlobs";
import FieldGrain from "./FieldGrain";
import FieldBloom from "./FieldBloom";

/**
 * Generative Field v1.1 + living motion (fluidity pass).
 *
 *   scroll layer  — the whole colour field translates with scroll (--field-shift-y)
 *     1. base   — the static per-coffee gradient (blurred floor)
 *     2. blobs  — coffee zones lifted out as drifting radial blobs (the flow)
 *     3. grain  — static film grain, soft-light
 *   bloom         — a warm glow that follows the finger (--ptr-*), in viewport
 *                   coords so it doesn't scroll-shift
 *
 * `useFieldMotion` writes the --field-* / --ptr-* vars; the layers read them, so
 * pointer / scroll / tap nudge the Field with ZERO React re-render. `isolation`
 * keeps the bloom/grain blends contained to the Field.
 */
export default function Field() {
  const { fieldZones, rotation } = useContext(FieldContext);
  const gradient = useMemo(
    () => composeFieldGradient(fieldZones, rotation),
    [fieldZones, rotation],
  );
  const motionRef = useFieldMotion<HTMLDivElement>();

  return (
    <div
      ref={motionRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ isolation: "isolate" }}
    >
      {/* Scroll-parallax layer — the field is oversized, so it has room to move
          without revealing an edge. */}
      <div
        className="absolute inset-0"
        style={{
          transform: "translate3d(0, var(--field-shift-y, 0px), 0)",
          willChange: "transform",
        }}
      >
        {/* 1 — static per-coffee base */}
        <div
          className="absolute inset-[-12%]"
          style={{
            background: gradient,
            filter: "blur(60px)",
            transform: "scale(1.2)",
            transformOrigin: "center",
          }}
        />
        {/* 2 — drifting colour blobs (the living layer) */}
        <FieldBlobs fieldZones={fieldZones} />
        {/* 3 — film grain */}
        <FieldGrain />
      </div>
      {/* 4 — warm bloom that follows the finger */}
      <FieldBloom />
    </div>
  );
}
