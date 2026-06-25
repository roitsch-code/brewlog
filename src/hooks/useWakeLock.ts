import { useRef, useEffect, useCallback } from "react";

type KeepAwakePlugin = {
  keepAwake(): Promise<void>;
  allowSleep(): Promise<void>;
};

// Dynamically imported so it never lands in the PWA's main bundle.
// If the plugin isn't present (Safari PWA, old shell), the import fails
// silently and we fall through to the Web Wake Lock API.
let keepAwakeCache: KeepAwakePlugin | null | undefined; // undefined = not yet tried
async function loadKeepAwake(): Promise<KeepAwakePlugin | null> {
  if (keepAwakeCache !== undefined) return keepAwakeCache;
  try {
    const mod = await import("@capacitor-community/keep-awake");
    keepAwakeCache = mod.KeepAwake as KeepAwakePlugin;
  } catch {
    keepAwakeCache = null;
  }
  return keepAwakeCache;
}

function isNative(): boolean {
  return typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();
}

export function useWakeLock() {
  const lockRef = useRef<WakeLockSentinel | null>(null);
  const wantLockRef = useRef(false);
  // tracks whether we successfully called keepAwake() on the native plugin
  const nativeActiveRef = useRef(false);

  // ── Internal acquire ────────────────────────────────────────────────────
  const acquire = useCallback(async () => {
    // Native keep-awake (real OS idle-timer disable in the iOS shell). If the
    // plugin isn't in the installed build / the call rejects, fall THROUGH to the
    // Web Wake Lock API rather than giving up — that path kept the screen awake
    // before the native plugin existed (regression: PR #424 returned early and
    // skipped it, so the brew screen slept whenever native keep-awake was a no-op).
    if (isNative()) {
      const ka = await loadKeepAwake();
      if (ka) {
        try {
          await ka.keepAwake();
          nativeActiveRef.current = true;
          return; // native handled it — don't also take a web lock
        } catch {
          /* plugin not implemented in this build → fall back to web wake lock */
        }
      }
    }
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    try {
      lockRef.current = await navigator.wakeLock.request("screen");
      lockRef.current.addEventListener("release", () => {
        lockRef.current = null;
      });
    } catch (err) {
      console.warn("[useWakeLock] Could not acquire wake lock:", err);
    }
  }, []);

  const releaseAll = useCallback(async () => {
    if (nativeActiveRef.current) {
      const ka = await loadKeepAwake();
      await ka?.allowSleep().catch(() => {});
      nativeActiveRef.current = false;
    }
    if (lockRef.current) {
      lockRef.current.release().catch(() => {});
      lockRef.current = null;
    }
  }, []);

  // ── Public API ──────────────────────────────────────────────────────────
  const enableWakeLock = useCallback(() => {
    if (wantLockRef.current) return;
    wantLockRef.current = true;
    void acquire();
  }, [acquire]);

  const disableWakeLock = useCallback(() => {
    wantLockRef.current = false;
    void releaseAll();
  }, [releaseAll]);

  // ── Re-acquire on tab focus ─────────────────────────────────────────────
  useEffect(() => {
    const onVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        wantLockRef.current &&
        !lockRef.current &&
        !nativeActiveRef.current
      ) {
        void acquire();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [acquire]);

  // ── Unmount cleanup ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      wantLockRef.current = false;
      void releaseAll();
    };
  }, [releaseAll]);

  return { enableWakeLock, disableWakeLock };
}
