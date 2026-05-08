"use client";
import { cn } from "@/lib/utils/cn";
import { ButtonHTMLAttributes, forwardRef } from "react";
import { gradientButtonPrimary } from "@/lib/theme/gradients";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

/**
 * BrewLog button primitive — DOT-inspired (spec §7).
 *  - primary    : warm gradient fill, dark-warm glyph; the app's main CTA.
 *  - secondary  : glass pill (translucent surface + backdrop-blur + edge).
 *  - ghost      : transparent until press / hover.
 *  - destructive: kept for compat; not part of the redesign vocabulary.
 *
 * All variants use the `rounded-full` pill shape per spec radius scale.
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, className, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center font-medium rounded-full transition-all duration-200 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none select-none",
          {
            // primary — gradient fill
            [`${gradientButtonPrimary} text-dot-on-pill shadow-glow-subtle hover:brightness-[1.05]`]:
              variant === "primary",
            // secondary — glass pill
            "bg-dot-s2/60 backdrop-blur-xl border border-dot-edge text-dot-ink hover:bg-dot-s2/80":
              variant === "secondary",
            // ghost — transparent
            "text-dot-ink hover:bg-dot-edge": variant === "ghost",
            // destructive — unchanged from pre-redesign
            "bg-red-900/50 border border-red-800 text-red-300 hover:bg-red-900/70":
              variant === "destructive",
            // sizes
            "px-4 py-2 text-sm h-9": size === "sm",
            "px-6 py-3 text-base h-12": size === "md",
            "px-8 py-4 text-base h-[52px] w-full": size === "lg",
          },
          className
        )}
        {...props}
      >
        {loading ? (
          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : children}
      </button>
    );
  }
);
Button.displayName = "Button";
export default Button;
