"use client";

import { useId } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Light System fork of /components/ui/StarRating.tsx.
 *
 * Same interaction model — left-half / right-half tap for .5 steps,
 * read-only mode disables. Only the palette changes:
 *   - Empty star outline: foreground at 15% (warm-near-black, subtle)
 *   - Filled star: foreground (warm-near-black, full opacity)
 *
 * Lives alongside the Dark StarRating so /coffees/[id], /brew/[id],
 * /taste keep their unchanged Dark presentation per the migration
 * plan. Brew flow steps that need stars import this Light fork.
 */
interface StarRatingProps {
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
  size?: "sm" | "md" | "lg";
}

const STAR_POINTS = "12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26";
const EMPTY_STROKE = "hsl(0 0% 14% / 0.25)";
const FILLED_FILL = "hsl(0 0% 14%)";

export default function LightStarRating({ value, onChange, readonly, size = "md" }: StarRatingProps) {
  const uid = useId();
  const starSize = size === "sm" ? "w-5 h-5" : size === "lg" ? "w-10 h-10" : "w-8 h-8";

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = value >= star;
        const half = !filled && value >= star - 0.5;
        const clipId = `${uid}-half-${star}`;

        return (
          <button
            key={star}
            type="button"
            disabled={readonly}
            onClick={
              readonly
                ? undefined
                : (e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const isLeftHalf = e.clientX - rect.left < rect.width / 2;
                    onChange?.(isLeftHalf ? star - 0.5 : star);
                  }
            }
            className={cn("transition-transform active:scale-90", readonly && "cursor-default")}
            aria-label={`${star} star`}
          >
            <svg className={cn(starSize, "transition-colors")} viewBox="0 0 24 24" strokeWidth="1.5" fill="none">
              {half && (
                <defs>
                  <clipPath id={clipId}>
                    <rect x="0" y="0" width="12" height="24" />
                  </clipPath>
                </defs>
              )}
              <polygon points={STAR_POINTS} fill="none" stroke={EMPTY_STROKE} />
              {(filled || half) && (
                <polygon
                  points={STAR_POINTS}
                  fill={FILLED_FILL}
                  stroke={FILLED_FILL}
                  clipPath={half ? `url(#${clipId})` : undefined}
                />
              )}
            </svg>
          </button>
        );
      })}
    </div>
  );
}
