"use client";

import { useEffect, useRef, useState } from "react";

export type PresenceState = "enter" | "exit";

/**
 * Minimal mount/exit-animation gate — a tiny stand-in for framer-motion's
 * AnimatePresence for a single node, so an element can animate OUT before it
 * unmounts (the codebase has no animation library and doesn't want one).
 *
 * While `present` is true the node is mounted in the "enter" state. When
 * `present` flips false the node STAYS mounted in the "exit" state for
 * `exitMs` (so an exit animation can play), then unmounts. Flipping back to
 * true before the timer fires re-enters cleanly.
 */
export function usePresence(
  present: boolean,
  exitMs: number,
): { mounted: boolean; state: PresenceState } {
  const [mounted, setMounted] = useState(present);
  const [state, setState] = useState<PresenceState>(present ? "enter" : "exit");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (present) {
      setMounted(true);
      setState("enter");
    } else if (mounted) {
      setState("exit");
      timer.current = setTimeout(() => {
        setMounted(false);
        timer.current = null;
      }, exitMs);
    }
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, [present, exitMs, mounted]);

  return { mounted, state };
}
