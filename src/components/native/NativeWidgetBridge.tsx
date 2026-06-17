"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { registerWidgetDeepLinks } from "@/lib/native/widgetDeepLinks";
import { isNativeShell, isWidgetBridgeNative, pushRotationToWidget } from "@/lib/native/widgetBridge";
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
 * TEMPORARY: renders a small status line on the native shell so we can pin down
 * why the widget tiles aren't filling (plugin missing vs. push count vs. fetch
 * error). Removed once the widget data path is confirmed working.
 */
export default function NativeWidgetBridge() {
  const router = useRouter();
  const [diag, setDiag] = useState<string>("");

  useEffect(() => {
    // Deep-link registration — isolated so a failure here can't block the
    // rotation-data push below (the bug that left the widget empty).
    let cleanup: () => void = () => {};
    try {
      cleanup = registerWidgetDeepLinks((path) => router.push(path));
    } catch {
      /* deep links just won't attach */
    }

    // Rotation-data push — fully independent of the deep-link registration.
    try {
      if (isNativeShell()) {
        if (!isWidgetBridgeNative()) {
          setDiag("widget: plugin NOT found");
        } else {
          fetch("/api/coffees", { cache: "no-store" })
            .then((r) => (r.ok ? (r.json() as Promise<Coffee[]>) : Promise.reject(new Error(`coffees ${r.status}`))))
            .then((list) => {
              const rotation = list
                .filter((c) => c.inRotation)
                .map((c) => ({ id: c.id, roaster: c.roaster, name: c.name }));
              pushRotationToWidget(rotation);
              setDiag(`widget: plugin OK · ${list.length} coffees · ${rotation.length} in rotation pushed`);
            })
            .catch((e) => setDiag(`widget: plugin OK · fetch failed: ${e?.message ?? e}`));
        }
      }
    } catch (e) {
      setDiag(`widget: push error: ${(e as Error)?.message ?? e}`);
    }

    return () => {
      try { cleanup(); } catch { /* ignore */ }
    };
  }, [router]);

  if (!diag) return null;
  return (
    <div
      style={{
        position: "fixed",
        left: 8,
        right: 8,
        bottom: "calc(env(safe-area-inset-bottom) + 8px)",
        zIndex: 9999,
        background: "rgba(42,36,28,0.92)",
        color: "#F3E5DC",
        font: "11px/1.3 ui-monospace, monospace",
        padding: "6px 10px",
        borderRadius: 8,
        textAlign: "center",
        pointerEvents: "none",
      }}
    >
      {diag}
    </div>
  );
}
