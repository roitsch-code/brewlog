"use client";

import { X } from "lucide-react";
import Link from "next/link";

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
  { label: "Nearby", href: "/cafes" },
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
      className="fixed inset-0 z-50 bg-light-card-default backdrop-blur-[14px] backdrop-saturate-150"
    >
      {/* Close button — same coordinates as the Burger that opened it
          (§7.1: "mirroring placement so thumb knows where to look"). */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close menu"
        className="absolute right-5 top-12 flex h-11 w-11 items-center justify-center rounded-full border border-light-foreground/25 bg-light-card-default text-light-foreground/80 backdrop-blur-[14px] backdrop-saturate-150"
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
              onClick={onClose}
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
