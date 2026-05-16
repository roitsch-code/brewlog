"use client";

import { useContext, useMemo } from "react";
import { FieldContext } from "@/lib/field/FieldContext";
import { composeFieldGradient } from "@/lib/field/composeGradient";

/**
 * Generative Field v1.1 — the renderer.
 *
 * Reads the current FieldConfig from context and paints the
 * application-wide warm gradient. The sandwich structure is preserved
 * from v1.0 §2.1 — a `fixed inset-0 -z-10` outer wrapper, an absolute
 * inner div with `inset-[-10%]` so the 60px blur halo lands outside
 * the visible viewport, the same `blur(60px) scale(1.18)` post-
 * processing.
 *
 * Only the `background` style swaps from the static `.bg-brew-field`
 * utility to the coffee-driven gradient string. Output is identical
 * for the Default coffee composition, so views that don't set a
 * specific config render exactly what v1.0 already shipped.
 *
 * Memoised on the FieldConfig — composeFieldGradient is a pure function
 * with no side effects, and the gradient string is the only place
 * React would otherwise recompute it on every parent render.
 */
export default function Field() {
  const { fieldZones, rotation } = useContext(FieldContext);
  const gradient = useMemo(
    () => composeFieldGradient(fieldZones, rotation),
    [fieldZones, rotation],
  );

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-[-10%]"
        style={{
          background: gradient,
          filter: "blur(60px)",
          transform: "scale(1.18)",
          transformOrigin: "center",
        }}
      />
    </div>
  );
}
