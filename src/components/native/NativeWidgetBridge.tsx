"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { registerWidgetDeepLinks } from "@/lib/native/widgetDeepLinks";
import { isWidgetBridgeNative, pushRotationToWidget } from "@/lib/native/widgetBridge";
import type { Coffee } from "@/lib/types/coffee";

/**
 * Mounts the home-screen widget bridge once at the app root (inside LightShell).
 *
 * Two jobs, both no-ops off the native iOS shell:
 *   1. Register the `btts://` deep-link listener so a widget tap routes via the
 *      Next client router (brew a rotation bag / open the scanner).
 *   2. Push the current in-rotation coffees into the widget's App Group store so
 *      the medium widget renders fresh tap-to-brew tiles.
 *
 * Renders nothing. Lives in LightShell so it survives route changes (the shell
 * wraps the whole (light) tree) and so the deep-link handler always has a live
 * router to navigate with.
 */
export default function NativeWidgetBridge() {
  const router = useRouter();

  useEffect(() => {
    const cleanup = registerWidgetDeepLinks((path) => router.push(path));

    // Refresh the widget's rotation tiles on app open. Filtered client-side from
    // the same /api/coffees the library uses; failure is silent (the widget just
    // keeps its last tiles).
    if (isWidgetBridgeNative()) {
      fetch("/api/coffees", { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<Coffee[]>) : []))
        .then((list) => {
          const rotation = list
            .filter((c) => c.inRotation)
            .map((c) => ({ id: c.id, roaster: c.roaster, name: c.name }));
          pushRotationToWidget(rotation);
        })
        .catch(() => {});
    }

    return cleanup;
  }, [router]);

  return null;
}
