"use client";

import type { ReactNode } from "react";
import { FieldProvider } from "@/lib/field/FieldContext";
import Field from "./Field";

/**
 * Light System v1.0 + v1.1 — route-scoped shell.
 *
 * Applies the three anchors from specs/design-system-v1.0.md §1:
 *   - The Field (§2.1 / v1.1 §7) — fixed atmospheric background,
 *     now coffee-driven via FieldContext. Default composition
 *     renders identical to the v1.0 static gradient when no page
 *     overrides via useFieldConfig.
 *   - The Voice (§3) — Inter as body default, Fraunces opt-in via
 *     `font-fraunces`.
 *   - Foreground (§2.4) — warm near-black at full opacity, inherited.
 *
 * Why a client component: FieldProvider owns useState for the
 * current FieldConfig (pages set it via useFieldConfig). Marking
 * "use client" here scopes that React state to the (light) tree;
 * Dark routes outside this group keep their server-render path.
 *
 * Field placement: rendered inside the FieldProvider but at the
 * same DOM level as children, so the fixed -z-10 sandwich paints
 * behind every (light) view. Pages don't render their own Field —
 * they update the context.
 */
export default function LightShell({ children }: { children: ReactNode }) {
  return (
    <FieldProvider>
      <div data-light-scope="true" className="font-chivo text-light-foreground min-h-dvh">
        <Field />
        {/* Status-bar scrim — unifies the iOS PWA status-bar zone across
         * every Light route. The Field below can vary from cream → pink
         * → orange (especially with brew-flow rotation, or when the
         * coffee-driven Field hits a warm zone), and the map page paints
         * Positron tiles all the way to y=0. Without this scrim the
         * system clock + icons sit on a different colour patch per page.
         *
         * Cream at ~85% opacity through the safe-area, fading to
         * transparent over a 1.5rem buffer below. Page headers start at
         * `safe-area + ~1.25rem` so they sit at the very tail of the
         * fade — anthracite text reads cleanly against the soft cream
         * wash. Fixed + pointer-events-none so the scrim floats over
         * the Field (z=-10) and ordinary page content but stays out of
         * the way of taps. Floating chrome that owns z >= 1000 (the
         * map's burger + Nearby title) paints above the scrim. */}
        <div
          className="pointer-events-none fixed top-0 left-0 right-0 z-[5]"
          style={{
            height: "calc(env(safe-area-inset-top) + 1.5rem)",
            background:
              "linear-gradient(to bottom, hsl(36 55% 96% / 0.85) 0%, hsl(36 55% 96% / 0.85) 60%, transparent 100%)",
          }}
        />
        {children}
      </div>
    </FieldProvider>
  );
}
