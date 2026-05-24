"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useFlowStore } from "@/store/flowStore";

/**
 * BTTS Navigation Overlay (specs/home.md §7).
 *
 * Full-screen Glass overlay that sheets *over* the current view — the
 * Field below stays visible through the semi-transparent surface, so
 * navigating to and from the menu reads as one continuous room.
 *
 * Seven destinations (§7.2 — flat list, no hierarchy):
 *   Home · Past Conversations · New Session · Coffee Library ·
 *   Nearby · Café Library · Taste Profile
 *
 * Items without an `href` render as disabled: their target route does
 * not yet exist. Past Conversations lands in PR2l alongside the
 * conversation persistence schema; until then the menu item is muted
 * and inert.
 *
 * Café Library currently shares the existing /cafes route with Nearby.
 * specs/home.md §7.2 splits them by intent (geographic discovery vs.
 * record of past visits) — that split is a later refinement.
 *
 * Tap on a destination both navigates and closes the overlay (§7.3),
 * via the onClick handler firing before Next.js transitions.
 */

interface NavItem {
  label: string;
  href?: string;
}

const ITEMS: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Past Conversations", href: "/past-conversations" },
  { label: "New Session", href: "/brew/new" },
  { label: "Coffee Library", href: "/coffees" },
  { label: "Nearby", href: "/cafes/map" },
  { label: "Café Library", href: "/cafes" },
  { label: "Taste Profile", href: "/taste" },
];

interface NavigationOverlayProps {
  open: boolean;
  onClose: () => void;
}

export default function NavigationOverlay({ open, onClose }: NavigationOverlayProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Navigation"
      // z must clear every floating chrome layer in the app. The map's
      // header / scrim / search / popup cards live at z-1000..1100, and
      // the visit-modal sheet sits at z-2000 inside CafeMap.tsx, so the
      // old z-50 left the menu opening behind the map UI. z-[2100] keeps
      // top-level navigation on top of everything.
      className="fixed inset-0 z-[2100] bg-light-card-default backdrop-blur-[14px] backdrop-saturate-150"
    >
      {/* Close button — same coordinates as the Burger that opened it
          (§7.1: "mirroring placement so thumb knows where to look").
          Pages anchor their burger at `calc(safe-area-inset-top + 1.25rem)`
          from the top and `px-5` (20px) from the right, so mirror those
          exactly here. The old `top-12` (48px, no safe-area) drifted
          ~20px above the burger on any notched device. */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close menu"
        style={{ top: "calc(env(safe-area-inset-top) + 1.25rem)" }}
        className="absolute right-5 flex h-11 w-11 items-center justify-center rounded-full border border-light-foreground/25 bg-light-card-default text-light-foreground/80 backdrop-blur-[14px] backdrop-saturate-150"
      >
        <X className="h-5 w-5" strokeWidth={1.5} />
      </button>

      {/* Destination list — Inter 24/500, foreground, gap-6 between items.
          pt-24 + pl-6 per §7.1. No icons (§7.3 anti-pattern). */}
      <nav className="flex flex-col gap-6 pl-6 pt-24">
        {ITEMS.map((item) =>
          item.href ? (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => {
                // "New Session" must always start fresh — the flow store
                // is persisted (localStorage), so without a reset this
                // would resume a stale interrupted draft.
                if (item.href === "/brew/new") useFlowStore.getState().reset();
                onClose();
              }}
              className="font-chivo text-[24px] font-medium text-light-foreground"
            >
              {item.label}
            </Link>
          ) : (
            <span
              key={item.label}
              aria-disabled="true"
              className="font-chivo text-[24px] font-medium text-light-foreground/40"
            >
              {item.label}
            </span>
          )
        )}
      </nav>
    </div>
  );
}
