"use client";
import { useState, useEffect } from "react";
import { useFlowStore } from "@/store/flowStore";
import { useRouter } from "next/navigation";
import StarRating from "@/components/ui/StarRating";
import Chip from "@/components/ui/Chip";
import CoffeeBeanGlow from "@/components/ui/CoffeeBeanGlow";
import BrewMethodIcon from "@/components/ui/BrewMethodIcon";

export default function StepSummary() {
  const { draft, reset } = useFlowStore();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [terrain, setTerrain] = useState<string | null>(null);
  const [adjustment, setAdjustment] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const router = useRouter();

  // Fetch Claude insight once on mount (non-blocking)
  useEffect(() => {
    if (!draft.result?.rating) return;
    setInsightLoading(true);
    fetch("/api/brew-insight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draft, recentSessions: [] }),
    })
      .then(r => r.json())
      .then(d => { setTerrain(d.terrain || null); setAdjustment(d.adjustment || null); })
      .catch(() => {})
      .finally(() => setInsightLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          type: "coffee",
          createdAt: new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || `Save failed (${res.status})`);
      }
      setSaved(true);
      setTimeout(() => { reset(); router.push("/"); }, 1500);
    } catch (err) {
      console.error("Session save error:", err);
      setSaveError(err instanceof Error ? err.message : "Failed to save — please try again");
    } finally {
      setSaving(false);
    }
  };

  const coffee = draft.coffee;
  const result = draft.result;
  const brew   = draft.brew;
  const rec    = draft.recommendation;

  return (
    <div className="min-h-svh bg-brew-bg flex flex-col">
      {saved ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-5">
          {/* Coffee bean icon with subtle glow */}
          <div className="relative">
            <svg className="w-16 h-16 text-brew-accent/80" fill="none" viewBox="0 0 100 100">
              <path d="M14,50 C14,26 26,7 50,7 C74,7 86,26 86,50 C86,74 74,93 50,93 C26,93 14,74 14,50 Z"
                stroke="currentColor" strokeWidth="6" fill="none" />
              <path d="M50,7 C43,29 57,61 50,93" stroke="currentColor" strokeWidth="5" />
            </svg>
            {/* Small checkmark badge */}
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-brew-accent flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-brew-bg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <div className="text-center">
            <p className="font-display text-3xl text-white">Logged</p>
            <p className="text-brew-muted text-sm mt-1">Session saved to your diary</p>
          </div>
        </div>
      ) : (
        <>
          {/* Hero */}
          <div className="relative">
            {coffee?.bagPhotoUrl ? (
              <div className="relative h-64">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coffee.bagPhotoUrl} alt="Coffee bag" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 card-scrim" />
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <h2 className="font-display text-3xl text-white">{coffee.name || "Unknown Coffee"}</h2>
                  <p className="text-white/60 text-sm mt-1">{coffee.roaster}</p>
                </div>
              </div>
            ) : (
              <div className="bg-brew-surface px-5 py-8">
                <h2 className="font-display text-3xl text-white">{coffee?.name || "Coffee Session"}</h2>
                <p className="text-white/60 text-sm mt-1">{coffee?.roaster}</p>
              </div>
            )}
          </div>

          <div className="px-5 py-5 flex flex-col gap-5 flex-1">
            {/* Rating */}
            {result?.rating && (
              <div className="flex items-center gap-3">
                <StarRating value={result.rating} readonly size="md" />
                <span className="text-white font-medium">{result.rating} / 5</span>
              </div>
            )}

            {/* Escher insight card — teaching moment after the brew */}
            {(insightLoading || terrain || adjustment) && (
              <div className="bg-brew-elevated rounded-2xl p-4 border border-brew-border/50 space-y-3">
                {insightLoading ? (
                  <div className="flex items-start gap-3">
                    <CoffeeBeanGlow size={24} className="shrink-0 mt-0.5" />
                    <p className="text-brew-muted text-sm italic">Reading the session…</p>
                  </div>
                ) : (
                  <>
                    {terrain && (
                      <div className="flex items-start gap-3">
                        <svg className="w-4 h-4 shrink-0 mt-0.5 text-brew-accent/70" fill="none" viewBox="0 0 100 100">
                          <path d="M14,50 C14,26 26,7 50,7 C74,7 86,26 86,50 C86,74 74,93 50,93 C26,93 14,74 14,50 Z"
                            stroke="currentColor" strokeWidth="8" />
                          <path d="M50,7 C43,29 57,61 50,93" stroke="currentColor" strokeWidth="6" />
                        </svg>
                        <p className="text-white text-sm leading-relaxed italic">{terrain}</p>
                      </div>
                    )}
                    {adjustment && (
                      <div className={`${terrain ? "border-t border-brew-border/40 pt-3" : ""} flex items-start gap-3`}>
                        <div className="w-4 h-4 shrink-0 mt-0.5 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-brew-accent/50" />
                        </div>
                        <p className="text-white/70 text-sm leading-relaxed">{adjustment}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Coffee info */}
            {coffee && (
              <div className="bg-brew-surface rounded-2xl p-4 space-y-2">
                {coffee.origin && <InfoRow label="Origin" value={[coffee.origin, coffee.region].filter(Boolean).join(" · ")} />}
                {coffee.process && <InfoRow label="Process" value={coffee.process} />}
                {coffee.roastLevel && <InfoRow label="Roast" value={coffee.roastLevel} />}
              </div>
            )}

            {/* Recipe */}
            {rec && brew?.methodUsed && (
              <div className="bg-brew-surface rounded-2xl p-4">
                <p className="text-brew-muted text-xs uppercase tracking-widest mb-2">Recipe</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <BrewMethodIcon method={brew.methodUsed} className="w-4 h-4 shrink-0" />
                  <p className="text-white text-sm">
                    {brew.methodUsed} · {rec.primaryRecipe.doseGrams}g / {rec.primaryRecipe.waterGrams}g · {rec.primaryRecipe.waterTempC}°C
                  </p>
                </div>
              </div>
            )}

            {/* Flavors */}
            {result?.flavorNotes && result.flavorNotes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {result.flavorNotes.map(f => <Chip key={f} label={f} selected size="sm" />)}
              </div>
            )}

            {/* Notes */}
            {result?.freeNotes && (
              <p className="text-white/60 text-sm italic leading-relaxed">&ldquo;{result.freeNotes}&rdquo;</p>
            )}
          </div>

          {/* Save button */}
          <div className="px-5 py-4 pb-safe flex flex-col gap-3">
            {saveError && (
              <p className="text-red-400 text-sm text-center leading-snug">{saveError}</p>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full h-14 rounded-full bg-white text-black font-semibold text-base active:scale-95 transition-all disabled:opacity-60"
            >
              {saving ? "Saving…" : saveError ? "Retry" : "Save Brew"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-brew-muted text-sm shrink-0">{label}</span>
      <span className="text-white text-sm text-right">{value}</span>
    </div>
  );
}
