"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Menu } from "lucide-react";
import type { CafeSummary } from "@/lib/types/cafes";
import NavigationOverlay from "@/components/ui/light/NavigationOverlay";

// Leaflet needs `window`; lazy-load client-side only so SSR doesn't crash.
const CafeMap = dynamic(() => import("@/components/cafes/CafeMap"), { ssr: false });

/**
 * Nearby — full-bleed map. The Light Coffee Library pattern (title left,
 * burger right) but anchored as floating chrome over an edge-to-edge map,
 * so there's no hard tonal cut between a cream header bar and the tiles.
 * The map fills 100dvh; a soft cream→transparent scrim at the top keeps
 * the title legible against the warm-tinted Positron tiles.
 */
export default function CafesMapPage() {
  const router = useRouter();
  const [cafes, setCafes] = useState<CafeSummary[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetch("/api/cafes", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: CafeSummary[]) => setCafes(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  return (
    <div className="h-dvh relative overflow-hidden">
      {/* Edge-to-edge map */}
      <div className="absolute inset-0">
        <CafeMap
          cafes={cafes}
          onSelect={(cafe) => router.push(`/cafes/place/${encodeURIComponent(cafe.name)}`)}
        />
      </div>

      {/* Floating header — Coffee Library layout (title left, burger right).
          The status-bar scrim now lives in LightShell so every Light route
          shares the same cream wash up top; the header sits directly on
          the warm-tinted tiles below it. */}
      <div
        className="absolute top-0 left-0 right-0 z-[1100] px-5 flex items-center justify-between"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}
      >
        <h1 className="font-fraunces text-3xl text-light-foreground leading-none">Nearby</h1>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-light-foreground/25 bg-light-card-default text-light-foreground/80 backdrop-blur-[14px] backdrop-saturate-150 active:scale-95 transition-transform"
        >
          <Menu className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </div>

      <NavigationOverlay open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}
