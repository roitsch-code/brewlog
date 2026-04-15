"use client";
import { cn } from "@/lib/utils/cn";

interface ProgressDotsProps {
  total: number;
  current: number;
  className?: string;
}

export default function ProgressDots({ total, current, className }: ProgressDotsProps) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-1.5 w-1.5 rounded-full transition-all duration-300"
          style={{
            background: i === current
              ? "var(--primary)"
              : i < current
              ? "rgba(212,184,150,0.35)"
              : "rgba(255,255,255,0.15)",
          }}
        />
      ))}
    </div>
  );
}
