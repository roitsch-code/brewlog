"use client";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Map as LMap, Marker as LMarker } from "leaflet";
import type { CafeSummary } from "@/lib/types/cafes";
import StarRating from "@/components/ui/StarRating";

const geocodeCache = new Map<string, { lat: number; lng: number } | null>();

async function geocafe(name: string, location?: string): Promise<{ lat: number; lng: number } | null> {
  const key = `${name}__${location ?? ""}`;
  if (geocodeCache.has(key)) return geocodeCache.get(key) ?? null;

  const q = location ? `${name}, ${location}` : name;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`,
      { headers: { "User-Agent": "BrewLog-CafeMap/1.0" } }
    );
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (data[0]) {
      const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      geocodeCache.set(key, coords);
      return coords;
    }
  } catch { /* network errors — leave pin off the map */ }
  geocodeCache.set(key, null);
  return null;
}

const PIN_HTML = `<svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.268 21.732 0 14 0Z" fill="#D4B896"/>
  <circle cx="14" cy="14" r="5" fill="#1A1008"/>
</svg>`;

export default function CafeMap({ cafes, onSelect }: {
  cafes: CafeSummary[];
  onSelect: (cafe: CafeSummary) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LMap | null>(null);
  const markersRef = useRef<LMarker[]>([]);
  const [selected, setSelected] = useState<CafeSummary | null>(null);
  const [locating, setLocating] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
      });
      mapRef.current = map;

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        detectRetina: true,
      }).addTo(map);

      const pinIcon = L.divIcon({
        html: PIN_HTML,
        className: "",
        iconSize: [28, 36],
        iconAnchor: [14, 36],
      });

      const placed: LMarker[] = [];

      for (let i = 0; i < cafes.length; i++) {
        if (i > 0) await new Promise<void>(r => setTimeout(r, 1100));
        if (cancelled) break;

        const cafe = cafes[i];
        const coords = await geocafe(cafe.name, cafe.location);
        if (cancelled || !coords) continue;

        const marker = L.marker([coords.lat, coords.lng], { icon: pinIcon }).addTo(map);
        marker.on("click", () => setSelected(cafe));
        placed.push(marker);
        markersRef.current = placed;
      }

      if (!cancelled) {
        if (placed.length === 1) {
          map.setView(placed[0].getLatLng(), 14);
        } else if (placed.length > 1) {
          const group = L.featureGroup(placed);
          map.fitBounds(group.getBounds().pad(0.25));
        } else {
          map.setView([51.22, 6.78], 12); // Düsseldorf fallback
        }
        setLocating(false);
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = [];
    };
  }, [cafes]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Attribution */}
      <div
        className="absolute bottom-2 right-2 z-[1000] text-white/25 pointer-events-none"
        style={{ fontSize: "9px" }}
      >
        © OpenStreetMap · © CARTO
      </div>

      {locating && (
        <div className="absolute inset-0 bg-brew-bg flex items-center justify-center z-10">
          <p className="text-brew-muted text-sm">Locating cafés…</p>
        </div>
      )}

      {selected && (
        <div className="absolute bottom-4 left-4 right-4 z-[1000]">
          <div className="bg-brew-surface/95 backdrop-blur-sm border border-brew-border rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium leading-tight truncate">{selected.name}</p>
                {selected.location && (
                  <p className="text-brew-muted text-xs mt-0.5 truncate">{selected.location}</p>
                )}
                <p className="text-brew-muted text-xs mt-0.5">
                  {selected.visits} visit{selected.visits !== 1 ? "s" : ""}
                </p>
                {selected.avgRating !== null && (
                  <div className="mt-1.5">
                    <StarRating value={selected.avgRating} readonly size="sm" />
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="text-brew-muted p-0.5 active:scale-95 transition-transform"
                  aria-label="Close"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => onSelect(selected)}
                  className="bg-brew-accent text-brew-accent-fg text-xs font-semibold px-4 py-1.5 rounded-full active:scale-95 transition-transform"
                >
                  View
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
