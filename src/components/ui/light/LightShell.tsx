"use client";

import { type ReactNode, useEffect } from "react";
import { FieldProvider } from "@/lib/field/FieldContext";
import { sweepBrewNotifications } from "@/lib/native/brewNotifications";
import NativeWidgetBridge from "@/components/native/NativeWidgetBridge";
import Field from "./Field";
import ConnectionStatus from "./ConnectionStatus";
import RecommendJobWatcher from "./RecommendJobWatcher";

// Run the legacy-notification sweep once per app session, not per route mount.
let didSweepNotifications = false;

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
 * ConnectionStatus owns the offline indicator + offline-save sync.
 */
export default function LightShell({ children }: { children: ReactNode }) {
  // Clear any brew notification a pre-removal build left scheduled in iOS's
  // queue (they only ever orphaned after a force-quit). One-shot on app open;
  // no-op off the native shell. Brews no longer schedule notifications.
  useEffect(() => {
    if (didSweepNotifications) return;
    didSweepNotifications = true;
    void sweepBrewNotifications();
  }, []);

  return (
    <FieldProvider>
      <div data-light-scope="true" className="font-chivo text-light-foreground min-h-dvh">
        <Field />
        <ConnectionStatus />
        <RecommendJobWatcher />
        <NativeWidgetBridge />
        {children}
      </div>
    </FieldProvider>
  );
}
