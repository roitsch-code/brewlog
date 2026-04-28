"use client";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Map as LMap, Marker as LMarker } from "leaflet";
import type { CafeSummary, Place } from "@/lib/types/cafes";
import StarRating from "@/components/ui/StarRating";

const geocodeCache = new Map<string, { lat: number; lng: number } | null>();
let nominatimLastMs = 0;

async function geocafe(name: string, location?: string): Promise<{ lat: number; lng: number } | null> {
  const key = `${name}__${location ?? ""}`;
  if (geocodeCache.has(key)) return geocodeCache.get(key) ?? null;

  const wait = Math.max(0, nominatimLastMs + 1100 - Date.now());
  if (wait > 0) await new Promise<void>(r => setTimeout(r, wait));
  nominatimLastMs = Date.now();

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
  } catch { /* network error — skip pin */ }
  geocodeCache.set(key, null);
  return null;
}

const PIN_HTML = `<svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.268 21.732 0 14 0Z" fill="#D4B896"/>
  <circle cx="14" cy="14" r="5" fill="#1A1008"/>
</svg>`;

const GHOST_PIN_HTML = `<svg width="24" height="31" viewBox="-2 -2 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.268 21.732 0 14 0Z" fill="none" stroke="#D4B896" stroke-width="2.5"/>
  <circle cx="14" cy="14" r="4" fill="none" stroke="#D4B896" stroke-width="2"/>
</svg>`;

const YOU_ARE_HERE_HTML = `
<style>@keyframes ect-pulse{0%,100%{box-shadow:0 0 0 5px rgba(255,255,255,0.2)}50%{box-shadow:0 0 0 10px rgba(255,255,255,0.06)}}</style>
<div style="width:12px;height:12px;border-radius:50%;background:#fff;box-shadow:0 0 0 5px rgba(255,255,255,0.2);animation:ect-pulse 1.8s ease-in-out infinite"></div>`;

