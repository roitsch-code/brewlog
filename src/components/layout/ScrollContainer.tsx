"use client";

import { usePathname } from "next/navigation";

const EXACT_SHOW = ["/", "/explore", "/taste"];
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
