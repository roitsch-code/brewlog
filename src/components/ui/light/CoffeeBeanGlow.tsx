"use client";

/**
 * Light System fork of /components/ui/CoffeeBeanGlow.tsx.
 *
 * Same figure-8 animation across the bean shape — only the stroke
 * colour changes from `#E8C5A8` (warm peach) to anthracite
 * `hsl(0 0% 14%)` so the moving trail is visible on the warm-cream
 * Light Field. The Dark version's peach-on-dark "glow" reads as a
 * peach-on-peach ghost on Light (Markus' /brew/preview screenshot:
 * the bean disappears entirely except for one faintly visible arc).
 *
 * The `<filter>` blur stays — on a dark stroke it now reads as an ink
 * bleed rather than a backlit glow, which fits the Light editorial
 * tone (typed line, not radiant).
 *
 * Static bean outline + crease keep their low opacity (12 / 15 %) so
 * the resting shape is a faint pencil sketch. The animated halo +
 * core layers carry the visible signal.
 */
export default function LightCoffeeBeanGlow({
  size = 80,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const figurePath =
    "M 50,93 C 26,93 14,74 14,50 C 14,26 26,7 50,7" +
    " C 58,28 42,52 50,72 C 56,84 50,93 50,93" +
    " C 74,93 86,74 86,50 C 86,26 74,7 50,7" +
    " C 58,28 42,52 50,72 C 56,84 50,93 50,93";

  const pathLen = 440;
  const glowLen = 65;
  const staticCrease = "M 50,7 C 58,28 42,52 50,72 C 56,84 50,93 50,93";

  const stroke = "hsl(0 0% 14%)";

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
        <filter id="lcbg-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <path
        d="M 14,50 C 14,26 26,7 50,7 C 74,7 86,26 86,50 C 86,74 74,93 50,93 C 26,93 14,74 14,50 Z"
        stroke={stroke}
        strokeOpacity={0.18}
        strokeWidth={1.5}
      />

      <path
        d={staticCrease}
        stroke={stroke}
        strokeOpacity={0.15}
        strokeWidth={1.5}
        strokeLinecap="round"
      />

      <path
        d={figurePath}
        stroke={stroke}
        strokeOpacity={0.45}
        strokeWidth={4.5}
        strokeLinecap="round"
        strokeDasharray={`${glowLen} ${pathLen - glowLen}`}
        filter="url(#lcbg-glow)"
      >
        <animate
          attributeName="stroke-dashoffset"
          from="0"
          to={String(-pathLen)}
          dur="4s"
          repeatCount="indefinite"
        />
      </path>

      <path
        d={figurePath}
        stroke={stroke}
        strokeOpacity={0.85}
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
