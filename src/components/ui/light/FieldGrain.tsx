"use client";

// Film grain (fluidity pass §C). One fixed, pointer-events-none layer of
// grayscale feTurbulence noise, blended soft-light at low opacity so it reads
// as "tooth" on the warm cream rather than the haze that overlay + white-noise
// gives on a LIGHT canvas. Static — no per-frame filter cost; the authentic
// film flicker is a later, reduced-motion-gated upgrade.
//
// Opacity is the main taste dial (0.04–0.07); soft-light is the on-brand
// blend, overlay the fallback if it reads too flat on-device.
const NOISE = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`,
);

export default function FieldGrain() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage: `url("data:image/svg+xml,${NOISE}")`,
        backgroundSize: "180px 180px",
        mixBlendMode: "soft-light",
        opacity: 0.09,
      }}
    />
  );
}
