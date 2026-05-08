"use client";

import { usePathname, useSearchParams } from "next/navigation";

// Mirror BottomNav's visibility: same routes, same /explore tab nuance.
// Keep in sync with BottomNav.tsx.
const EXACT_SHOW = ["/", "/taste", "/match"];
const PREFIX_SHOW = ["/library", "/coffees", "/cafes"];

export default function ScrollContainer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const onExplore = pathname === "/explore";
  const exploreInsights = onExplore && searchParams.get("tab") === "insights";
  const showNav =
    exploreInsights ||
    (!onExplore && (EXACT_SHOW.includes(pathname) || PREFIX_SHOW.some(p => pathname.startsWith(p))));
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
