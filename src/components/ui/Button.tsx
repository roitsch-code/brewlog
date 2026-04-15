"use client";
import { cn } from "@/lib/utils/cn";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, className, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center font-medium rounded-full transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:pointer-events-none select-none",
          {
            // Variants
            "bg-brew-accent text-brew-accent-fg hover:bg-brew-accent/90": variant === "primary",
            "bg-brew-surface border border-brew-border text-white hover:bg-brew-elevated": variant === "secondary",
            "text-white hover:bg-white/10": variant === "ghost",
            "bg-red-900/50 border border-red-800 text-red-300 hover:bg-red-900/70": variant === "destructive",
            // Sizes
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
