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
 *
 * HORIZONTAL BLEED IS EXACTLY THE PAGE GUTTER (`-inset-x-5` cancels the
 * container's `px-5`), i.e. edge to edge and not one pixel further. It used to
 * be `inset-x-[-20%]`, which pushed ~50px BEYOND the viewport on a phone. Those
 * pixels were never visible — the viewport clipped them — but they made the
 * root scroll container 440px wide against a 390px screen, and a scroll
 * container with hidden overflow is still draggable in WebKit. That is what let
 * the brew/recommend screens be dragged sideways and snap back ("the page moves
 * by itself"). Keep this flush with the gutter: the warmth must reach the screen
 * edges, never extend past them. The container is capped at max-w-[430px], so
 * on a wide screen this spans the container, not the window.
 */
export default function CTAWarmth() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -inset-x-5 -bottom-10 -top-16 -z-10"
      style={{
        background:
          "radial-gradient(ellipse at 50% 100%, hsl(12 88% 66% / 0.85) 0%, hsl(18 82% 74% / 0.5) 35%, transparent 70%)",
        filter: "blur(50px)",
      }}
    />
  );
}
