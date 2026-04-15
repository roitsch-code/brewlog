"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFlowStore } from "@/store/flowStore";

const SZ = "w-[18px] h-[18px]"; // unified icon size

const ICONS: Record<string, React.ReactNode> = {
  home: (
    <svg className={SZ} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  ),
  add: (
    <svg className={SZ} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  ),
  library: (
    <svg className={SZ} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  match: (
    <svg className={SZ} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  ),
  taste: (
    <svg className={SZ} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3C8 3 4 7 4 11c0 5 4 9 8 10 4-1 8-5 8-10 0-4-4-8-8-8z" />
      <path d="M12 7c-2 0-4 2-4 4" />
    </svg>
  ),
};

const MENU_ITEMS: { label: string; href: string; iconKey: string }[] = [
  { label: "Home",           href: "/",         iconKey: "home" },
  { label: "Add Coffee",     href: "/brew/new", iconKey: "add" },
  { label: "Coffee Library", href: "/coffees",  iconKey: "library" },
  { label: "Explore",        href: "/explore",  iconKey: "bean" },
  { label: "Taste Profile",  href: "/taste",    iconKey: "taste" },
];

export default function TopMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const reset = useFlowStore(s => s.reset);

  // Close on outside tap
  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, []);

  const navigate = (href: string) => {
    setOpen(false);
    if (href === "/brew/new") reset();
    router.push(href);
  };

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-10 h-10 rounded-full bg-brew-surface border border-brew-border flex items-center justify-center text-white active:scale-95 transition-transform"
        aria-label="Menu"
      >
        {open ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-12 w-52 bg-brew-elevated border border-brew-border rounded-2xl shadow-2xl overflow-hidden z-50">
          {MENU_ITEMS.map((item, i) => (
            <button
              key={item.href}
              type="button"
              onClick={() => navigate(item.href)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-brew-surface active:bg-brew-surface transition-colors ${i < MENU_ITEMS.length - 1 ? "border-b border-brew-border" : ""}`}
            >
              <span className="text-brew-accent flex items-center justify-center w-[18px] h-[18px] shrink-0">
                {item.iconKey === "bean" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="/icons/BrewLog.png" alt="" aria-hidden="true" width={18} height={18} style={{ objectFit: "contain", width: 18, height: 18 }} />
                ) : ICONS[item.iconKey]}
              </span>
              <span className="text-white text-sm">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
