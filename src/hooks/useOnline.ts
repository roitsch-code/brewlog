"use client";

import { useEffect, useState } from "react";

/**
 * Tracks connectivity via navigator.onLine + the online/offline events.
 * Seeds `true` so the offline UI never flashes during hydration; the real
 * value is read on mount.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return online;
}
