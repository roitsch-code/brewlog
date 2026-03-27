"use client";
import { useState, useEffect, useRef } from "react";
import { useFlowStore } from "@/store/flowStore";
import FlowShell from "./FlowShell";
import { formatSeconds } from "@/lib/utils/formatTime";
import CoffeeBeanGlow from "@/components/ui/CoffeeBeanGlow";
import { getLoadingHints, COFFEE_HINTS } from "@/lib/coffeeHints";

function shuffleSubset(arr: string[], count: number): string[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export default function StepRecommend() {
  const { draft, setStep, isRecommending, recommendError, setBrew } = useFlowStore();
  const rec = draft.recommendation;
  const [selected, setSelected] = useState<"primary" | "alternative">("primary");

  // Cycling hints during loading — 10s per hint
  // Initialise with local fallback immediately; replace with API hints if available
  const [hints, setHints] = useState<string[]>(() => getLoadingHints(8));
  const [hintIdx, setHintIdx] = useState(0);

  // Fetch hints from API on mount, fall back to hardcoded COFFEE_HINTS
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
      .catch(() => {
        if (!cancelled) setHints(shuffleSubset(COFFEE_HINTS, 8));
      });
    return () => { cancelled = true; };
  }, []);
  const hintTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRecommending) {
      hintTimer.current = setInterval(() => {
        setHintIdx(i => (i + 1) % hints.length);
      }, 10000);
    } else {
      if (hintTimer.current) clearInterval(hintTimer.current);
    }
    return () => { if (hintTimer.current) clearInterval(hintTimer.current); };
  }, [isRecommending, hints.length]);

  const activeMethod = selected === "primary" ? rec?.primaryMethod : rec?.alternativeMethod;
  const activeRecipe = selected === "primary" ? rec?.primaryRecipe : rec?.alternativeRecipe;

  const handleUse = () => {
    if (!activeMethod || !activeRecipe) return;
    setBrew({ methodUsed: activeMethod, followedRecipe: true });
    setStep("brew");
  };

  if (isRecommending) {
    return (
      <div className="min-h-svh bg-brew-bg flex flex-col items-center justify-center px-8 gap-0">
        <CoffeeBeanGlow size={72} />

        <p className="text-white/40 text-xs tracking-widest uppercase mt-8">Crafting your recipe…</p>

        {/* Cycling coffee knowledge hint */}
        <div className="mt-12 max-w-xs mx-auto w-full text-center space-y-2 min-h-[6rem] flex flex-col items-center justify-start">
          <p className="text-white/40 text-xs tracking-widest uppercase">
            Did you know?
          </p>
          <p
            key={hintIdx}
            className="text-white/60 text-xs leading-relaxed text-center animate-hint-cycle"
          >
            {hints[hintIdx]}
          </p>
        </div>
      </div>
    );
  }

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

  if (!rec) return null;

  return (
    <FlowShell hideNav>
      <div className="flex-1 flex flex-col px-5 py-4 gap-6">

        {/* Header */}
        <div>
          <p className="text-brew-muted text-xs tracking-widest uppercase mb-2">Recommended</p>
          {draft.coffee?.name && (
            <p className="text-brew-muted text-sm mb-1">{draft.coffee.roaster} · {draft.coffee.name}</p>
          )}
        </div>

        {/* Method name */}
        <div>
          <h1 className="font-display text-2xl text-white leading-tight">{activeMethod}</h1>
        </div>

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
                />
              </div>
            )}
          </div>
        )}

        {/* Reasoning */}
        <div className="px-1">
          <p className="text-brew-muted text-sm italic leading-relaxed">{rec.reasoning}</p>
        </div>

        {/* Alternative toggle */}
        {rec.alternativeMethod && (
          <div className="flex gap-3">
            <MethodTab label={rec.primaryMethod}       active={selected === "primary"}     onClick={() => setSelected("primary")} />
            <MethodTab label={rec.alternativeMethod}   active={selected === "alternative"} onClick={() => setSelected("alternative")} />
          </div>
        )}

        {/* CTA */}
        <div className="mt-auto pb-safe pt-4">
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

