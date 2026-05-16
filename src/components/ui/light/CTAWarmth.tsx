"use client";

/**
 * Light System v1.0 §2.2 — local warmth gradient behind the CTA.
 *
 * Additive to the Field (§2.1), not a replacement. Sits in an absolute
 * sibling inside the CTA wrapper, bleeds 20% past the viewport edges so
 * the warmth feels environmental. Rendered via inline style: Tailwind
 * does not scan src/lib for arbitrary class values, and the gradient
 * lives in an .tsx file that's safer here than in a one-off utility
 * (PR #40 precedent — bg-[linear-gradient(...)] in lib silently fails
 * because content paths skip src/lib).
 *
 * Positioned ABSOLUTE inside a `relative` CTA wrapper (not page-level).
 * The wrapper's relative + this layer's absolute keep the warmth glued
 * to the CTA when the CTA scrolls (§8 hybrid gradient scroll).
 */
export default function CTAWarmth() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-[-20%] -bottom-10 -top-16 -z-10"
      style={{
        background:
          "radial-gradient(ellipse at 50% 100%, hsl(12 88% 66% / 0.85) 0%, hsl(18 82% 74% / 0.5) 35%, transparent 70%)",
        filter: "blur(50px)",
      }}
    />
  );
}
