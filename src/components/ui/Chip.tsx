"use client";
import { cn } from "@/lib/utils/cn";

interface ChipProps {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  size?: "sm" | "md";
  accent?: boolean; // accent label (non-interactive small caps)
  className?: string;
}

/**
 * BrewLog chip primitive — DOT-inspired (spec §7).
 * Resting: glass pill (translucent surface + backdrop-blur + edge),
 *          ink-soft text. Active: accent border + subtle accent fill +
 *          accent text. Accent label is the small-caps non-interactive
 *          variant for "Roaster Intelligence"-style metadata.
 */
export default function Chip({ label, selected, onClick, size = "md", accent, className }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full border transition-all duration-150 active:scale-95 select-none whitespace-nowrap font-medium backdrop-blur-md",
        {
          "px-3 py-1.5 text-sm": size === "sm",
          "px-4 py-2 text-sm": size === "md",
          // Resting — glass pill
          "border-dot-edge bg-dot-s1/50 text-dot-ink-soft hover:bg-dot-s2/60 hover:text-dot-ink":
            !selected && !accent,
          // Active — accent
          "border-dot-accent bg-dot-accent/15 text-dot-accent": selected && !accent,
          // Accent label — non-interactive metadata
          "border-dot-accent/30 bg-dot-accent/10 text-dot-accent text-xs tracking-widest uppercase font-medium cursor-default":
            accent,
        },
        className
      )}
    >
      {label}
    </button>
  );
}