function PourSequence({
  sequence,
  totalGrams,
  targetTimeSec,
}: {
  sequence: string;
  totalGrams: number;
  targetTimeSec: number;
}) {
  const parts = sequence.split(/\s*[–—\-]\s*/).map(s => s.trim());
  const isCumulative = parts.length >= 2 && parts.every(p => /^\d+$/.test(p));

  // ── Prose methods (AeroPress, Clever Dripper, etc.) ──
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

  // ── Structured pour-over sequence ──
  const milestones = parts.map(Number);
  const n = milestones.length;

  // Distribute timing: bloom ~22 % of total, rest evenly split
  const bloomDur = Math.max(30, Math.min(50, Math.round(targetTimeSec * 0.22)));
  const interval = n > 1 ? (targetTimeSec - bloomDur) / (n - 1) : 0;

  const stepTimes = milestones.map((_, i) =>
    i === 0 ? 0 : Math.round(bloomDur + (i - 1) * interval)
  );

  const rows: { time: string; dot: "start" | "accent" | "normal" | "end"; label: React.ReactNode }[] = [
    // Anchor: "Ready"
    {
      time: "",
      dot: "start",
      label: <span className="text-white/30 text-xs tracking-widest uppercase">Ready</span>,
    },
    // Each pour
    ...milestones.map((grams, i) => {
      const pourGrams = i === 0 ? grams : grams - milestones[i - 1];
      const label = i === 0 ? "Bloom" : i === n - 1 ? "Final pour" : `Pour ${i + 1}`;
      return {
        time: stepTimes[i] === 0 ? "0:00" : formatSeconds(stepTimes[i]),
        dot: (i === 0 ? "accent" : "normal") as "accent" | "normal",
        label: (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-white text-sm font-medium">{label}</span>
            <span className="text-brew-accent font-mono-num text-xs">+{pourGrams}g</span>
            <span className="text-white/30 font-mono-num text-xs">→ {grams}g</span>
          </div>
        ),
      };
    }),
    // Drawdown finish
    {
      time: formatSeconds(targetTimeSec),
      dot: "end",
      label: <span className="text-white/30 text-sm">Drawdown complete</span>,
    },
  ];

  return (
    <div className="relative">
      {rows.map((row, i) => {
        const isLast = i === rows.length - 1;
        return (
          <div key={i} className="flex items-center gap-0 min-h-[44px]">
            {/* Time — fixed width, right-aligned, vertically centered */}
            <div className="w-10 shrink-0 flex items-center justify-end pr-3">
              <span className="font-mono-num text-[11px] text-brew-muted leading-none whitespace-nowrap">
                {row.time}
              </span>
            </div>

            {/* Dot + vertical connector — relative wrapper so line goes full height */}
            <div className="relative flex flex-col items-center w-4 shrink-0 self-stretch">
              {/* Dot, centered vertically in the row */}
              <div className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-4">
                {row.dot === "start" ? (
                  <div className="w-1.5 h-1.5 rounded-full border border-white/25" />
                ) : row.dot === "accent" ? (
                  <div className="w-3 h-3 rounded-full bg-brew-accent/85" />
                ) : row.dot === "end" ? (
                  <div className="w-1.5 h-1.5 rounded-full border border-white/20" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-white/30" />
                )}
              </div>
              {/* Connector line — top half of this row to next */}
              {!isLast && (
                <div className="absolute top-1/2 bottom-0 left-1/2 -translate-x-px w-px bg-brew-border" />
              )}
              {i > 0 && (
                <div className="absolute top-0 bottom-1/2 left-1/2 -translate-x-px w-px bg-brew-border" />
              )}
            </div>

            {/* Content — vertically centered */}
            <div className="flex-1 pl-3 py-2">
              {row.label}
            </div>
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
      <p className="font-mono-num text-white text-xl font-medium">{value}</p>
    </div>
  );
}

function MethodTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-all ${
        active ? "border-brew-accent bg-brew-accent/10 text-brew-accent" : "border-brew-border text-brew-muted"
      }`}
    >
      {label}
    </button>
  );
}
