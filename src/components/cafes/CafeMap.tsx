"use client";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as LMap, Marker as LMarker } from "leaflet";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import type { CafeSummary, Place, CafeVisit, CafeVisitRating } from "@/lib/types/cafes";
import StarRating from "@/components/ui/light/StarRating";

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

/* ── Marker palette ────────────────────────────────────────────
 * Anthracite (#242424 ≈ light-foreground hsl(0 0% 14%)) + cream
 * (#FAF3ED ≈ hsl(36 55% 96%)) so pins read against Positron's neutral
 * light-gray tiles without needing a brand-color accent.
 *
 *   visited default  → solid anthracite body, cream dot
 *   visited selected → cream body, anthracite ring + dot, slightly larger
 *   ghost default    → outline-only anthracite (unvisited curated places)
 *   ghost selected   → cream fill, anthracite outline + solid dot
 */
const PIN_HTML = `<svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.268 21.732 0 14 0Z" fill="#242424"/>
  <circle cx="14" cy="14" r="5" fill="#FAF3ED"/>
</svg>`;

const PIN_SELECTED_HTML = `<svg width="32" height="40" viewBox="-2 -2 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.268 21.732 0 14 0Z" fill="#FAF3ED" stroke="#242424" stroke-width="2.5"/>
  <circle cx="14" cy="14" r="5" fill="#242424"/>
</svg>`;

const GHOST_PIN_HTML = `<svg width="24" height="31" viewBox="-2 -2 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.268 21.732 0 14 0Z" fill="none" stroke="#242424" stroke-width="2.5"/>
  <circle cx="14" cy="14" r="4" fill="none" stroke="#242424" stroke-width="2"/>
</svg>`;

const GHOST_PIN_SELECTED_HTML = `<svg width="28" height="36" viewBox="-2 -2 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.268 21.732 0 14 0Z" fill="#FAF3ED" stroke="#242424" stroke-width="2.5"/>
  <circle cx="14" cy="14" r="4" fill="#242424"/>
</svg>`;

const YOU_ARE_HERE_HTML = `
<style>@keyframes ect-pulse{0%,100%{box-shadow:0 0 0 5px rgba(36,36,36,0.28)}50%{box-shadow:0 0 0 10px rgba(36,36,36,0.08)}}</style>
<div style="width:12px;height:12px;border-radius:50%;background:#242424;border:2px solid #FAF3ED;box-shadow:0 0 0 5px rgba(36,36,36,0.28);animation:ect-pulse 1.8s ease-in-out infinite"></div>`;

function normalizeName(s: string): string {
  return s.trim().toLowerCase();
}

