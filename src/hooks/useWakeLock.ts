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
    if (isNative()) {
      const ka = await loadKeepAwake();
      if (ka) {
        await ka.keepAwake().catch(() => {});
        nativeActiveRef.current = true;
      }
      return;
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
