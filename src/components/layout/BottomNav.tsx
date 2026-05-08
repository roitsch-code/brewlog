"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useFlowStore } from "@/store/flowStore";
import { Home, Coffee, Radar, Sparkles, Plus } from "lucide-react";

const tabs = [
  { href: "/", label: "Home", Icon: Home },
  // Library button points at /library (the picker page that lets the user
  // choose between coffee library and café library).
  { href: "/library", label: "Library", Icon: Coffee, prefixes: ["/library", "/coffees", "/cafes"] },
  { href: "/taste", label: "Taste", Icon: Radar },
  { href: "/explore", label: "Explore", Icon: Sparkles },
];

const EXACT_SHOW = ["/", "/taste", "/match"];
const PREFIX_SHOW = ["/library", "/coffees", "/cafes"];

/**
 * BrewLog bottom navigation — DOT-inspired 4+1 split (spec §7.1).
 * 4-icon glass pill (left) + warm-accent Brew FAB (right), separated.
 * Hidden on /explore so the chat input pill owns the bottom dock —
 * BottomNav reappears on Insights tab via the explicit show below.
 */
export default function BottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reset = useFlowStore(s => s.reset);

  // /explore: only show on the Insights tab. Ask + Nearby are full-bleed
  // chat / map surfaces that own their own bottom UI.
  const onExplore = pathname === "/explore";
  const exploreInsights = onExplore && searchParams.get("tab") === "insights";

  const showNav =
    exploreInsights ||
    (!onExplore && (EXACT_SHOW.includes(pathname) || PREFIX_SHOW.some(p => pathname.startsWith(p))));
  if (!showNav) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center gap-3 px-4 pt-1"
      style={{ paddingBottom: "var(--nav-bottom-padding)" }}
    >
      {/* Main pill — flex-1 so it stretches to fill the available width
          (FAB + lateral padding subtracted). Icons distribute evenly. */}
      <div
        className="flex-1 flex items-center justify-around h-[52px] px-2 rounded-full border border-dot-edge backdrop-blur-xl shadow-glow-subtle"
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
        className="flex items-center justify-center w-14 h-14 rounded-full shadow-glow-subtle active:scale-95 transition-transform shrink-0"
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
