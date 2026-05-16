"use client";

import type { ReactNode } from "react";

/**
 * Light System — Chip variant.
 *
 * Not in design-system-v1.0.md (which only formalises Cards), but
 * BrewLog has sections where the option labels are short and text-only
 * (Grinder: "Niche Zero" / "Comandante C40"). A full Card grid would be
 * visually heavy for two text labels. The Chip is a smaller, inline
 * variant that follows the same Default → Selected tonal logic as the
 * Card so they coexist cleanly within a Section.
 *
 * Default: same cream glass as Card.
 * Selected: same warm taupe + inset shadow as Card, but no scale-down
 * (chips are too small for the scale effect to read).
 */
interface ChipProps {
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
}

export default function Chip({ selected, onClick, children }: ChipProps) {
  const base =
    "inline-flex items-center px-4 py-2 rounded-full text-[13px] font-medium leading-tight " +
    "transition-all backdrop-blur-light-card backdrop-saturate-150";
  const tone = selected
    ? "bg-light-card-selected text-light-foreground shadow-light-card-pressed"
    : "bg-light-card-default text-light-foreground";

  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={`${base} ${tone}`}>
      {children}
    </button>
  );
}
