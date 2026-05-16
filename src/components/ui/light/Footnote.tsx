"use client";

import type { ReactNode } from "react";

/**
 * Light System v1.0 §6 — Footnote primitive.
 *
 * Single line (or short paragraph) of muted text below the section's
 * cards. mt-3 internal — the Footnote does NOT own bottom space
 * (§5.3 anti-pattern). Section spacing is applied by the parent's
 * `space-y-10`, measured from the bottom of the Footnote.
 *
 * Three render modes per the spec (Educational / Reactive / Hybrid):
 *   - Educational: caller renders <Footnote>{staticText}</Footnote>
 *   - Reactive: caller guards with `{selected && <Footnote>...</Footnote>}`
 *     so the Footnote is absent when nothing is selected.
 *   - Hybrid: caller chooses default-vs-selected text inline.
 *
 * The component is intentionally dumb — no mode logic, no helper —
 * because all three modes reduce to "render this line or don't".
 */
export default function Footnote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 px-1 text-[12px] leading-relaxed text-light-muted-foreground">
      {children}
    </p>
  );
}