export default function CafeMap({ cafes, onSelect, initialSearch }: {
  cafes: CafeSummary[];
  onSelect: (cafe: CafeSummary) => void;
  initialSearch?: string;
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
  const [search, setSearch] = useState(initialSearch ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch ?? "");
  const [mapReady, setMapReady] = useState(false);
  const [locatingUser, setLocatingUser] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [nearbyIds, setNearbyIds] = useState<Set<number> | null>(null);

  // Names of cafés the user has already visited — drives whether a curated
  // place renders as a ghost (unvisited) or solid (visited) pin. Seeded from
  // the cafes prop, extended optimistically when a visit is saved via the
  // "I've been here" modal so the marker flips immediately without waiting
  // for /api/cafes to refetch.
  const [visitedNames, setVisitedNames] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    setVisitedNames(prev => {
      const next = new Set(prev);
      for (const c of cafes) next.add(normalizeName(c.name));
      return next;
    });
  }, [cafes]);

  // "I've been here" modal state — opened from the curated-place card.
  const [visitModalPlace, setVisitModalPlace] = useState<Place | null>(null);
  const [visitSaving, setVisitSaving] = useState(false);

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
    // Tracks whether GPS resolved fast enough to position the user. The
    // pin-loop fallback (fit to visited cafés) must NOT override an
    // already-located map even if it finishes after GPS came in.
    let userLocated = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      leafletRef.current = L;

      const map = L.map(containerRef.current, { zoomControl: false, attributionControl: false });
      mapRef.current = map;

      // Positron — Carto's neutral light-gray tile set. Sits cleanly behind
      // anthracite markers + cream cards without competing for attention.
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        detectRetina: true,
      }).addTo(map);

      const pinIcon = L.divIcon({ html: PIN_HTML, className: "", iconSize: [28, 36], iconAnchor: [14, 36] });
      const pinSelectedIcon = L.divIcon({ html: PIN_SELECTED_HTML, className: "", iconSize: [32, 40], iconAnchor: [16, 40] });
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
              map.flyTo([lat, lng], 15);
              setLocateError("No cafés in database for this area yet");
              setTimeout(() => setLocateError(null), 3000);
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

      // Show the map immediately at a sensible default view. The map is
      // interactive from this moment — no blocking overlay, no waiting on
      // GPS. GPS, the tile fetch, and the visited-café geocoding all run
      // in parallel from here. Previous flow awaited GPS before revealing
      // the map, which caused freezes when the iOS permission dialog held
      // JS / setTimeout was throttled / the dynamic import was slow.
      map.setView([51.22, 6.78], 12);
      setMapReady(true);
      // Force Leaflet to measure its container — sizing can be wrong on
      // the first paint after Suspense-style chunk reveal.
      setTimeout(() => { if (mapRef.current) mapRef.current.invalidateSize(); }, 50);

      // GPS request — async, doesn't block anything. When it resolves,
      // pan to the user and drop the pulse marker. If it fails or is
      // denied (or the 5s soft-timeout fires), the pin-loop fallback
      // below takes over.
      (async () => {
        const userPos = await new Promise<{ lat: number; lng: number } | null>(resolve => {
          const timer = setTimeout(() => resolve(null), 5000);
          navigator.geolocation.getCurrentPosition(
            pos => { clearTimeout(timer); resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
            () => { clearTimeout(timer); resolve(null); },
            { enableHighAccuracy: true, timeout: 5000 }
          );
        });
        if (cancelled || !userPos || !mapRef.current) return;
        userLocated = true;
        mapRef.current.setView([userPos.lat, userPos.lng], 14);
        userMarkerRef.current?.remove();
        userMarkerRef.current = L.marker([userPos.lat, userPos.lng], { icon: youAreHereIcon, zIndexOffset: 1000 }).addTo(mapRef.current);
      })();

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

      // After all pins drop: if GPS still hasn't located the user, fit
      // to the visited pins so the user at least sees their own cafés.
      // Otherwise the default Cologne view stays.
      if (!cancelled && !userLocated) {
        if (placed.length === 1) {
          map.setView(placed[0].getLatLng(), 14);
        } else if (placed.length > 1) {
          map.fitBounds(L.featureGroup(placed).getBounds().pad(0.25));
        }
      }
    })().catch(err => {
      // Dynamic import or Leaflet init failed — keep the page usable
      // (header + search work even without a map) and surface the cause.
      console.error("CafeMap init failed:", err);
    });

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

  // Curated-place markers — re-render when the filter changes OR when a new
  // visit is logged (visitedNames change re-paints that place as a solid pin).
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
    const ghostSelectedIcon = L.divIcon({ html: GHOST_PIN_SELECTED_HTML, className: "", iconSize: [28, 36], iconAnchor: [14, 36] });
    const visitedIcon = L.divIcon({ html: PIN_HTML, className: "", iconSize: [28, 36], iconAnchor: [14, 36] });
    const visitedSelectedIcon = L.divIcon({ html: PIN_SELECTED_HTML, className: "", iconSize: [32, 40], iconAnchor: [16, 40] });
    ghostIconRef.current = ghostIcon;

    const placed: LMarker[] = [];

    for (const place of filteredPlaces) {
      if (place.lat == null || place.lng == null) continue;

      const isVisited = visitedNames.has(normalizeName(place.name));
      const defaultIcon = isVisited ? visitedIcon : ghostIcon;
      const selectedIcon = isVisited ? visitedSelectedIcon : ghostSelectedIcon;

      const marker = L.marker([place.lat, place.lng], { icon: defaultIcon }).addTo(map);
      marker.on("click", () => {
        if (selectedPlaceMarkerRef.current) {
          // Reset the previous place marker to its own default icon — look up
          // by name so already-visited pins return to solid, not ghost.
          const prevPlace = (selectedPlaceMarkerRef.current as LMarker & { _placeRef?: Place })._placeRef;
          const prevDefault = prevPlace && visitedNames.has(normalizeName(prevPlace.name))
            ? visitedIcon
            : ghostIcon;
          selectedPlaceMarkerRef.current.setIcon(prevDefault);
        }
        if (selectedMarkerRef.current && pinIconRef.current) {
          selectedMarkerRef.current.setIcon(pinIconRef.current);
          selectedMarkerRef.current = null;
        }
        marker.setIcon(selectedIcon);
        // Stash the place data on the marker so the previous-selection
        // reset above can look up the right default icon.
        (marker as LMarker & { _placeRef?: Place })._placeRef = place;
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
  }, [mapReady, filteredPlaces, debouncedSearch, resultCities, nearbyIds, visitedNames]);

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
      const prevPlace = (selectedPlaceMarkerRef.current as LMarker & { _placeRef?: Place })._placeRef;
      // Look up the right default — visited pins must return to solid, not ghost.
      if (prevPlace && visitedNames.has(normalizeName(prevPlace.name)) && leafletRef.current) {
        selectedPlaceMarkerRef.current.setIcon(
          leafletRef.current.divIcon({ html: PIN_HTML, className: "", iconSize: [28, 36], iconAnchor: [14, 36] })
        );
      } else {
        selectedPlaceMarkerRef.current.setIcon(ghostIconRef.current);
      }
      selectedPlaceMarkerRef.current = null;
    }
    setPlaceSelected(null);
  };

  async function saveVisit(rating: CafeVisitRating) {
    if (!visitModalPlace) return;
    setVisitSaving(true);
    try {
      const location = visitModalPlace.address ?? visitModalPlace.city;
      const res = await fetch("/api/cafe-visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cafeName: visitModalPlace.name,
          location,
          rating,
        }),
      });
      if (res.ok) {
        // Drain the body so the connection closes cleanly; the response
        // payload isn't needed — local visitedNames + marker re-render
        // is the visible confirmation.
        await (res.json() as Promise<CafeVisit>);
        setVisitedNames(prev => {
          const next = new Set(prev);
          next.add(normalizeName(visitModalPlace.name));
          return next;
        });
        setVisitModalPlace(null);
        // Close the place card too so the marker re-render (now solid
        // anthracite) acts as the confirmation — the previously-selected
        // marker is replaced by a fresh default-state one anyway.
        setPlaceSelected(null);
        selectedPlaceMarkerRef.current = null;
      }
    } finally {
      setVisitSaving(false);
    }
  }

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Search input — pushed below the floating page header (Nearby +
          burger live above this in the page layout). */}
      <div
        className="absolute left-4 right-4 z-[1000]"
        style={{ top: "calc(env(safe-area-inset-top) + 4.75rem)" }}
      >
        <div className="relative flex items-center max-w-xs mx-auto">
          <svg className="absolute left-3 w-3.5 h-3.5 text-light-muted-foreground pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setNearbyIds(null); }}
            onKeyDown={e => { if (e.key === "Enter") setDebouncedSearch(search); }}
            placeholder="Search cafés…"
            className="w-full bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 border border-light-foreground/15 text-light-foreground text-sm placeholder:text-light-muted-foreground rounded-full pl-8 pr-8 py-2 focus:outline-none shadow-sm"
          />
          {(search || nearbyIds != null) && (
            <button
              type="button"
              onClick={() => { setSearch(""); setDebouncedSearch(""); setNearbyIds(null); }}
              aria-label="Clear search"
              className="absolute right-2.5 text-light-muted-foreground active:scale-95 transition-transform"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {/* Result count — shown once debounce settles */}
        {(nearbyIds != null || (debouncedSearch.trim() && debouncedSearch === search)) && (
          <p className="text-center text-xs text-light-muted-foreground mt-1.5 pointer-events-none">
            {filteredPlaces.length === 0
              ? "No places found"
              : resultCities.length === 1
              ? `${filteredPlaces.length} in ${resultCities[0]}`
              : `${filteredPlaces.length} found`}
          </p>
        )}
      </div>

      <div className="absolute bottom-2 right-2 z-[1000] text-light-foreground/35 pointer-events-none" style={{ fontSize: "9px" }}>
        © OpenStreetMap · © CARTO
      </div>

      {/* Locate me button */}
      <button
        type="button"
        onClick={() => locateMeFnRef.current?.()}
        disabled={locatingUser}
        aria-label="Locate me"
        className="absolute bottom-14 right-3 z-[1000] w-10 h-10 rounded-full bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 border border-light-foreground/15 flex items-center justify-center active:scale-95 transition-transform disabled:opacity-60"
      >
        {locatingUser ? (
          <svg className="w-4 h-4 animate-spin text-light-muted-foreground" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-light-foreground/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v2M12 20v2M2 12h2M20 12h2" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        )}
      </button>

      {/* Location error pill */}
      {locateError && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 border border-light-foreground/15 rounded-full px-3 py-1 text-xs text-light-muted-foreground whitespace-nowrap">
          {locateError}
        </div>
      )}

      {/* Visited café card */}
      {selected && (
        <div className="absolute bottom-4 left-4 right-4 z-[1000]">
          <div className="bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 border border-light-foreground/15 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-light-foreground font-medium leading-tight truncate">{selected.name}</p>
                {selected.location && (
                  <p className="text-light-muted-foreground text-xs mt-0.5 truncate">{selected.location}</p>
                )}
                <p className="text-light-muted-foreground text-xs mt-0.5">
                  {selected.visits} visit{selected.visits !== 1 ? "s" : ""}
                </p>
                {selected.avgRating !== null && (
                  <div className="mt-1.5">
                    <StarRating value={selected.avgRating} readonly size="sm" />
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <button type="button" onClick={clearSelected} className="text-light-muted-foreground p-0.5 active:scale-95 transition-transform" aria-label="Close">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => onSelect(selected)}
                  className="bg-light-foreground text-[hsl(36_55%_96%)] text-xs font-semibold px-4 py-1.5 rounded-full active:scale-95 transition-transform"
                >
                  View
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Curated place card — meta on top, bottom action row pairs the
          Maps link with the "I've been here" pill on the same vertical
          centre line. Close X anchored to the top-right corner so it
          doesn't push the pill above the Maps link. */}
      {placeSelected && (
        <div className="absolute bottom-4 left-4 right-4 z-[1000]">
          <div className="relative bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 border border-light-foreground/15 rounded-2xl p-4">
            <button
              type="button"
              onClick={clearPlaceSelected}
              aria-label="Close"
              className="absolute top-3 right-3 text-light-muted-foreground p-0.5 active:scale-95 transition-transform"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="pr-8 min-w-0">
              <p className="text-light-foreground font-medium leading-tight truncate">{placeSelected.name}</p>
              <p className="text-light-muted-foreground text-xs mt-0.5 truncate">{placeSelected.city}</p>
            </div>

            <div className="flex items-center justify-between gap-3 mt-3">
              {placeSelected.address ? (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(placeSelected.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-xs text-light-muted-foreground active:scale-95 transition-transform"
                >
                  Open in Maps ↗
                </a>
              ) : <span />}
              <button
                type="button"
                onClick={() => setVisitModalPlace(placeSelected)}
                className="bg-light-foreground text-[hsl(36_55%_96%)] text-xs font-semibold px-4 py-1.5 rounded-full active:scale-95 transition-transform whitespace-nowrap"
              >
                I&apos;ve been here
              </button>
            </div>
          </div>
        </div>
      )}

      {/* "I've been here" rating modal — binary thumbs (come back / won't
          return). Mirrors the modal on /cafes/place/[slug]. */}
      {visitModalPlace && (
        <div
          className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center px-5"
          style={{ background: "rgba(28,22,19,0.45)" }}
          onClick={() => !visitSaving && setVisitModalPlace(null)}
        >
          <div
            className="w-full max-w-sm bg-[hsl(36_55%_96%)] rounded-3xl p-6 space-y-4 mb-6 sm:mb-0"
            onClick={e => e.stopPropagation()}
          >
            <div className="space-y-1">
              <h2 className="font-fraunces text-2xl text-light-foreground leading-tight">How was it?</h2>
              <p className="text-light-muted-foreground text-sm">{visitModalPlace.name}</p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                disabled={visitSaving}
                onClick={() => saveVisit("come-back")}
                className="w-full h-14 rounded-full bg-light-foreground text-[hsl(36_55%_96%)] font-medium flex items-center justify-center gap-3 active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                <ThumbsUp className="w-5 h-5" strokeWidth={1.75} />
                Would come back
              </button>
              <button
                type="button"
                disabled={visitSaving}
                onClick={() => saveVisit("wont-return")}
                className="w-full h-14 rounded-full border border-light-foreground/25 text-light-foreground font-medium flex items-center justify-center gap-3 active:scale-[0.98] transition-transform disabled:opacity-50 bg-light-card-default backdrop-blur-light-card backdrop-saturate-150"
              >
                <ThumbsDown className="w-5 h-5" strokeWidth={1.75} />
                Won&apos;t see me again
              </button>
            </div>
            <button
              type="button"
              disabled={visitSaving}
              onClick={() => setVisitModalPlace(null)}
              className="w-full text-light-muted-foreground text-sm py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
