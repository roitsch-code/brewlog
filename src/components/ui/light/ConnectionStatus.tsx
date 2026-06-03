"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushQueue, pendingCount } from "@/lib/storage/saveQueue";

/**
 * Single top-of-screen indicator for connectivity + offline-save sync.
 *
 * Why this owns the flush (not a `online`-event effect): iOS Safari PWAs
 * fire the `online`/`offline` events unreliably, so a reconnect often
 * doesn't wake any listener. We therefore re-check `navigator.onLine`
 * (which IS accurate when read) on mount AND on every foreground
 * (`visibilitychange`) — reopening or returning to the app reliably
 * drains the queue. The `online` event is kept as a bonus trigger.
 *
 * Queued brews are never dropped, so a stuck save stays visible with a
 * tap-to-retry that also surfaces the server's error.
 */
export default function ConnectionStatus() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [failed, setFailed] = useState(false);
  const syncingRef = useRef(false);

  const tick = useCallback(async () => {
    const isOnline = typeof navigator === "undefined" ? true : navigator.onLine;
    setOnline(isOnline);
    const count = await pendingCount();
    setPending(count);
    if (isOnline && count > 0 && !syncingRef.current) {
      syncingRef.current = true;
      setSyncing(true);
      setFailed(false);
      const res = await flushQueue();
      syncingRef.current = false;
      setSyncing(false);
      setPending(res.remaining);
      setFailed(res.remaining > 0);
      if (res.lastError) console.warn("Offline sync incomplete:", res.lastError);
    }
  }, []);

  useEffect(() => {
    void tick();
    const onOnline = () => void tick();
    const onOffline = () => setOnline(false);
    const onVisible = () => { if (document.visibilityState === "visible") void tick(); };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [tick]);

  const plural = pending === 1 ? "" : "s";
  let label: string | null = null;
  let tappable = false;
  if (syncing) {
    label = "Syncing brew…";
  } else if (online && pending > 0 && failed) {
    label = `${pending} brew${plural} didn't sync — tap to retry`;
    tappable = true;
  } else if (online && pending > 0) {
    label = "Syncing brew…";
  } else if (!online) {
    label = "Offline";
  }

  if (!label) return null;

  return (
    <div
      className="fixed inset-x-0 z-[60] flex justify-center pointer-events-none"
      style={{ top: "calc(env(safe-area-inset-top) + 0.5rem)" }}
    >
      <button
        type="button"
        disabled={!tappable}
        onClick={() => { if (tappable) void tick(); }}
        className="pointer-events-auto rounded-full bg-light-foreground/90 px-3.5 py-1.5 text-[11px] font-medium text-light-text-on-dark shadow-sm backdrop-blur-light-card backdrop-saturate-150 disabled:cursor-default"
      >
        {label}
      </button>
    </div>
  );
}
