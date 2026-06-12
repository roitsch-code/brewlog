import type { ReactNode } from "react";
import { gradientCreamScrim } from "@/lib/theme/gradients";

/**
 * Shared coffee-bag image block — ONE rounded-inset treatment everywhere
 * (coffee detail, Save-brew, scan preview): `rounded-3xl`, `object-cover`, and a
 * cream→transparent scrim so an anthracite caption stays legible over any photo.
 * Fixed `h-64`; callers add margins via `className` and overlay a bottom caption
 * via `children`. (The cream scrim is kept for legibility — revisit in the
 * planned palette/"less cream" pass.)
 */
export default function BagPhoto({
  url,
  alt = "Coffee bag",
  className,
  children,
}: {
  url: string;
  alt?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`relative h-64 overflow-hidden rounded-3xl ${className ?? ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt} className="absolute inset-0 h-full w-full object-cover" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: gradientCreamScrim }}
      />
      {children}
    </div>
  );
}
