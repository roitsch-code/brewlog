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
 * Size variants — pick by the chip's ROLE, and never mix sizes on one row:
 *   - default (px-4 py-2, 13px): the chip IS the primary control answering a
 *     focused, pick-one question. Sensory clarity/body/sweetness/bitterness/
 *     finish/flow on the /brew log, SensoryToggle Yes/No, ImpressionRow
 *     primaries, Roaster Q&A clarifications on /brew scan, the grinder picker
 *     on /onboarding.
 *   - sm (px-3 py-1.5, 12px): one of many tags, a dense scrolling picker, a
 *     compact card-footer action, or a secondary inline confirm in a denser
 *     form. FlavorWheel quick picks, candidate role picker on /recommend,
 *     country picker, process/roast on /brew scan review, Coach actions on
 *     /taste + CoachCard, and the equipment multi-select on /onboarding.
 *   Rule of thumb: stands alone as the answer → default; one of many / dense
 *   row / secondary confirm → sm.
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
