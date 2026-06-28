import { useRef, useEffect, useCallback } from "react";

// App-local Capacitor plugin (`native/ios/App/App/ScreenAwakePlugin.swift`,
// registered in MainViewController.capacitorDidLoad). It flips iOS's
// `isIdleTimerDisabled`. We read it off the injected `window.Capacitor.Plugins`
// (the same pattern as brewWatch.ts) rather than importing the npm
// `@capacitor-community/keep-awake` plugin — that one was never linked into the
// iOS binary (absent from CapApp-SPM/Package.swift), so its call was a silent
// no-op and the screen slept. This app-local plugin is compiled in for certain.
// Undefined on the Safari PWA / a shell built before this plugin → we fall
// through to the Web Wake Lock API.
interface ScreenAwakePluginLike {
  keep(): Promise<void>;
  allow(): Promise<void>;
}
interface CapacitorLike {
  isNativePlatform?: () => boolean;
  Plugins?: { ScreenAwake?: ScreenAwakePluginLike };
}
function getScreenAwake(): ScreenAwakePluginLike | null {
  if (typeof window === "undefined") return null;
  const cap = (window as unknown as { Capacitor?: CapacitorLike }).Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  return cap.Plugins?.ScreenAwake ?? null;
}

export function useWakeLock() {
  const lockRef = useRef<WakeLockSentinel | null>(null);
  const wantLockRef = useRef(false);
  // tracks whether we successfully called keepAwake() on the native plugin
  const nativeActiveRef = useRef(false);

  // ── Internal acquire ────────────────────────────────────────────────────
  const acquire = useCallback(async () => {
    // Native screen-awake (real OS idle-timer disable in the iOS shell). If the
    // plugin isn't in the installed build / the call rejects, fall THROUGH to the
    // Web Wake Lock API rather than giving up — that path kept the screen awake
    // before the native plugin existed (regression: PR #424 returned early and
    // skipped it, so the brew screen slept whenever native keep-awake was a no-op).
    const sa = getScreenAwake();
    if (sa) {
      try {
        await sa.keep();
        nativeActiveRef.current = true;
        return; // native handled it — don't also take a web lock
      } catch {
        /* plugin not present in this build → fall back to web wake lock */
      }
    }
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    // Idempotent: never request a second sentinel while one is held — that would
    // leak the first (it's never released) and is what made the periodic re-assert
    // below unsafe. iOS auto-releases the sentinel on hide and the "release"
    // listener nulls this, so a re-assert on regain correctly requests a fresh one.
    if (lockRef.current) return;
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
      await getScreenAwake()?.allow().catch(() => {});
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
  // Always re-assert when we come back visible and still want the lock —
  // INCLUDING the native path. iOS clears `isIdleTimerDisabled` when the app
  // backgrounds, so on foreground the screen would start sleeping again unless we
  // call keepAwake() afresh (this was the "screen geht wieder aus" gap). acquire()
  // is idempotent, so re-asserting is safe.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && wantLockRef.current) {
        void acquire();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [acquire]);

  // ── Periodic keep-alive re-assert ────────────────────────────────────────
  // Belt-and-suspenders: while a lock is wanted and the screen is visible,
  // re-assert every 15 s. If the OS quietly drops the assertion (a known iOS
  // quirk) the screen self-recovers within one tick instead of sleeping for the
  // rest of the brew. No-op when nothing wants the lock; acquire() is idempotent.
  useEffect(() => {
    const id = setInterval(() => {
      if (wantLockRef.current && document.visibilityState === "visible") {
        void acquire();
      }
    }, 15_000);
    return () => clearInterval(id);
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
