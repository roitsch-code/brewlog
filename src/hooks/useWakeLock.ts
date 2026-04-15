import { useRef, useEffect, useCallback } from "react";

/**
 * useWakeLock — keeps the iPhone/iPad screen awake during an active brew session.
 *
 * Why: iOS aggressively dims and locks the screen after ~30s of no touch input.
 * During a pour-over the brewer watches the timer without touching the phone,
 * which causes the screen to go dark at exactly the wrong moment.
 *
 * How: The Screen Wake Lock API (navigator.wakeLock) requests an OS-level hint
 * to suppress auto-lock. It is automatically released by the browser whenever
 * the document becomes hidden (e.g. user switches apps), so we re-acquire it
 * on visibilitychange.
 *
 * Limitations:
 * - Only works while the page is in the foreground (document.visibilityState === "visible")
 * - The OS may still release the lock under low-battery or power-saving conditions
 * - Not supported in all browsers (gracefully no-ops if unavailable)
 * - Requires a secure context (HTTPS or localhost) — satisfied by the PWA
 *
 * Usage:
 *   const { enableWakeLock, disableWakeLock } = useWakeLock();
 *   enableWakeLock();   // call when brew starts
 *   disableWakeLock();  // call when brew ends (unmount cleanup also handles this)
 */
export function useWakeLock() {
  // The WakeLockSentinel returned by the API — null when we don't hold the lock
  const lockRef = useRef<WakeLockSentinel | null>(null);

  // Whether the caller has requested the lock (separate from whether we currently
  // hold it — the OS can release it while the tab is hidden, so we track intent
  // independently so the visibilitychange handler knows whether to re-acquire)
  const wantLockRef = useRef(false);

  // ── Internal acquire ────────────────────────────────────────────────────
  const acquire = useCallback(async () => {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    try {
      lockRef.current = await navigator.wakeLock.request("screen");
      lockRef.current.addEventListener("release", () => {
        // System released the lock (tab hidden, low battery, etc.)
        // We leave wantLockRef.current unchanged so visibilitychange can re-acquire.
        console.log("[useWakeLock] Screen wake lock released by system.");
        lockRef.current = null;
      });
    } catch (err) {
      // DOMException: permission denied or not supported in this context
      console.warn("[useWakeLock] Could not acquire wake lock:", err);
    }
  }, []);

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Request the screen wake lock. Call this when the brew timer starts.
   * Safe to call multiple times — no-ops if already held.
   */
  const enableWakeLock = useCallback(() => {
    if (!("wakeLock" in navigator)) {
      console.warn("[useWakeLock] Screen Wake Lock API is not supported in this browser.");
      return;
    }
    if (wantLockRef.current) return; // already requested
    wantLockRef.current = true;
    void acquire();
  }, [acquire]);

  /**
   * Release the screen wake lock. Call this when brewing ends.
   * Also called automatically on component unmount.
   */
  const disableWakeLock = useCallback(() => {
    wantLockRef.current = false;
    if (lockRef.current) {
      lockRef.current.release().catch(() => {});
      lockRef.current = null;
    }
  }, []);

  // ── Re-acquire on tab focus ─────────────────────────────────────────────
  // The API releases locks when the document is hidden (app switch, sleep button).
  // Re-request as soon as the page becomes visible again — but only if the caller
  // still wants it (wantLockRef.current === true).
  useEffect(() => {
    const onVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        wantLockRef.current &&
        !lockRef.current && // not already held
        "wakeLock" in navigator
      ) {
        void acquire();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [acquire]); // acquire is stable (no deps), so this effect runs once

  // ── Unmount cleanup ─────────────────────────────────────────────────────
  // Covers all exit paths: "Done Brewing →", back navigation, hot reload, etc.
  useEffect(() => {
    return () => {
      wantLockRef.current = false;
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, []); // intentionally empty — cleanup only, no reactive deps

  return { enableWakeLock, disableWakeLock };
}
