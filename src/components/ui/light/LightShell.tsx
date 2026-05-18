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
        {children}
      </div>
    </FieldProvider>
  );
}
