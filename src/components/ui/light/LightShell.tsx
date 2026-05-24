"use client";

import { useEffect, type ReactNode } from "react";
import { FieldProvider } from "@/lib/field/FieldContext";
import Field from "./Field";
import { useOnline } from "@/hooks/useOnline";
import { flushQueue } from "@/lib/storage/saveQueue";

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
  const online = useOnline();

  // Drain any brews queued while offline once a connection is available
  // (also runs once on mount, catching saves from a previous visit).
  useEffect(() => {
    if (online) void flushQueue();
  }, [online]);

  return (
    <FieldProvider>
      <div data-light-scope="true" className="font-chivo text-light-foreground min-h-dvh">
        <Field />
        {!online && (
          <div
            className="fixed inset-x-0 z-[60] flex justify-center pointer-events-none"
            style={{ top: "calc(env(safe-area-inset-top) + 0.5rem)" }}
          >
            <div className="pointer-events-auto rounded-full bg-light-foreground/90 px-3.5 py-1.5 text-[11px] font-medium text-[hsl(36_55%_96%)] shadow-sm backdrop-blur">
              Offline
            </div>
          </div>
        )}
        {children}
      </div>
    </FieldProvider>
  );
}
