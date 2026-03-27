"use client";
import { cn } from "@/lib/utils/cn";

interface ChipProps {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  size?: "sm" | "md";
  accent?: boolean; // amber accent chip (for labels)
  className?: string;
}

export default function Chip({ label, selected, onClick, size = "md", accent, className }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full border transition-all duration-150 active:scale-95 select-none whitespace-nowrap font-medium",
        {
          "px-3 py-1.5 text-sm": size === "sm",
          "px-4 py-2 text-sm": size === "md",
          // Unselected
          "border-white/20 text-white/60 bg-transparent hover:border-white/40 hover:text-white": !selected && !accent,
          // Selected
          "border-brew-accent bg-brew-accent/20 text-brew-accent": selected && !accent,
          // Accent label (non-interactive)
          "border-brew-accent/30 bg-brew-accent/10 text-brew-accent text-xs tracking-widest uppercase font-medium cursor-default": accent,
        },
        className
      )}
    >
      {label}
    </button>
  );
}
