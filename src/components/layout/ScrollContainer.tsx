"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Root viewport wrapper — owns 100dvh height and a single hidden scroll
 * axis. Pages render inside this container so the scroll bar is always
 * at the same place and the iOS PWA never gets a phantom Safari URL bar
 * eating into the bottom.
 *
 * It lives in the ROOT layout, so it persists across client navigations —
 * which means the scroll element is `#app-scroll`, NOT `window`, and its
 * scroll position would otherwise carry from one page straight into the next.
 * The pathname effect resets it to the top on every route change so a tall
 * page always opens at the top. (In-flow brew step changes aren't route
 * changes — LightFlowShell resets this same element by id on step change.)
 *
 * Pages that need bottom-anchored UI (e.g. the brew flow's footer CTAs)
 * handle their own safe-area accounting via env(safe-area-inset-bottom).
 */
export const SCROLL_CONTAINER_ID = "app-scroll";

export default function ScrollContainer({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    ref.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  return (
    <div
      ref={ref}
      id={SCROLL_CONTAINER_ID}
      style={{
        height: "100dvh",
        overflowY: "auto",
        // Hides the axis, but note this box is STILL a horizontal scroll
        // container — WebKit will let a finger drag it if anything inside
        // exceeds the width. So the real defence is upstream: nothing may
        // extend past the viewport (see CTAWarmth, which used to bleed ~50px
        // beyond it and made the brew screens draggable).
        overflowX: "hidden",
        // Stops a horizontal drag from rubber-banding here or chaining to the
        // page behind it.
        overscrollBehaviorX: "none",
      }}
      className="[&::-webkit-scrollbar]:hidden"
    >
      {children}
    </div>
  );
}
