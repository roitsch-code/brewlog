"use client";

import type { ReactNode } from "react";

/**
 * Light System — Chip variant.
 *
 * Not formalised in design-system-v1.0.md (which only covers Cards),
 * but reintroduced here for sections with many short text-only
 * options where a Card grid would dominate the layout (StepLog: Flow,
 * Timing, Body, Acidity, Flavor Notes, Sensory rows). Shares the
 * Card's Default → Selected tonal logic so they coexist cleanly.
 *
 * Default: cream glass at 55% with backdrop-blur + backdrop-saturate.
 * Selected: warm taupe at 70% + warm inset shadow. No scale-down
 * (chips are too small for the press effect to read).
 *
 * Size variants — pick one of these two and stick to it:
 *   - default: px-4 py-2, 13px
 *       "pick-one answer" rows where the chip IS the question's
 *       primary control. Examples: Sensory clarity/body/sweetness
 *       /bitterness/finish/flow on /brew log, SensoryToggle Yes/No,
 *       ImpressionRow's primary chips, roaster Q&A clarifications on
 *       /brew scan, the grinder picker on /onboarding.
 *   - sm: px-3 py-1.5, 12px
 *       Multi-select TAG rows, dense scrolling pickers, compact
 *       card-footer actions, and secondary inline confirmations
 *       inside a denser review form. Examples: FlavorWheel quick
 *       picks, candidate role picker on /recommend, country picker,
 *       process / roast level on /brew scan review, coach actions on
 *       /taste and CoachCard, equipment multi-select on /onboarding.
 *
 * The rule of thumb: if the chip stands alone as the answer to a
 * focused question, use `default`. If it's one of many tags / one of
 * a dense row / a secondary inline confirm, use `sm`. Don't mix the
 * two on the same row — the cheat sheet in CLAUDE.md mirrors this.
 */
interface ChipProps {
  selected?: boolean;
  onClick?: () => void;
  size?: "sm" | "default";
  children: ReactNode;
}

export default function Chip({ selected, onClick, size = "default", children }: ChipProps) {
  const sizing =
    size === "sm"
      ? "px-3 py-1.5 text-[12px]"
      : "px-4 py-2 text-[13px]";
  const tone = selected
    ? "bg-light-card-selected text-light-foreground shadow-light-card-pressed"
    : "bg-light-card-default text-light-foreground";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`inline-flex items-center rounded-full font-medium leading-tight transition-all backdrop-blur-light-card backdrop-saturate-150 ${sizing} ${tone}`}
    >
      {children}
    </button>
  );
}
