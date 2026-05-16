"use client";

import type { ReactNode } from "react";

/**
 * Light System v1.0 §5 — Section primitive.
 *
 * Anatomy: Eyebrow → grid/row of cards → optional Footnote. The Footnote
 * is *part of the section* (§5.3); it does not own its own bottom space.
 * Parent uses `space-y-10` to separate Sections (40px gap from the last
 * visible element of one Section to the next eyebrow).
 *
 * The Section component renders eyebrow + children. Callers wrap their
 * cards/chips in their own layout container (e.g. `grid grid-cols-2
 * gap-3`) — the Section doesn't impose a grid because v1.0 has both
 * card grids and chip rows.
 *
 * Footnote, when supplied, renders mt-3 below children — inside the
 * Section, so it sits in the rhythm.
 */
interface SectionProps {
  eyebrow: string;
  footnote?: ReactNode;
  children: ReactNode;
}

export default function Section({ eyebrow, footnote, children }: SectionProps) {
  return (
    <section>
      <p className="label-eyebrow mb-3 px-1">{eyebrow}</p>
      {children}
      {footnote}
    </section>
  );
}
