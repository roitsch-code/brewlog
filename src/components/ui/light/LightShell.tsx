import type { ReactNode } from "react";

/**
 * Light System v1.0 — route-scoped shell.
 *
 * Applies the three anchors from specs/design-system-v1.0.md §1:
 *   - The Field (§2.1) — fixed atmospheric background, sandwich structure
 *   - The Voice (§3) — Inter as body default, Fraunces opt-in via `font-fraunces`
 *   - Foreground (§2.4) — warm near-black at full opacity, inherited by children
 *
 * Lives at the (light) route group root. Dark routes are unaffected — they
 * continue to render under the legacy root layout's body bg / Geist stack.
 *
 * The Field's <div absolute inset-[-10%] /> bleeds 10% past the viewport so
 * the 60px blur halo has room to land outside the visible area (§2.1).
 */
export default function LightShell({ children }: { children: ReactNode }) {
  return (
    <div data-light-scope="true" className="font-inter text-light-foreground min-h-dvh">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute inset-[-10%] bg-brew-field" />
      </div>
      {children}
    </div>
  );
}
