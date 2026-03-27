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
          className={cn(
            "h-1.5 rounded-full transition-all duration-300",
            i === current ? "w-5 bg-white" : i < current ? "w-1.5 bg-white/50" : "w-1.5 bg-white/20"
          )}
        />
      ))}
    </div>
  );
}
