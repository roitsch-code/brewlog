"use client";

/**
 * Animated coffee bean — a single warm glow travels in a figure-8:
 *   bottom → up the left outside edge → top →
 *   down the S-curved crease → bottom →
 *   up the right outside edge → top →
 *   down the S-curved crease → bottom → repeat
 *
 * Path is one continuous stroke that covers both halves of the bean
 * plus two crease passes, giving the glow a natural inside/outside rhythm.
 */
export default function CoffeeBeanGlow({
  size = 80,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  // ── figure-8 path ──────────────────────────────────────────────────────
  // Start at bottom-center (50,93), go up the LEFT outside edge to top (50,7),
  // then trace the S-crease DOWN (same bezier as staticCrease, reversed start),
  // then up the RIGHT outside edge to top (50,7),
  // then trace the S-crease DOWN again — full loop.
  //
  // The crease uses the EXACT same control points as staticCrease so the glow
  // follows the drawn line precisely at every point.
  //
  // Crease (50,7 → 50,93): C 58,28 42,52 50,72  C 56,84 50,93 50,93
  // Estimated total path length ≈ 440 px
  const figurePath =
    "M 50,93 C 26,93 14,74 14,50 C 14,26 26,7 50,7" +
    " C 58,28 42,52 50,72 C 56,84 50,93 50,93" +
    " C 74,93 86,74 86,50 C 86,26 74,7 50,7" +
    " C 58,28 42,52 50,72 C 56,84 50,93 50,93";

  const pathLen = 440;
  const glowLen = 65; // visible sweep — ~15% of total path

  // Static crease — identical control points used in figurePath crease segments
  const staticCrease = "M 50,7 C 58,28 42,52 50,72 C 56,84 50,93 50,93";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <filter id="cbg-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Dim static bean outline */}
      <path
        d="M 14,50 C 14,26 26,7 50,7 C 74,7 86,26 86,50 C 86,74 74,93 50,93 C 26,93 14,74 14,50 Z"
        stroke="#F0EDE8" strokeOpacity={0.2} strokeWidth={1.5}
      />

      {/* Dim static S-crease */}
      <path
        d={staticCrease}
        stroke="#F0EDE8" strokeOpacity={0.15} strokeWidth={1.5}
        strokeLinecap="round"
      />

      {/* Halo layer — blurred, wider */}
      <path
        d={figurePath}
        stroke="#F0EDE8"
        strokeOpacity={0.5}
        strokeWidth={4.5}
        strokeLinecap="round"
        strokeDasharray={`${glowLen} ${pathLen - glowLen}`}
        filter="url(#cbg-glow)"
      >
        <animate
          attributeName="stroke-dashoffset"
          from="0"
          to={String(-pathLen)}
          dur="4s"
          repeatCount="indefinite"
        />
      </path>

      {/* Core layer — crisp, bright */}
      <path
        d={figurePath}
        stroke="#F0EDE8"
        strokeOpacity={0.92}
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray={`${glowLen} ${pathLen - glowLen}`}
      >
        <animate
          attributeName="stroke-dashoffset"
          from="0"
          to={String(-pathLen)}
          dur="4s"
          repeatCount="indefinite"
        />
      </path>
    </svg>
  );
}
