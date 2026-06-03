"use client";

import type { ReactNode } from "react";
import CTAWarmth from "./CTAWarmth";

/**
 * Light System v1.0 §7.5 — primary CTA (non-sticky).
 *
 * Button: h-14, rounded-full, anthracite fill, cream text, 15/600 label,
 * active:scale-[0.99]. Sits at the end of page content; NOT pinned to
 * the bottom. The spec §7.5 explicitly rejects sticky-bottom CTAs.
 *
 * Wrapper hosts the CTA Warmth (§2.2) as a -z-10 sibling so the warm
 * glow scrolls with the button. Includes safe-area-inset-bottom padding
 * so the button clears the iOS home indicator.
 *
 * `disabled` reduces opacity but keeps the button rendered — the section
 * "completion" affordance is visual, not via absence (§10.5 spec).
 */
interface CTAProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: ReactNode;
}

export default function CTA({ onClick, disabled, loading, children }: CTAProps) {
  return (
    <div className="relative pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <CTAWarmth />
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || loading}
        className="h-14 w-full rounded-full bg-light-foreground text-[15px] font-semibold text-light-text-on-dark active:scale-[0.99] transition-transform disabled:opacity-40 disabled:active:scale-100"
      >
        {children}
      </button>
    </div>
  );
}
