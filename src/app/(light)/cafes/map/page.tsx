"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { CafeSummary } from "@/lib/types/cafes";

// Leaflet needs `window`; lazy-load client-side only so SSR doesn't crash.
const CafeMap = dynamic(() => import("@/components/cafes/CafeMap"), { ssr: false });

/**
 * Nearby — full-screen map. Lives in the (light) route group so it
 * inherits the LightShell scope (anthracite tokens, focus shim). The
 * Field paints behind the map but is fully covered — the route still
 * belongs in the Light tree for consistency now that the tiles + chrome
 * are Light.
 *
 * Leaflet needs a definitively sized container — `h-dvh flex flex-col`
 * here, `flex-1 min-h-0` on the wrapper around <CafeMap />.
 */
export default function CafesMapPage() {
  const router = useRouter();
  const [cafes, setCafes] = useState<CafeSummary[]>([]);

  useEffect(() => {
    fetch("/api/cafes", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: CafeSummary[]) => setCafes(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      <header
        className="shrink-0 px-5 pb-3 flex items-center justify-between"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
      >
        <Link href="/cafes" className="flex items-center gap-1 text-light-muted-foreground text-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Cafés
        </Link>
        <h1 className="font-fraunces text-3xl text-light-foreground leading-none">Nearby</h1>
        <Link href="/cafes" className="text-light-muted-foreground text-xs">
          List →
        </Link>
      </header>

      <div className="flex-1 min-h-0">
        <CafeMap
          cafes={cafes}
          onSelect={(cafe) => router.push(`/cafes/place/${encodeURIComponent(cafe.name)}`)}
        />
      </div>
    </div>
  );
}
