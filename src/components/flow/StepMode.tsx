"use client";
import { useState } from "react";
import Image from "next/image";
import { useFlowStore } from "@/store/flowStore";
import PlaceSearch from "@/components/ui/PlaceSearch";

const MODES = [
  {
    id: "home" as const,
    label: "Brew at Home",
    sub: "Get a recipe recommendation, brew with a timer, document the result.",
    img: "/images/mode-home.jpg",
  },
  {
    id: "external" as const,
    label: "Coffee Shop",
    sub: "Visiting a café? Document what you had and how it tasted.",
    img: "/images/mode-external.jpg",
  },
  {
    id: "match" as const,
    label: "Check Match",
    sub: "Considering a purchase? See how well this coffee fits your taste profile.",
    img: "/images/mode-home.jpg", // reuse until a dedicated image is added
  },
];

export default function StepMode() {
  const { setMode, setStep, setPlace, draft } = useFlowStore();
  const [placeSearch, setPlaceSearch] = useState("");
  const [placeCity, setPlaceCity] = useState("");
  const [placeManual, setPlaceManual] = useState("");
  // If mode is already set to "external" (set from StepScan), go straight to place entry
  const [showPlaceEntry, setShowPlaceEntry] = useState(draft.mode === "external");

  const effectivePlaceName = placeSearch.trim() || placeManual.trim();

  const choose = (mode: "home" | "external" | "match") => {
    setMode(mode);
    if (mode === "home") {
      setStep("context");
    } else if (mode === "external") {
      setShowPlaceEntry(true);
    } else {
      setStep("match_result");
    }
  };

  const confirmPlace = () => {
    if (effectivePlaceName) {
      setPlace({ name: effectivePlaceName, location: placeCity || undefined });
    }
    setStep("log");
  };

  const goBack = () => {
    if (showPlaceEntry) {
      setShowPlaceEntry(false);
      setMode("home"); // reset to default
    } else {
      setStep("scan");
    }
  };

  return (
    <div className="min-h-svh flex flex-col bg-brew-bg px-5 pt-safe">
      {/* Back button */}
      <div className="flex items-center pt-4 pb-6">
        <button onClick={goBack} className="text-white/60 hover:text-white transition-colors">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {!showPlaceEntry ? (
        <div className="flex-1 flex flex-col gap-8 pb-8">
          {/* Title */}
          <div>
            <p className="label-mono text-brew-muted mb-2">
              {draft.coffee?.name || draft.coffee?.roaster
                ? `${draft.coffee.roaster ?? ""}${draft.coffee.roaster && draft.coffee.name ? " · " : ""}${draft.coffee.name ?? ""}`
                : "New Session"}
            </p>
            <h1 className="font-display text-2xl text-white">What&apos;s the occasion?</h1>
          </div>

          {/* Options */}
          <div className="flex flex-col gap-4">
            {MODES.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => choose(m.id)}
                className="w-full rounded-2xl overflow-hidden border border-brew-border text-left transition-all active:scale-[0.98] hover:border-white/30 relative"
              >
                <div className="relative h-40 w-full bg-brew-surface">
                  <Image
                    src={m.img}
                    alt={m.label}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 480px"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h2 className="font-display text-xl text-white leading-tight mb-0.5">{m.label}</h2>
                  <p className="text-white/60 text-sm leading-snug">{m.sub}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-6 pb-8">
          {/* Title */}
          <div>
            <p className="label-mono text-brew-muted mb-2">Coffee Shop</p>
            <h1 className="font-display text-2xl text-white">Where are you?</h1>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-white/60 text-xs mb-1.5">Search</p>
              <PlaceSearch
                value={placeSearch}
                onChange={setPlaceSearch}
                onSelect={r => { setPlaceSearch(r.name); setPlaceCity(r.displayLine); }}
              />
              {placeCity && (
                <p className="text-brew-muted text-xs mt-1.5 px-1">{placeCity}</p>
              )}
            </div>
            <div>
              <p className="text-white/60 text-xs mb-1.5">Or enter manually</p>
              <input
                type="text"
                value={placeManual}
                onChange={e => setPlaceManual(e.target.value)}
                placeholder="e.g. Kaffeerösterei Burg"
                className="w-full bg-brew-surface border border-brew-border rounded-2xl px-4 py-3 text-white text-base placeholder:text-brew-muted focus:outline-none focus:border-white/30"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={confirmPlace}
            disabled={!effectivePlaceName}
            className="w-full h-[52px] rounded-xl font-semibold text-base bg-brew-accent text-brew-accent-fg transition-all active:scale-95 disabled:opacity-40"
          >
            Continue →
          </button>

          <button
            type="button"
            onClick={() => { setStep("log"); }}
            className="text-brew-muted text-sm text-center"
          >
            Skip — log without a place
          </button>
        </div>
      )}
    </div>
  );
}