export default function CafeMap({ cafes, onSelect }: {
  cafes: CafeSummary[];
  onSelect: (cafe: CafeSummary) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LMap | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletRef = useRef<any>(null);
  const markersRef = useRef<LMarker[]>([]);
  const placeMarkersRef = useRef<LMarker[]>([]);
  const userMarkerRef = useRef<LMarker | null>(null);
  const locateMeFnRef = useRef<(() => void) | null>(null);

  const [selected, setSelected] = useState<CafeSummary | null>(null);
  const [placeSelected, setPlaceSelected] = useState<Place | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [locating, setLocating] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [locatingUser, setLocatingUser] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  // Fetch curated places
  useEffect(() => {
    fetch("/api/places")
      .then(r => r.json())
      .then((data: Place[]) => setPlaces(data))
      .catch(() => {});
  }, []);

  // Initialize Leaflet + café pins
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      leafletRef.current = L;

      const map = L.map(containerRef.current, { zoomControl: false, attributionControl: false });
      mapRef.current = map;
      setMapReady(true);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        detectRetina: true,
      }).addTo(map);

      const pinIcon = L.divIcon({ html: PIN_HTML, className: "", iconSize: [28, 36], iconAnchor: [14, 36] });
      const youAreHereIcon = L.divIcon({ html: YOU_ARE_HERE_HTML, className: "", iconSize: [12, 12], iconAnchor: [6, 6] });

      locateMeFnRef.current = () => {
        setLocatingUser(true);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude: lat, longitude: lng } = pos.coords;
            map.flyTo([lat, lng], 15);
            userMarkerRef.current?.remove();
            userMarkerRef.current = L.marker([lat, lng], { icon: youAreHereIcon, zIndexOffset: 1000 }).addTo(map);
            setLocatingUser(false);
          },
          () => {
            setLocateError("Location unavailable");
            setTimeout(() => setLocateError(null), 3000);
            setLocatingUser(false);
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      };

      const placed: LMarker[] = [];
      for (let i = 0; i < cafes.length; i++) {
        if (cancelled) break;

        const cafe = cafes[i];
        const coords = await geocafe(cafe.name, cafe.location);
        if (cancelled || !coords) continue;

        const marker = L.marker([coords.lat, coords.lng], { icon: pinIcon, zIndexOffset: 500 }).addTo(map);
        marker.on("click", () => { setSelected(cafe); setPlaceSelected(null); });
        placed.push(marker);
        markersRef.current = placed;
      }

      if (!cancelled) {
        if (placed.length === 1) {
          map.setView(placed[0].getLatLng(), 14);
        } else if (placed.length > 1) {
          map.fitBounds(L.featureGroup(placed).getBounds().pad(0.25));
        } else {
          map.setView([51.22, 6.78], 12);
        }
        setLocating(false);
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
      markersRef.current = [];
      placeMarkersRef.current = [];
      setMapReady(false);
    };
  }, [cafes]);

  // Add ghost pins for curated places (coordinates come from DB — no client-side geocoding)
  useEffect(() => {
    if (!mapReady || !mapRef.current || !leafletRef.current) return;

    const L = leafletRef.current;
    const map = mapRef.current;

    const ghostIcon = L.divIcon({ html: GHOST_PIN_HTML, className: "", iconSize: [24, 31], iconAnchor: [12, 31] });

    placeMarkersRef.current.forEach(m => m.remove());
    placeMarkersRef.current = [];

    const visitedNames = new Set(cafes.map(c => c.name.toLowerCase().trim()));
    const placed: LMarker[] = [];

    for (const place of places) {
      if (place.lat == null || place.lng == null) continue;
      if (visitedNames.has(place.name.toLowerCase().trim())) continue;

      const marker = L.marker([place.lat, place.lng], { icon: ghostIcon }).addTo(map);
      marker.on("click", () => { setPlaceSelected(place); setSelected(null); });
      placed.push(marker);
    }

    placeMarkersRef.current = placed;
  }, [mapReady, places, cafes]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="absolute inset-0" />

      <div className="absolute bottom-2 right-2 z-[1000] text-white/25 pointer-events-none" style={{ fontSize: "9px" }}>
        © OpenStreetMap · © CARTO
      </div>

      {/* Locate me button */}
      <button
        type="button"
        onClick={() => locateMeFnRef.current?.()}
        disabled={locatingUser}
        aria-label="Locate me"
        className="absolute bottom-14 right-3 z-[1000] w-10 h-10 rounded-full bg-brew-surface/90 border border-brew-border flex items-center justify-center active:scale-95 transition-transform disabled:opacity-60"
      >
        {locatingUser ? (
          <svg className="w-4 h-4 animate-spin text-brew-muted" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-brew-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v2M12 20v2M2 12h2M20 12h2" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        )}
      </button>

      {/* Location error pill */}
      {locateError && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-brew-surface/90 border border-brew-border rounded-full px-3 py-1 text-xs text-brew-muted whitespace-nowrap">
          {locateError}
        </div>
      )}

      {/* Initial loading overlay */}
      {locating && (
        <div className="absolute inset-0 bg-brew-bg flex items-center justify-center z-10">
          <p className="text-brew-muted text-sm">Locating cafés…</p>
        </div>
      )}

      {/* Visited café card */}
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
                <button type="button" onClick={() => setSelected(null)} className="text-brew-muted p-0.5 active:scale-95 transition-transform" aria-label="Close">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <button type="button" onClick={() => onSelect(selected)} className="bg-brew-accent text-brew-accent-fg text-xs font-semibold px-4 py-1.5 rounded-full active:scale-95 transition-transform">
                  View
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Curated place card */}
      {placeSelected && (
        <div className="absolute bottom-4 left-4 right-4 z-[1000]">
          <div className="bg-brew-surface/95 backdrop-blur-sm border border-brew-border rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium leading-tight truncate">{placeSelected.name}</p>
                <p className="text-brew-muted text-xs mt-0.5">{placeSelected.city}</p>
                <p className="text-brew-muted text-xs mt-1.5">Not visited yet</p>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <button type="button" onClick={() => setPlaceSelected(null)} className="text-brew-muted p-0.5 active:scale-95 transition-transform" aria-label="Close">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <a
                  href={`https://maps.google.com/maps?q=${encodeURIComponent(`${placeSelected.name} ${placeSelected.city}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-brew-accent text-brew-accent-fg text-xs font-semibold px-4 py-1.5 rounded-full active:scale-95 transition-transform"
                >
                  Open in Maps
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
