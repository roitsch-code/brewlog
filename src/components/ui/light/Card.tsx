"use client";

import type { ReactNode } from "react";

/**
 * Light System v1.0 §4 — Card primitive.
 *
 * Two states: Default and Selected (pressed).
 *   - Default: cream glass at 55% with backdrop-blur + backdrop-saturate.
 *   - Selected: warm taupe at 70%, scale-[0.98], warm inset shadow.
 *
 * The Card is `flex flex-col items-center justify-center text-center`.
 * Children own their internal layout (Title above, Detail below). Fixed
 * height is owned by the *section*, not the card — set `h-[104px]` on
 * the grid container, not here, so all cards in a section share height
 * (§5.2).
 *
 * Tap-to-deselect (§4.4) is the caller's responsibility — the Card
 * doesn't manage state, it just renders the visual.
 */
interface CardProps {
  selected?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
  className?: string;
  children: ReactNode;
}

export default function Card({ selected, onClick, ariaLabel, className, children }: CardProps) {
  const base =
    "w-full h-full flex flex-col items-center justify-center text-center gap-1.5 " +
    "rounded-3xl px-3 py-4 transition-all backdrop-blur-light-card backdrop-saturate-150";
  const tone = selected
    ? "bg-light-card-selected scale-[0.98] shadow-light-card-pressed"
    : "bg-light-card-default";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={ariaLabel}
      className={`${base} ${tone}${className ? ` ${className}` : ""}`}
    >
      {children}
    </button>
  );
}

/**
 * Card title — Inter/Chivo 15/500, foreground, leading-tight.
 *
 * Spec §3.2: card titles never wrap to three lines. If a label is long
 * enough to break twice at 50% column width, shorten the label.
 */
export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <p className="text-[15px] font-medium leading-tight text-light-foreground">{children}</p>
  );
}

/**
 * Card sub-text (Detail Form A) — Inter/Chivo 12/400, muted, line-clamp-2.
 */
export function CardSubText({ children }: { children: ReactNode }) {
  return (
    <p className="text-[12px] leading-tight text-light-muted-foreground line-clamp-2">
      {children}
    </p>
  );
}

/**
 * Card icon (Detail Form B) — Lucide line-icon sized externally, wrapped
 * in an h-6 w-6 flex centering container so visual centre aligns with
 * the title above (§9.1).
 */
export function CardIcon({ children }: { children: ReactNode }) {
  return (
    <div className="h-6 w-6 flex items-center justify-center text-light-foreground/80">
      {children}
    </div>
  );
}
