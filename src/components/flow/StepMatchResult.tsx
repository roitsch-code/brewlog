"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFlowStore } from "@/store/flowStore";
import CoffeeBeanGlow from "@/components/ui/CoffeeBeanGlow";
import type { MatchResult } from "@/app/api/match/route";

const LEVEL_LABEL: Record<MatchResult["matchLevel"], string> = {
  great: "Great match",
  good:  "Good match",
  maybe: "Might work",
  avoid: "Not your cup",
};

const LEVEL_COLOR: Record<MatchResult["matchLevel"], string> = {
  great: "text-green-400",
  good:  "text-brew-accent",
  maybe: "text-yellow-400",
  avoid: "text-red-400",
};

const LEVEL_BG: Record<MatchResult["matchLevel"], string> = {
  great: "bg-green-400/10 border-green-400/30",
  good:  "bg-brew-accent/10 border-brew-accent/30",
  maybe: "bg-yellow-400/10 border-yellow-400/30",
  avoid: "bg-red-400/10 border-red-400/30",
};

export default function StepMatchResult() {
  const { draft, setStep } = useFlowStore();
  const router = useRouter();
  const [result, setResult] = useState<MatchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!draft.coffee) { setError(true); setLoading(false); return; }
    fetch("/api/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coffee: draft.coffee }),
    })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data: MatchResult) => setResult(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-svh flex flex-col bg-brew-bg px-5" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}>
      {/* Header */}
      <div className="flex items-center mb-8">
        <button onClick={() => setStep("mode")} className="text-white/60 hover:text-white transition-colors">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Coffee name */}
      <div className="mb-6">
        <p className="label-mono text-brew-muted mb-1">Taste Match</p>
        <h1 className="font-display text-2xl text-white">
          {draft.coffee?.name ?? "This coffee"}
        </h1>
        {draft.coffee?.roaster && (
          <p className="text-brew-muted text-sm mt-0.5">{draft.coffee.roaster}</p>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <CoffeeBeanGlow size={56} />
          <p className="text-brew-muted text-sm">Checking your taste profile…</p>
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
          <p className="text-white font-display text-xl">Couldn&apos;t analyse</p>
          <p className="text-brew-muted text-sm">Check your connection and try again.</p>
          <button
            onClick={() => router.push("/")}
            className="mt-2 text-brew-accent text-sm underline"
          >
            Go home
          </button>
        </div>
      ) : result ? (
        <div className="flex flex-col gap-5 pb-safe pb-8">
          {/* Score badge */}
          <div className={`rounded-2xl border p-5 flex flex-col gap-2 ${LEVEL_BG[result.matchLevel]}`}>
            <div className="flex items-center justify-between">
              <span className={`font-display text-2xl ${LEVEL_COLOR[result.matchLevel]}`}>
                {LEVEL_LABEL[result.matchLevel]}
              </span>
              <span className={`font-mono-num text-3xl font-semibold ${LEVEL_COLOR[result.matchLevel]}`}>
                {result.score}
              </span>
            </div>
            <p className="text-white text-sm leading-relaxed">{result.headline}</p>
          </div>

          {/* Why */}
          {result.reasons.length > 0 && (
            <div className="bg-brew-surface rounded-2xl p-4 space-y-2">
              <p className="label-mono text-brew-muted mb-3">Why</p>
              {result.reasons.map((r, i) => (
                <div key={i} className="flex gap-2.5">
                  <span className="text-brew-accent mt-0.5 shrink-0">·</span>
                  <p className="text-white/80 text-sm leading-relaxed">{r}</p>
                </div>
              ))}
            </div>
          )}

          {/* What to expect */}
          <div className="bg-brew-surface rounded-2xl p-4">
            <p className="label-mono text-brew-muted mb-3">Expect</p>
            <p className="text-white/80 text-sm leading-relaxed">{result.expect}</p>
          </div>

          {/* Caution */}
          {result.caution && (
            <div className="bg-brew-surface rounded-2xl p-4 border border-yellow-400/20">
              <p className="label-mono text-yellow-400/80 mb-3">Heads up</p>
              <p className="text-white/80 text-sm leading-relaxed">{result.caution}</p>
            </div>
          )}

          {/* Freshness note */}
          {result.freshnessNote && (
            <div className="bg-brew-surface rounded-2xl p-4">
              <p className="label-mono text-brew-muted mb-3">Freshness</p>
              <p className="text-white/80 text-sm leading-relaxed">{result.freshnessNote}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3 mt-2">
            <button
              type="button"
              onClick={() => { useFlowStore.getState().setMode("home"); setStep("context"); }}
              className="w-full h-[52px] rounded-xl font-semibold text-base bg-brew-accent text-brew-accent-fg transition-all active:scale-95"
            >
              Brew it at home
            </button>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="w-full h-[52px] rounded-xl font-semibold text-base bg-brew-surface border border-brew-border text-white transition-all active:scale-95"
            >
              Back to home
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
