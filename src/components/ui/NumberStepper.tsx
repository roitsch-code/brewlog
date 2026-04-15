"use client";
import { cn } from "@/lib/utils/cn";

interface NumberStepperProps {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  label?: string;
  decimals?: number;
  className?: string;
}

export default function NumberStepper({
  value, onChange, step = 1, min = 0, max = 9999,
  unit = "", label, decimals = 0, className
}: NumberStepperProps) {
  const display = decimals > 0 ? value.toFixed(decimals) : String(value);

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      {label && <span className="text-xs text-brew-muted uppercase tracking-widest">{label}</span>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - step))}
          className="w-14 h-14 rounded-full bg-brew-surface border border-brew-border text-white text-2xl flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Decrease"
        >
          −
        </button>
        <div className="min-w-[80px] text-center">
          <span className="font-mono-num text-3xl font-medium text-white">{display}</span>
          {unit && <span className="text-brew-muted text-sm ml-1">{unit}</span>}
        </div>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + step))}
          className="w-14 h-14 rounded-full bg-brew-surface border border-brew-border text-white text-2xl flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Increase"
        >
          +
        </button>
      </div>
    </div>
  );
}
