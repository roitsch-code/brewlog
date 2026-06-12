"use client";

import { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { useFlowStore } from "@/store/flowStore";
import LightFlowShell from "@/components/ui/light/LightFlowShell";
import Hero from "@/components/ui/light/Hero";
import Section from "@/components/ui/light/Section";

/**
 * Light System fork of /components/flow/StepMode.tsx.
 *
 * In the live flow this step is only ever reached when the user picked
 * "Coffee shop" in StepScan (StepScan routes home → context directly,
 * so the mode-card branch of the Dark StepMode is dead code). The
 * Light fork therefore drops the mode-cards UI entirely and is just
 * the place picker — eyebrow + Fraunces question + search + manual
 * input + Continue/Skip.
 *
 * Search powered by Nominatim (OSM), inlined here rather than reusing
 * the Dark PlaceSearch primitive — that one ships with brew-surface /
 * brew-border styling which clashes with the Light glass surfaces.
 * Inlining keeps the styling consistent without forking another
 * primitive into src/components/ui/light/.
 *
 * Back behaviour: onBack returns to "scan" (not the default
 * LightFlowShell behaviour, which would push to "/" because "mode"
 * isn't in the EXTERNAL_STEPS progress array).
 *
 * Mounted ONLY by /app/(light)/brew/preview/page.tsx during migration.
 * Dark /components/flow/StepMode.tsx stays untouched until cut-over.
 */

interface PlaceResult {
  name: string;
  city: string;
  country: string;
  displayLine: string;
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
      const addr = (r.address as Record<string, string>) || {};
      const name = (r.name as string) || ((r.display_name as string) || "").split(",")[0];
      const city = addr.city || addr.town || addr.village || addr.suburb || "";
      const country = addr.country || "";
      const displayLine = [city, country].filter(Boolean).join(", ");
      return { name, city, country, displayLine };
    })
    .filter((p: PlaceResult) => p.name);
}

function LightPlaceSearch({
  value,
  onChange,
  onSelect,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (p: PlaceResult) => void;
}) {
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value || value.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
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
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

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
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-light-muted-foreground"
          strokeWidth={1.75}
          aria-hidden
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="e.g. Five Elephant, The Barn…"
          className="w-full rounded-3xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 pl-11 pr-10 py-3 text-[15px] text-light-foreground placeholder:text-light-muted-foreground/70 outline-none"
        />
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <svg className="animate-spin h-4 w-4 text-light-muted-foreground" fill="none" viewBox="0 0 24 24" aria-hidden>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 rounded-3xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 overflow-hidden">
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(r);
                onChange(r.name);
                setOpen(false);
              }}
              className="w-full px-4 py-3 text-left transition-all active:bg-light-card-selected flex flex-col"
            >
              <span className="text-[15px] font-medium text-light-foreground">{r.name}</span>
              {r.displayLine && (
                <span className="text-[12px] text-light-muted-foreground mt-0.5">{r.displayLine}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LightStepMode() {
  const { setStep, setPlace } = useFlowStore();
  const [placeSearch, setPlaceSearch] = useState("");
  const [placeCity, setPlaceCity] = useState("");
  const [placeManual, setPlaceManual] = useState("");

  const effectivePlaceName = placeSearch.trim() || placeManual.trim();

  const confirmPlace = () => {
    if (effectivePlaceName) {
      setPlace({ name: effectivePlaceName, location: placeCity || undefined });
    }
    setStep("log");
  };

  return (
    <LightFlowShell
      onBack={() => setStep("scan")}
      onNext={confirmPlace}
      nextLabel="Continue"
      nextDisabled={!effectivePlaceName}
    >
      <Hero eyebrow="Coffee Shop" question="Where are you?" />

      <div className="space-y-10">
        <Section
          eyebrow="Find the place"
          footnote={
            placeCity ? (
              <p className="mt-3 px-1 text-[12px] leading-relaxed text-light-muted-foreground">
                {placeCity}
              </p>
            ) : null
          }
        >
          <LightPlaceSearch
            value={placeSearch}
            onChange={setPlaceSearch}
            onSelect={(r) => {
              setPlaceSearch(r.name);
              setPlaceCity(r.displayLine);
            }}
          />
        </Section>

        <Section eyebrow="Or enter manually">
          <input
            type="text"
            value={placeManual}
            onChange={(e) => setPlaceManual(e.target.value)}
            placeholder="e.g. Kaffeerösterei Burg"
            className="w-full rounded-3xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 px-4 py-3 text-[15px] text-light-foreground placeholder:text-light-muted-foreground/70 outline-none"
          />
        </Section>
      </div>

      {/* Skip — log without a place. Subordinate to the CTA above; the
          user can always reach Log without naming the café. */}
      <button
        type="button"
        onClick={() => setStep("log")}
        className="mt-4 w-full text-center text-[13px] text-light-muted-foreground py-2 active:text-light-foreground transition-colors"
      >
        Skip — log without a place
      </button>
    </LightFlowShell>
  );
}
