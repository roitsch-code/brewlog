"use client";

import { useContext, useMemo } from "react";
import { FieldContext } from "@/lib/field/FieldContext";
import { composeFieldGradient } from "@/lib/field/composeGradient";
import { useFieldMotion } from "@/hooks/useFieldMotion";
import FieldBlobs from "./FieldBlobs";
import FieldGrain from "./FieldGrain";

/**
 * Generative Field v1.1 + living motion (fluidity pass).
 *
 * Three stacked layers inside the fixed sandwich:
 *   1. base   — the original composed per-coffee gradient (static, blurred);
 *               unchanged in spirit, so it's the steady floor the blobs ride.
 *   2. blobs  — the same coffee zones lifted out as four slowly-drifting radial
 *               blobs; flow comes from them moving over the static base.
 *   3. grain  — static film grain, soft-light, for tooth.
 *
 * `useFieldMotion` writes --field-* CSS vars on the wrapper; the blob layers
 * read them, so pointer / scroll / tap nudge the Field with ZERO React
 * re-render. `isolation: isolate` keeps the grain's blend mode contained to
 * the Field so it never tints the page content above it.
 *
 * Bold-tier hook (deferred): an feDisplacementMap "quicksilver lens" over the
 * blobs/base would slot here — animated feTurbulence → displacement filter on
 * the inner layers. Out of this slice (GPU + taste risk).
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
      {/* 1 — static per-coffee base */}
      <div
        className="absolute inset-[-10%]"
        style={{
          background: gradient,
          filter: "blur(60px)",
          transform: "scale(1.18)",
          transformOrigin: "center",
        }}
      />
      {/* 2 — drifting colour blobs (the living layer) */}
      <FieldBlobs fieldZones={fieldZones} />
      {/* 3 — film grain */}
      <FieldGrain />
    </div>
  );
}
