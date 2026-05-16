"use client";

import { usePathname } from "next/navigation";

// Mirrors the BottomNav show rule. Light routes (/home,
// /past-conversations) own their own bottom UI and never need the
// reserved space, so they fall outside this allowlist by design.
//
// Critical: do NOT use useSearchParams() here. ScrollContainer wraps
// children in app/layout.tsx without a Suspense boundary, so any
// useSearchParams() reference triggers an SSG bailout and breaks the
// production build for every page.
const EXACT_SHOW = ["/taste", "/match"];
const PREFIX_SHOW = ["/library", "/coffees", "/cafes"];

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
