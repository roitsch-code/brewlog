"use client";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as LMap, Marker as LMarker } from "leaflet";
import type { CafeSummary, Place } from "@/lib/types/cafes";
import StarRating from "@/components/ui/StarRating";

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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

// visited + selected: white body, dark dot
const PIN_SELECTED_HTML = `<svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.268 21.732 0 14 0Z" fill="#FFFFFF"/>
  <circle cx="14" cy="14" r="5" fill="#1A1008"/>
</svg>`;

// not-visited + not-selected: no fill, accent outline, hollow inner dot
const GHOST_PIN_HTML = `<svg width="24" height="31" viewBox="-2 -2 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.268 21.732 0 14 0Z" fill="none" stroke="#D4B896" stroke-width="2.5"/>
  <circle cx="14" cy="14" r="4" fill="none" stroke="#D4B896" stroke-width="2"/>
</svg>`;

// not-visited + selected: white body, accent outline, solid accent dot — distinct from all three above
const GHOST_PIN_SELECTED_HTML = `<svg width="24" height="31" viewBox="-2 -2 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.268 21.732 0 14 0Z" fill="#FFFFFF" stroke="#D4B896" stroke-width="2.5"/>
  <circle cx="14" cy="14" r="4" fill="#D4B896"/>
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
  // Stable refs for icon objects so close-card handlers can reset them
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pinIconRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ghostIconRef = useRef<any>(null);
  const selectedMarkerRef = useRef<LMarker | null>(null);
  const selectedPlaceMarkerRef = useRef<LMarker | null>(null);
  // Always-current cafes ref so Leaflet init effect can use [] deps
  const cafesRef = useRef(cafes);
  cafesRef.current = cafes;

  const [selected, setSelected] = useState<CafeSummary | null>(null);
  const [placeSelected, setPlaceSelected] = useState<Place | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  // Always-current places ref so locate-me (inside [] effect) can read latest places
  const placesRef = useRef(places);
  placesRef.current = places;
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [locating, setLocating] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [locatingUser, setLocatingUser] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [nearbyIds, setNearbyIds] = useState<Set<number> | null>(null);

  // Debounce: marker rebuilds fire 300ms after typing stops
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const filteredPlaces = useMemo(() => {
    if (nearbyIds != null)
      return places.filter(p => nearbyIds.has(p.id) && p.lat != null && p.lng != null);
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      return places.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        (p.address ?? "").toLowerCase().includes(q)
      );
    }
    return [];
  }, [places, debouncedSearch, nearbyIds]);

  const resultCities = useMemo(
    () => Array.from(new Set(filteredPlaces.map(p => p.city))),
    [filteredPlaces]
  );

  // Fetch curated places
  useEffect(() => {
    fetch("/api/places")
      .then(r => r.json())
      .then((data: Place[]) => setPlaces(data))
      .catch(() => {});
  }, []);

  // Initialize Leaflet + visited café pins — runs once on mount.
  // Cafes data is read from cafesRef so this effect doesn't need cafes as a dep
  // (CafeMap only mounts after CafesTab confirms cafes is loaded).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      leafletRef.current = L;

      const map = L.map(containerRef.current, { zoomControl: false, attributionControl: false });
      mapRef.current = map;

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        detectRetina: true,
      }).addTo(map);

      const pinIcon = L.divIcon({ html: PIN_HTML, className: "", iconSize: [28, 36], iconAnchor: [14, 36] });
      const pinSelectedIcon = L.divIcon({ html: PIN_SELECTED_HTML, className: "", iconSize: [28, 36], iconAnchor: [14, 36] });
      const youAreHereIcon = L.divIcon({ html: YOU_ARE_HERE_HTML, className: "", iconSize: [12, 12], iconAnchor: [6, 6] });
      pinIconRef.current = pinIcon;

      locateMeFnRef.current = () => {
        setLocatingUser(true);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude: lat, longitude: lng } = pos.coords;

            userMarkerRef.current?.remove();
            userMarkerRef.current = L.marker([lat, lng], { icon: youAreHereIcon, zIndexOffset: 1000 }).addTo(map);

            const allPlaces = placesRef.current.filter(p => p.lat != null && p.lng != null);

            if (allPlaces.length === 0) {
              map.setView([lat, lng], 14);
              setLocatingUser(false);
              return;
            }

            // Sort all curated places by distance from user
            const sorted = allPlaces
              .map(p => ({ p, dist: haversineKm(lat, lng, p.lat!, p.lng!) }))
              .sort((a, b) => a.dist - b.dist);

            // Small city mode: nearest place <50 km away and whole city fits in 25 → show all
            const nearestCity = sorted[0].p.city;
            const cityPlaces = allPlaces.filter(
              p => p.city.toLowerCase() === nearestCity.toLowerCase()
            );
            const toShow =
              sorted[0].dist < 50 && cityPlaces.length <= 25
                ? cityPlaces
                : sorted.slice(0, 25).map(x => x.p);

            setNearbyIds(new Set(toShow.map(p => p.id)));

            // Fit map to user location + all nearby spots
            const bounds = L.latLngBounds([
              [lat, lng],
              ...toShow.map(p => [p.lat!, p.lng!] as [number, number]),
            ]);
            map.fitBounds(bounds.pad(0.2));

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

      // Request GPS first — map opens at the user's actual location.
      // 5s timeout so a slow fix doesn't block the map indefinitely.
      const userPos = await new Promise<{ lat: number; lng: number } | null>(resolve => {
        const timer = setTimeout(() => resolve(null), 5000);
        navigator.geolocation.getCurrentPosition(
          pos => { clearTimeout(timer); resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
          () => { clearTimeout(timer); resolve(null); },
          { enableHighAccuracy: true, timeout: 5000 }
        );
      });

      // Reveal the map regardless of whether GPS succeeded or the component
      // was cancelled — setLocating(false) must come before the cancelled
      // check so the overlay never gets stuck on screen.
      setLocating(false);
      setMapReady(true);
      // Let the overlay leave the DOM before Leaflet recalculates its size.
      setTimeout(() => { if (mapRef.current) mapRef.current.invalidateSize(); }, 50);

      if (cancelled) return;

      if (userPos) {
        map.setView([userPos.lat, userPos.lng], 14);
        userMarkerRef.current?.remove();
        userMarkerRef.current = L.marker([userPos.lat, userPos.lng], { icon: youAreHereIcon, zIndexOffset: 1000 }).addTo(map);
      }

      // Geocode visited café pins in background — map is already visible
      const placed: LMarker[] = [];
      for (let i = 0; i < cafesRef.current.length; i++) {
        if (cancelled) break;

        const cafe = cafesRef.current[i];
        const coords = await geocafe(cafe.name, cafe.location);
        if (cancelled || !coords) continue;

        const marker = L.marker([coords.lat, coords.lng], { icon: pinIcon, zIndexOffset: 500 }).addTo(map);
        marker.on("click", () => {
          if (selectedMarkerRef.current) selectedMarkerRef.current.setIcon(pinIcon);
          if (selectedPlaceMarkerRef.current && ghostIconRef.current) {
            selectedPlaceMarkerRef.current.setIcon(ghostIconRef.current);
            selectedPlaceMarkerRef.current = null;
          }
          marker.setIcon(pinSelectedIcon);
          selectedMarkerRef.current = marker;
          setSelected(cafe);
          setPlaceSelected(null);
        });
        placed.push(marker);
        markersRef.current = placed;
      }

      // If GPS was unavailable, fall back to fitting visited café pins
      if (!cancelled && !userPos) {
        if (placed.length === 1) {
          map.setView(placed[0].getLatLng(), 14);
        } else if (placed.length > 1) {
          map.fitBounds(L.featureGroup(placed).getBounds().pad(0.25));
        } else {
          map.setView([51.22, 6.78], 12);
        }
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
      markersRef.current = [];
      placeMarkersRef.current = [];
      selectedMarkerRef.current = null;
      selectedPlaceMarkerRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Ghost pins — only renders when debouncedSearch is non-empty
  useEffect(() => {
    if (!mapReady || !mapRef.current || !leafletRef.current) return;

    const L = leafletRef.current;
    const map = mapRef.current;

    // Always clear stale ghost pins
    placeMarkersRef.current.forEach(m => m.remove());
    placeMarkersRef.current = [];
    selectedPlaceMarkerRef.current = null;

    if (!debouncedSearch.trim() && nearbyIds == null) return;

    const ghostIcon = L.divIcon({ html: GHOST_PIN_HTML, className: "", iconSize: [24, 31], iconAnchor: [12, 31] });
    const ghostSelectedIcon = L.divIcon({ html: GHOST_PIN_SELECTED_HTML, className: "", iconSize: [24, 31], iconAnchor: [12, 31] });
    ghostIconRef.current = ghostIcon;

    const visitedNames = new Set(cafesRef.current.map(c => c.name.toLowerCase().trim()));
    const placed: LMarker[] = [];

    for (const place of filteredPlaces) {
      if (place.lat == null || place.lng == null) continue;
      if (visitedNames.has(place.name.toLowerCase().trim())) continue;

      const marker = L.marker([place.lat, place.lng], { icon: ghostIcon }).addTo(map);
      marker.on("click", () => {
        if (selectedPlaceMarkerRef.current) selectedPlaceMarkerRef.current.setIcon(ghostIcon);
        if (selectedMarkerRef.current && pinIconRef.current) {
          selectedMarkerRef.current.setIcon(pinIconRef.current);
          selectedMarkerRef.current = null;
        }
        marker.setIcon(ghostSelectedIcon);
        selectedPlaceMarkerRef.current = marker;
        setPlaceSelected(place);
        setSelected(null);
      });
      placed.push(marker);
    }

    placeMarkersRef.current = placed;

    // Only fit bounds in text-search mode — locate-me already fits bounds
    // to include the user marker, and we don't want to override that.
    if (placed.length > 0 && nearbyIds == null) {
      map.fitBounds(L.featureGroup(placed).getBounds().pad(0.3));
    }
  }, [mapReady, filteredPlaces, debouncedSearch, resultCities, nearbyIds]);

  // Geocode the search query and pan there only when there are no curated
  // matches at all — fallback so typing a city/address still moves the map.
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const q = debouncedSearch.trim();
    if (!q) return;
    if (filteredPlaces.length > 0) return;

    let cancelled = false;
    (async () => {
      const wait = Math.max(0, nominatimLastMs + 1100 - Date.now());
      if (wait > 0) await new Promise<void>(r => setTimeout(r, wait));
      if (cancelled) return;
      nominatimLastMs = Date.now();

      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`,
          { headers: { "User-Agent": "BrewLog-CafeMap/1.0" } }
        );
        const data = (await res.json()) as Array<{ lat: string; lon: string }>;
        if (cancelled || !data[0] || !mapRef.current) return;
        mapRef.current.setView([parseFloat(data[0].lat), parseFloat(data[0].lon)], 12);
      } catch { /* offline or failed — silent */ }
    })();

    return () => { cancelled = true; };
  }, [mapReady, debouncedSearch, filteredPlaces.length, resultCities.length]);

  const clearSelected = () => {
    if (selectedMarkerRef.current && pinIconRef.current) {
      selectedMarkerRef.current.setIcon(pinIconRef.current);
      selectedMarkerRef.current = null;
    }
    setSelected(null);
  };

  const clearPlaceSelected = () => {
    if (selectedPlaceMarkerRef.current && ghostIconRef.current) {
      selectedPlaceMarkerRef.current.setIcon(ghostIconRef.current);
      selectedPlaceMarkerRef.current = null;
    }
    setPlaceSelected(null);
  };

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Search input */}
      <div className="absolute top-4 left-4 right-4 z-[1000]">
        <div className="relative flex items-center max-w-xs mx-auto">
          <svg className="absolute left-3 w-3.5 h-3.5 text-brew-muted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setNearbyIds(null); }}
            onKeyDown={e => { if (e.key === "Enter") setDebouncedSearch(search); }}
            placeholder="Search cafés…"
            className="w-full bg-brew-elevated border border-brew-accent/30 text-white text-sm placeholder-brew-muted rounded-full pl-8 pr-8 py-2 focus:outline-none focus:border-brew-accent shadow-lg shadow-black/70"
          />
          {(search || nearbyIds != null) && (
            <button
              type="button"
              onClick={() => { setSearch(""); setDebouncedSearch(""); setNearbyIds(null); }}
              aria-label="Clear search"
              className="absolute right-2.5 text-brew-muted active:scale-95 transition-transform"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {/* Result count — shown once debounce settles */}
        {(nearbyIds != null || (debouncedSearch.trim() && debouncedSearch === search)) && (
          <p className="text-center text-xs text-brew-muted mt-1.5 pointer-events-none">
            {filteredPlaces.length === 0
              ? "No places found"
              : resultCities.length === 1
              ? `${filteredPlaces.length} in ${resultCities[0]}`
              : `${filteredPlaces.length} found`}
          </p>
        )}
      </div>

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
          <p className="text-brew-muted text-sm">Finding your location…</p>
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
                <button type="button" onClick={clearSelected} className="text-brew-muted p-0.5 active:scale-95 transition-transform" aria-label="Close">
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
                <button type="button" onClick={clearPlaceSelected} className="text-brew-muted p-0.5 active:scale-95 transition-transform" aria-label="Close">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(placeSelected.address ?? `${placeSelected.name} ${placeSelected.city}`)}`}
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
