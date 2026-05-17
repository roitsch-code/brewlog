"use client";

import { usePathname } from "next/navigation";

// Mirrors the BottomNav show rule. Now empty -- every route in the
// original allowlist has migrated to the (light) route group and owns
// its own NavigationOverlay burger. ScrollContainer therefore reserves
// no bottom padding by default; pages that need bottom-anchored UI
// (eg /brew/new during a flow) handle their own safe-area accounting.
//
// Critical: do NOT use useSearchParams() here. ScrollContainer wraps
// children in app/layout.tsx without a Suspense boundary, so any
// useSearchParams() reference triggers an SSG bailout and breaks the
// production build for every page.
const EXACT_SHOW: string[] = [];
const PREFIX_SHOW: string[] = [];

export default function ScrollContainer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showNav = EXACT_SHOW.includes(pathname) || PREFIX_SHOW.some(p => pathname.startsWith(p));
  return (
    <div
      style={{
        height: "100dvh",
        overflowY: "auto",
        overflowX: "hidden",
        paddingBottom: showNav ? "calc(78px + env(safe-area-inset-bottom))" : "0",
      }}
      className="[&::-webkit-scrollbar]:hidden"
    >
      {children}
    </div>
  );
}
