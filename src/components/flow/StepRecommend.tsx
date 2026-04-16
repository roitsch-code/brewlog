"use client";
import { useState, useEffect, useRef } from "react";
import { useFlowStore } from "@/store/flowStore";
import FlowShell from "./FlowShell";
import { formatSeconds } from "@/lib/utils/formatTime";
import CoffeeBeanGlow from "@/components/ui/CoffeeBeanGlow";
import BrewMethodIcon from "@/components/ui/BrewMethodIcon";
import { getLoadingHints, COFFEE_HINTS } from "@/lib/coffeeHints";
import type { RecommendationCandidate, CandidateRole, CandidateConfidence } from "@/lib/types/session";

function shuffleSubset(arr: string[], count: number): string[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

const ROLE_LABELS: Record<CandidateRole, string> = {
  anchor:           "Anchor",
  adjacent:         "Adjacent",
  contrast:         "Contrast",
  "clarity-probe":  "Clarity",
  "sweetness-probe":"Sweetness",
  "body-probe":     "Body",
  wildcard:         "Wildcard",
};

const ROLE_STYLE: Record<CandidateRole, string> = {
  anchor:           "text-white border-white/20 bg-white/8",
  adjacent:         "text-white/60 border-white/15 bg-white/5",
  contrast:         "text-white/50 border-white/10 bg-white/4",
  "clarity-probe":  "text-brew-accent border-brew-accent/30 bg-brew-accent/8",
  "sweetness-probe":"text-amber-300 border-amber-300/30 bg-amber-300/8",
  "body-probe":     "text-orange-300 border-orange-300/30 bg-orange-300/8",
  wildcard:         "text-white/35 border-white/10 bg-white/4",
};

const CONFIDENCE_STYLE: Record<CandidateConfidence, string> = {
  high:        "text-brew-accent",
  moderate:    "text-white/50",
  low:         "text-white/30",
  exploratory: "text-amber-300/70",
};

const CONFIDENCE_LABELS: Record<CandidateConfidence, string> = {
  high:        "High confidence",
  moderate:    "Moderate",
  low:         "Low confidence",
  exploratory: "Exploratory",
};

export default function StepRecommend() {
  const { draft, setStep, isRecommending, recommendError, setBrew } = useFlowStore();
  const rec = draft.recommendation;
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [showAdjustments, setShowAdjustments] = useState(false);

  // Cycling hints during loading
  const [hints, setHints] = useState<string[]>(() => getLoadingHints(8));
  const [hintIdx, setHintIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/hints")
      .then(r => (r.ok ? r.json() : null))
      .then((data: { hints: string[] } | null) => {
        if (cancelled) return;
        if (data && Array.isArray(data.hints) && data.hints.length >= 8) {
          setHints(shuffleSubset(data.hints, 8));
        } else {
          setHints(shuffleSubset(COFFEE_HINTS, 8));
        }
      })
      .catch(() => { if (!cancelled) setHints(shuffleSubset(COFFEE_HINTS, 8)); });
    return () => { cancelled = true; };
  }, []);

  const hintTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (isRecommending) {
      hintTimer.current = setInterval(() => setHintIdx(i => (i + 1) % hints.length), 10000);
    } else {
      if (hintTimer.current) clearInterval(hintTimer.current);
    }
    return () => { if (hintTimer.current) clearInterval(hintTimer.current); };
  }, [isRecommending, hints.length]);

  // Reset state when a new recommendation arrives
  useEffect(() => {
    setSelectedIdx(0);
    setShowAdjustments(false);
  }, [rec?.generatedAt]);

  const candidates: RecommendationCandidate[] = rec?.candidates ?? [];
  const active = candidates[selectedIdx];
  const activeRecipe = active?.recipe;
  const activeMethod = active?.method;

  const handleUse = () => {
    if (!activeMethod || !activeRecipe) return;
    setBrew({ methodUsed: activeMethod, followedRecipe: true });
    setStep("brew");
  };

  // ── Loading state ──────────────────────────────────────────────────────
  if (isRecommending) {
    return (
      <div className="min-h-svh bg-brew-bg flex flex-col items-center justify-center px-8 gap-0">
        <CoffeeBeanGlow size={72} />
        <p className="text-white/40 text-xs tracking-widest uppercase mt-8">Crafting your recipe…</p>
        <div className="mt-12 max-w-xs mx-auto w-full text-center space-y-2 min-h-[6rem] flex flex-col items-center justify-start">
          <p className="text-white/40 text-xs tracking-widest uppercase">Did you know?</p>
          <p key={hintIdx} className="text-white/60 text-xs leading-relaxed text-center animate-hint-cycle">
            {hints[hintIdx]}
          </p>
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────
  if (recommendError) {
    return (
      <div className="min-h-svh bg-brew-bg flex flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="text-red-400 text-sm">{recommendError}</p>
        <button
          type="button"
          onClick={() => setStep("context")}
          className="px-6 py-3 rounded-full border border-brew-border text-white text-sm active:scale-95 transition-all"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!rec || !candidates.length) return null;

  return (
    <FlowShell hideNav>
      <div className="flex-1 flex flex-col px-5 py-4 gap-5">

        {/* Header */}
        <div>
          <p className="label-mono text-brew-muted mb-1">Suggested Recipe</p>
          {draft.coffee?.name && (
            <p className="text-brew-muted text-sm">{draft.coffee.roaster} · {draft.coffee.name}</p>
          )}
        </div>

        {/* Overall reasoning — at the top so the brewer knows WHY before choosing */}
        {rec.reasoning && (
          <div className="px-1">
            <p className="text-white/60 text-sm italic leading-relaxed">{rec.reasoning}</p>
          </div>
        )}

        {/* Candidate tabs */}
        {candidates.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {candidates.map((c, i) => {
              const role = c.role as CandidateRole;
              const isActive = selectedIdx === i;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => { setSelectedIdx(i); setShowAdjustments(false); }}
                  className={`shrink-0 px-3 py-2 rounded-xl border text-xs font-medium transition-all active:scale-95 ${
                    isActive ? ROLE_STYLE[role] : "border-brew-border text-brew-muted"
                  }`}
                >
                  {ROLE_LABELS[role] ?? role}
                </button>
              );
            })}
          </div>
        )}

        {/* Active candidate — title + confidence */}
        {active && (
          <div>
            <h1 className="font-display text-2xl text-white leading-tight">{active.title}</h1>
            <div className="flex items-center justify-between mt-0.5">
              <div className="flex items-center gap-2">
                <BrewMethodIcon method={activeMethod} className="w-5 h-5" />
                <p className="text-brew-muted text-sm">{activeMethod}</p>
              </div>
              <ConfidenceBadge confidence={active.confidence} />
            </div>
          </div>
        )}

        {/* Recipe card */}
        {activeRecipe && (
          <div className="bg-brew-surface rounded-2xl p-5 space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <RecipeStat label="Dose"  value={`${activeRecipe.doseGrams}g`} />
              <RecipeStat label="Water" value={`${activeRecipe.waterGrams}g`} />
              <RecipeStat label="Temp"  value={`${activeRecipe.waterTempC}°C`} />
            </div>
            <div className="border-t border-brew-border pt-4 grid grid-cols-2 gap-4 text-center">
              <RecipeStat label="Grind" value={activeRecipe.grindSize} />
              <RecipeStat label="Time"  value={formatSeconds(activeRecipe.targetTimeSec)} />
            </div>

            {activeRecipe.pourSequence && (
              <div className="border-t border-brew-border pt-4">
                <p className="text-brew-muted text-xs uppercase tracking-widest mb-4">Pour sequence</p>
                <PourSequence
                  sequence={activeRecipe.pourSequence}
                  totalGrams={activeRecipe.waterGrams}
                  targetTimeSec={activeRecipe.targetTimeSec}
                  roastDate={draft.coffee?.roastDate}
                  method={activeMethod}
                  process={draft.coffee?.process}
                />
              </div>
            )}
          </div>
        )}

        {/* Why / Hypothesis / Predicted cup / Observe */}
        {active && (
          <div className="bg-brew-surface rounded-2xl p-4 space-y-3">
            <InfoRow label="Why" value={active.whyChosen} />
            <div className="border-t border-brew-border pt-3">
              <InfoRow label="Hypothesis" value={active.hypothesis} />
            </div>
            <div className="border-t border-brew-border pt-3">
              <InfoRow label="Predicted cup" value={active.predictedCupProfile} />
            </div>
            <div className="border-t border-brew-border pt-3">
              <InfoRow label="Observe" value={active.whatToObserve} />
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-auto pb-safe pt-2">
          <button
            type="button"
            onClick={handleUse}
            className="w-full h-14 rounded-full bg-white text-black font-semibold text-base active:scale-95 transition-all"
          >
            Brew with {activeMethod}
          </button>
        </div>

      </div>
    </FlowShell>
  );
}

// ── PourSequence ─────────────────────────────────────────────────────────

function getBloomAgitation(method?: string, process?: string): string | null {
  const m = (method ?? "").toLowerCase();
  const isWashed = process?.toLowerCase() === "washed";
  if (m.includes("kalita")) return "Gentle swirl only";
  if (m.includes("orea") && (m.includes("apex") || m.includes("fast") || m.includes("wölfl"))) return "Light stir 1–2×";
  if (m.includes("orea")) return "Gentle swirl";
  if (m.includes("peng") || m.includes("kasuya") || m.includes("4:6")) return "Stir 3×";
  return isWashed ? "Stir 3–5×" : "Gentle swirl";
}

function getFinalAgitation(method?: string): string | null {
  if (!method) return "Gentle swirl";
  const m = method.toLowerCase();
  if (m.includes("kalita")) return null;
  if (m.includes("orea") && !m.includes("classic")) return null;
  return "Gentle swirl";
}

function PourSequence({
  sequence,
  totalGrams,
  targetTimeSec,
  roastDate,
  method,
  process,
}: {
  sequence: string;
  totalGrams: number;
  targetTimeSec: number;
  roastDate?: string;
  method?: string;
  process?: string;
}) {
  const parts = sequence.split(/\s*[–—\-]\s*/).map(s => s.trim());
  const isCumulative = parts.length >= 2 && parts.every(p => /^\d+$/.test(p));

  if (!isCumulative) {
    const steps = sequence.split(/\s*[·|]\s*/).map(s => s.trim()).filter(Boolean);
    if (steps.length < 2) {
      return <p className="text-white/60 text-sm leading-relaxed">{sequence}</p>;
    }
    return (
      <div className="space-y-2">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full border border-white/20 shrink-0 flex items-center justify-center mt-0.5">
              <span className="font-mono-num text-xs text-white/40">{i + 1}</span>
            </div>
            <p className="text-white text-sm capitalize leading-snug">{step}</p>
          </div>
        ))}
      </div>
    );
  }

  const milestones = parts.map(Number);
  const n = milestones.length;
  const daysOld = roastDate
    ? Math.floor((Date.now() - new Date(roastDate).getTime()) / 86_400_000)
    : null;
  const bloomDur =
    daysOld === null ? 45
    : daysOld < 7    ? 50
    : daysOld < 22   ? 45
    : 30;
  const interval = n > 1 ? (targetTimeSec - bloomDur) / (n - 1) : 0;
  const stepTimes = milestones.map((_, i) =>
    i === 0 ? 0 : Math.round(bloomDur + (i - 1) * interval)
  );

  const rows: { time: string; label: React.ReactNode; isFirst?: boolean }[] = [
    {
      time: "",
      isFirst: true,
      label: <span className="text-white/30 text-sm">Ready</span>,
    },
    ...milestones.map((grams, i) => {
      const pourGrams = i === 0 ? grams : grams - milestones[i - 1];
      const label = i === 0 ? "Bloom" : i === n - 1 ? "Final pour" : `Pour ${i + 1}`;
      const agitation = i === 0
        ? getBloomAgitation(method, process)
        : i === n - 1
          ? getFinalAgitation(method)
          : null;
      return {
        time: stepTimes[i] === 0 ? "0:00" : formatSeconds(stepTimes[i]),
        label: (
          <div>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-white text-sm font-medium">{label}</span>
              <span className="text-brew-accent font-mono-num text-xs">+{pourGrams}g</span>
              <span className="text-white/30 font-mono-num text-xs">→ {grams}g</span>
            </div>
            {agitation && <span className="text-white/30 text-xs block mt-0.5">{agitation}</span>}
          </div>
        ),
      };
    }),
    {
      time: formatSeconds(targetTimeSec),
      label: <span className="text-white/30 text-sm">Drawdown complete</span>,
    },
  ];

  return (
    <div className="relative">
      {rows.map((row, i) => {
        const isLast = i === rows.length - 1;
        return (
          <div key={i} className="flex items-center gap-0 min-h-[44px]">
            <div className="w-10 shrink-0 flex items-center justify-end pr-3">
              <span className="font-mono-num text-[11px] text-brew-muted leading-none whitespace-nowrap">{row.time}</span>
            </div>
            <div className="relative flex flex-col items-center w-4 shrink-0 self-stretch">
              {/* Dot — always uniform, rendered above lines via z-10 */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-2.5 h-2.5 rounded-full bg-white/25" />
              {/* Bottom-half connector */}
              {!isLast && <div className="absolute top-1/2 bottom-0 left-1/2 -translate-x-1/2 w-px bg-brew-border" />}
              {/* Top-half connector — skip for first row */}
              {!row.isFirst && <div className="absolute top-0 bottom-1/2 left-1/2 -translate-x-1/2 w-px bg-brew-border" />}
            </div>
            <div className="flex-1 pl-3 py-2">{row.label}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────

function RecipeStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-brew-muted text-xs uppercase tracking-widest mb-1">{label}</p>
      <p className="font-mono-num text-white font-medium" style={{ fontSize: "1.25rem", lineHeight: 1.2 }}>{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-brew-muted text-xs uppercase tracking-widest">{label}</p>
      <p className="text-white/70 text-sm leading-relaxed">{value}</p>
    </div>
  );
}

function AdjustRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-brew-muted text-xs shrink-0 w-16 pt-0.5">{label}</span>
      <span className="text-white/60 text-xs leading-relaxed flex-1">{value}</span>
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: CandidateConfidence }) {
  return (
    <span className={`text-sm shrink-0 ${CONFIDENCE_STYLE[confidence]}`}>
      {CONFIDENCE_LABELS[confidence]}
    </span>
  );
}
