"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFlowStore } from "@/store/flowStore";
import { Home, Coffee, Radar, Plus } from "lucide-react";

const tabs = [
  { href: "/", label: "Home", Icon: Home },
  // Library button points at /library (the picker page that lets the
  // user choose between coffee library and café library).
  { href: "/library", label: "Library", Icon: Coffee, prefixes: ["/library", "/coffees", "/cafes"] },
  { href: "/taste", label: "Taste", Icon: Radar },
];

// Allowlist of Dark routes that still show the legacy BottomNav. The
// new BTTS Light surfaces (/home, /past-conversations) are
// intentionally outside this list — they own their own bottom UI via
// the input bar (Home) or no bottom UI (Past Conversations).
const EXACT_SHOW = ["/", "/taste", "/match"];
const PREFIX_SHOW = ["/library", "/coffees", "/cafes"];

/**
 * BrewLog bottom navigation — DOT-inspired 4+1 split.
 * 3-icon glass pill (left) + warm-accent Brew FAB (right), separated.
 * Explore tab removed in PR2m (the BTTS Light Home replaces it).
 */
export default function BottomNav() {
  const pathname = usePathname();
  const reset = useFlowStore((s) => s.reset);

  const showNav =
    EXACT_SHOW.includes(pathname) || PREFIX_SHOW.some((p) => pathname.startsWith(p));
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
        {tabs.map((tab) => {
          const active = tab.prefixes
            ? tab.prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"))
            : pathname === tab.href;
          const { Icon } = tab;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-label={tab.label}
              className="relative flex items-center justify-center w-11 h-11 rounded-2xl transition-colors duration-150"
              style={{
                background: active ? "rgba(232,197,168,0.14)" : "transparent",
                color: active ? "var(--text-accent)" : "var(--text-secondary)",
              }}
            >
              <Icon size={20} strokeWidth={active ? 2.25 : 1.6} />
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                  style={{ background: "var(--text-accent)" }}
                />
              )}
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
