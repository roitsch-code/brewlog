"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { CafeSummary } from "@/lib/types/cafes";

// Leaflet needs `window`; lazy-load client-side only so SSR doesn't
// crash.
const CafeMap = dynamic(() => import("@/components/cafes/CafeMap"), { ssr: false });

/**
 * Nearby — full-screen map view. Markus' /cafes feedback: "Nearby
 * ohne Café und Coffee. Nur Map." Lives under /cafes/map; the
 * navigation overlay's "Nearby" link routes here. Café Library
 * (the saved-list + tasted-coffees tabs) stays on /cafes.
 *
 * The map needs a definitively sized container — the previous
 * Map-as-tab inside /cafes had `min-h-full` upstream which didn't
 * propagate, and the Leaflet container collapsed to 0 height
 * (visible only as the attribution edge in Markus' screenshot).
 * Here we anchor with `h-dvh flex flex-col` so the inner Map fills
 * the entire remaining viewport.
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
    <div className="h-dvh flex flex-col bg-brew-bg overflow-hidden">
      <header
        className="shrink-0 px-5 pb-3 flex items-center justify-between"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
      >
        <Link href="/library" className="flex items-center gap-1 text-brew-muted text-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Library
        </Link>
        <h1 className="font-display text-lg text-white">Nearby</h1>
        <Link href="/cafes" className="text-brew-muted text-xs">
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
