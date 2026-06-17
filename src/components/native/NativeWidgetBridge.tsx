"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { registerWidgetDeepLinks } from "@/lib/native/widgetDeepLinks";
import { isNativeShell, isWidgetBridgeNative, pushRotationToWidget } from "@/lib/native/widgetBridge";
import type { Coffee } from "@/lib/types/coffee";

/**
 * Mounts the home-screen widget bridge once at the app root (inside LightShell).
 *
 * Two jobs, both no-ops off the native iOS shell, each isolated so one failing
 * can't block the other (the deep-link `.then` bug that left the widget empty):
 *   1. Register the `btts://` deep-link listener so a widget tap routes via the
 *      Next client router (brew a rotation bag / open the scanner).
 *   2. Push the current in-rotation coffees into the widget's App Group store so
 *      the medium widget renders fresh tap-to-brew tiles.
 */
export default function NativeWidgetBridge() {
  const router = useRouter();

  useEffect(() => {
    // Deep-link registration — isolated.
    let cleanup: () => void = () => {};
    try {
      cleanup = registerWidgetDeepLinks((path) => router.push(path));
    } catch {
      /* deep links just won't attach */
    }

    // Rotation-data push — independent of the deep-link registration.
    try {
      if (isNativeShell() && isWidgetBridgeNative()) {
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
    } catch {
      /* a widget bridge must never take the app down */
    }

    return () => {
      try { cleanup(); } catch { /* ignore */ }
    };
  }, [router]);

  return null;
}
