"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useFlowStore } from "@/store/flowStore";
import { Home, Coffee, Radar, Sparkles, Plus } from "lucide-react";

const tabs = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/coffees", label: "Library", Icon: Coffee, prefixes: ["/coffees", "/library", "/cafes"] },
  { href: "/taste", label: "Taste", Icon: Radar },
  { href: "/explore", label: "Explore", Icon: Sparkles },
];

const EXACT_SHOW = ["/", "/explore", "/taste", "/match"];
const PREFIX_SHOW = ["/library", "/coffees", "/cafes"];

/**
 * BrewLog bottom navigation — DOT-inspired 4+1 split (spec §7.1).
 * Glass pill with 4 icons (Home, Library, Taste, Explore) sits on the
 * left; warm-accent Brew FAB sits to its right, separated. Both anchor
 * to the safe-area bottom.
 */
export default function BottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reset = useFlowStore(s => s.reset);

  const onNearbyMap = pathname === "/explore" && searchParams.get("tab") === "nearby";
  const showNav = !onNearbyMap && (EXACT_SHOW.includes(pathname) || PREFIX_SHOW.some(p => pathname.startsWith(p)));
  if (!showNav) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center gap-3.5 px-4 pt-1"
      style={{ paddingBottom: "var(--nav-bottom-padding)" }}
    >
      {/* Main pill — 4 icons, glass */}
      <div
        className="flex items-center gap-1 h-[52px] px-2 rounded-full border border-dot-edge backdrop-blur-xl shadow-glow-subtle"
        style={{ background: "var(--surface-pill-input)" }}
      >
        {tabs.map(tab => {
          const active = tab.prefixes
            ? tab.prefixes.some(p => pathname === p || pathname.startsWith(p + "/"))
            : pathname === tab.href;
          const { Icon } = tab;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-label={tab.label}
              className="relative flex items-center justify-center w-11 h-11 rounded-2xl transition-colors duration-150"
              style={{
                background: active ? "var(--surface-2)" : "transparent",
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
              }}
            >
              <Icon size={20} strokeWidth={active ? 2 : 1.6} />
            </Link>
          );
        })}
      </div>

      {/* Brew FAB — separated, warm-accent */}
      <Link
        href="/brew/new"
        onClick={reset}
        aria-label="New brew"
        className="flex items-center justify-center w-14 h-14 rounded-full shadow-glow-subtle active:scale-95 transition-transform"
        style={{
          background: "var(--text-accent)",
          color: "var(--bg-base)",
        }}
      >
        <Plus size={26} strokeWidth={2.25} />
      </Link>
    </div>
  );
}
