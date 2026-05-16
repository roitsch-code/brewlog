"use client";

import type { ReactNode } from "react";

/**
 * Light System v1.0 §7.4 — Page hero (eyebrow + question).
 *
 * Eyebrow uses the `label-eyebrow` utility (Chivo 11/600 uppercase
 * tracked, foreground/70). Question is Fraunces 40/600, leading 1.05,
 * tracking -0.01em. Fraunces is reserved for the hero question on each
 * view (§3.3) — do not use it for section headings or anywhere else.
 *
 * `pb-10` (40px) below hero before the first section. Container is
 * applied by the caller; Hero is layout-agnostic.
 */
interface HeroProps {
  eyebrow: ReactNode;
  question: ReactNode;
}

export default function Hero({ eyebrow, question }: HeroProps) {
  return (
    <div className="pb-10">
      <p className="label-eyebrow mb-3 px-1">{eyebrow}</p>
      <h1 className="font-fraunces font-semibold text-[40px] leading-[1.05] tracking-[-0.01em] text-light-foreground px-1">
        {question}
      </h1>
    </div>
  );
}
