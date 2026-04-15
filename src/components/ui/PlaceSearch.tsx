"use client";
import { useState, useEffect, useRef } from "react";

interface PlaceResult {
  name: string;
  city: string;
  country: string;
  displayLine: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect: (place: PlaceResult) => void;
}

async function searchPlaces(query: string): Promise<PlaceResult[]> {
  if (query.length < 2) return [];
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=6&featuretype=amenity`;
  const res = await fetch(url, {
    headers: { "Accept-Language": "en", "User-Agent": "BrewLog/1.0" },
  });
  const data = await res.json();
  return data
    .filter((r: Record<string, unknown>) => {
      const type = (r.type as string) || "";
      const cls = (r.class as string) || "";
      return cls === "amenity" || type === "cafe" || type === "coffee_shop" || type === "restaurant" || type === "bar";
    })
    .map((r: Record<string, unknown>) => {
      const addr = (r.address || {}) as Record<string, string>;
      const name = (r.name as string) || (r.display_name as string).split(",")[0];
      const city = addr.city || addr.town || addr.village || addr.municipality || "";
      const country = addr.country || "";
      return {
        name,
        city,
        country,
        displayLine: [city, country].filter(Boolean).join(", "),
      };
    })
    .filter((r: PlaceResult) => r.name);
}

export default function PlaceSearch({ value, onChange, onSelect }: Props) {
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length < 2) { setResults([]); setOpen(false); return; }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchPlaces(value);
        setResults(res);
        setOpen(res.length > 0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={e => { onChange(e.target.value); }}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="e.g. Five Elephant, The Barn..."
          className="w-full bg-brew-surface border border-brew-border rounded-2xl px-4 py-3 text-white text-base placeholder:text-brew-muted focus:outline-none focus:border-white/30 pr-10"
        />
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <svg className="animate-spin h-4 w-4 text-brew-muted" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-brew-elevated border border-brew-border rounded-2xl overflow-hidden shadow-xl">
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => {
                onSelect(r);
                onChange(r.name);
                setOpen(false);
              }}
              className="w-full px-4 py-3 text-left hover:bg-brew-surface transition-colors flex flex-col border-b border-brew-border last:border-0"
            >
              <span className="text-white text-sm font-medium">{r.name}</span>
              {r.displayLine && <span className="text-brew-muted text-xs mt-0.5">{r.displayLine}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
