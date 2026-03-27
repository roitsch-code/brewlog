"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFlowStore } from "@/store/flowStore";

const tabs = [
  {
    href: "/",
    label: "Home",
    icon: (active: boolean) => (
      <svg className="w-6 h-6" fill={active ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: "/match",
    label: "Match Finder",
    icon: (active: boolean) => (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  { href: "/brew/new", label: "New", icon: null }, // center FAB
  {
    href: "/explore",
    label: "Explore",
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    icon: (_active: boolean) => (
      // eslint-disable-next-line @next/next/no-img-element
      <img src="/icons/BrewLog.png" alt="" aria-hidden="true" width={22} height={26} style={{ objectFit: "contain", opacity: _active ? 1 : 0.45 }} />
    ),
  },
  {
    href: "/coffees",
    label: "Coffee Library",
    icon: (active: boolean) => (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
];

// Only show on these paths
const SHOW_ON = ["/", "/match", "/explore", "/coffees"];

export default function BottomNav() {
  const pathname = usePathname();
  const reset = useFlowStore(s => s.reset);

  if (!SHOW_ON.includes(pathname)) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pb-safe bg-brew-bg/90 backdrop-blur-md border-t border-brew-border">
      <div className="flex items-center justify-around px-2 h-16">
        {tabs.map(tab => {
          const active = pathname === tab.href;

          // Center FAB
          if (!tab.icon) {
            return (
              <Link key={tab.href} href={tab.href} onClick={reset} className="-mt-5">
                <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-2xl active:scale-95 transition-transform">
                  <svg className="w-7 h-7 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
              </Link>
            );
          }

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 transition-colors ${active ? "text-white" : "text-brew-muted"}`}
            >
              {tab.icon(active)}
              <span className="text-xs font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
