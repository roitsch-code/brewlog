"use client";

import { useEffect, useRef, useState } from "react";
import { useFlowStore } from "@/store/flowStore";
import LightFlowShell from "@/components/ui/light/LightFlowShell";
import Section from "@/components/ui/light/Section";
import Chip from "@/components/ui/light/Chip";
import CTA from "@/components/ui/light/CTA";
import { formatSeconds } from "@/lib/utils/formatTime";
import BrewMethodIcon from "@/components/ui/BrewMethodIcon";
import LiquidHeadline, { liquidEntranceMs, liquidExitMs } from "@/components/ui/light/LiquidHeadline";
import { COFFEE_HINTS } from "@/lib/coffeeHints";
import { useWakeLock } from "@/hooks/useWakeLock";
import type { RecommendationCandidate, CandidateRole, CandidateConfidence } from "@/lib/types/session";
import { basedOnReference } from "@/lib/utils/resolveRecipe";

/**
 * Light System fork of /components/flow/StepRecommend.tsx.
 *
 * Same recommendation data, three same view states (loading → error →
 * loaded), same handoff to step "brew" with setBrew on commit. Only
 * the surfaces change: glass cards replace Dark surface-brew, anthracite
 * text replaces text-white, Chips replace tinted role pills, the CTA
 * primitive replaces the white-on-black button.
 *
 * Loading + error states render bare (no LightFlowShell) — mirrors Dark's
 * hideNav pattern. The Field still paints whatever the previous step
 * configured because the FieldContext is route-scoped at LightShell, not
 * inside the brew flow shell.
 *
 * CoffeeBeanGlow uses #E8C5A8 (peach) hardcoded — kept as-is for v1. On
 * the warm-cream Light field it still reads as a different tone (peach
 * over cream); revisit if it disappears visually.
 */

function shuffleSubset(arr: string[], count: number): string[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// Recipe-crafting insight animation — deliberately slow + calm (the earlier
// fast rotation read as stressful). Raise any of these to slow further / hold
// longer; INSIGHT_READ_MS is the pure settled reading time before it leaves.
const INSIGHT_POP_MS = 1000; // per-word entrance spring
const INSIGHT_STAGGER_MS = 110; // gap between words (entrance + exit)
const INSIGHT_EXIT_MS = 850; // per-word exit duration
const INSIGHT_READ_MS = 4800; // how long it sits fully settled before leaving

const ROLE_LABELS: Record<CandidateRole, string> = {
  anchor: "Anchor",
  adjacent: "Adjacent",
  contrast: "Contrast",
  "clarity-probe": "Clarity",
  "sweetness-probe": "Sweetness",
  "body-probe": "Body",
  wildcard: "Wildcard",
};

const CONFIDENCE_LABELS: Record<CandidateConfidence, string> = {
  high: "High confidence",
  moderate: "Moderate",
  low: "Low confidence",
  exploratory: "Exploratory",
};

export default function LightStepRecommend() {
  const { draft, setStep, isRecommending, recommendError, setBrew } = useFlowStore();
  const rec = draft.recommendation;
  const [selectedIdx, setSelectedIdx] = useState(0);

  const { enableWakeLock, disableWakeLock } = useWakeLock();
  useEffect(() => {
    if (isRecommending) enableWakeLock();
    else disableWakeLock();
  }, [isRecommending, enableWakeLock, disableWakeLock]);

  // Rotating insight deck for the crafting screen: a shuffled subset shown one
  // at a time — big (Fraunces 40, like the welcome haiku), scattered-in, held
  // long enough to read, then dissolved the OPPOSITE way (down) before the next
  // sets up. Pulled straight from the code-canonical short COFFEE_HINTS so the
  // big format always fits (no /api/hints round-trip, no risk of a long string).
  const [insights] = useState<string[]>(() => shuffleSubset(COFFEE_HINTS, 12));
  const [insightIdx, setInsightIdx] = useState(0);
  const [insightVisible, setInsightVisible] = useState(true);

  const currentInsight = insights[insightIdx] ?? "";
  const insightWordCount = currentInsight.trim() === "" ? 0 : currentInsight.trim().split(/\s+/).length;
  // Visible window = entrance time + a generous read buffer, so it stands long
  // enough to read calmly before it starts to leave.
  const dwellMs = liquidEntranceMs(insightWordCount, INSIGHT_POP_MS, INSIGHT_STAGGER_MS) + INSIGHT_READ_MS;
  const insightExitMs = liquidExitMs(insightWordCount, INSIGHT_EXIT_MS, INSIGHT_STAGGER_MS);

  useEffect(() => {
    if (!isRecommending || insights.length === 0) return;
    if (insightVisible) {
      const t = setTimeout(() => setInsightVisible(false), dwellMs);
      return () => clearTimeout(t);
    }
    // Leaving — once every word has gone, advance and set up the next.
    const t = setTimeout(() => {
      setInsightIdx((i) => (i + 1) % insights.length);
      setInsightVisible(true);
    }, insightExitMs);
    return () => clearTimeout(t);
  }, [insightVisible, isRecommending, insights.length, dwellMs, insightExitMs]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [rec?.generatedAt]);

  const candidates: RecommendationCandidate[] = rec?.candidates ?? [];
  const active = candidates[selectedIdx];
  const activeRecipe = active?.recipe;
  const activeMethod = active?.method;
  const activeMethodLabel = activeMethod;

  const handleUse = () => {
    if (!activeMethod || !activeRecipe) return;
    setBrew({
      methodUsed: activeMethodLabel ?? activeMethod,
      selectedCandidateIdx: selectedIdx,
      followedRecipe: true,
    });
    setStep("brew");
  };

  // ── Loading state ─────────────────────────────────────────────────────
  if (isRecommending) {
    return (
      <div className="relative min-h-dvh flex flex-col items-center justify-center px-8 text-center">
        <p
          className="label-eyebrow absolute left-0 right-0 text-center"
          style={{ top: "calc(env(safe-area-inset-top) + 1.75rem)" }}
        >
          Crafting your recipe…
        </p>
        <LiquidHeadline
          text={currentInsight}
          show={insightVisible}
          dissolveDir="down"
          popMs={INSIGHT_POP_MS}
          staggerMs={INSIGHT_STAGGER_MS}
          exitMs={INSIGHT_EXIT_MS}
          className="font-fraunces font-semibold text-[40px] leading-[1.1] tracking-[-0.01em] text-light-foreground text-center max-w-[15ch]"
        />
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────
  if (recommendError) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="text-[14px] text-light-foreground">{recommendError}</p>
        <button
          type="button"
          onClick={() => setStep("context")}
          className="px-6 py-3 rounded-full bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 text-[14px] text-light-foreground active:scale-95 transition-transform"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!rec || !candidates.length) return null;

  return (
    <LightFlowShell>
      <p className="label-eyebrow px-1">
        Suggested Recipe
        {draft.coffee?.name ? ` · ${draft.coffee.roaster ? `${draft.coffee.roaster} · ` : ""}${draft.coffee.name}` : ""}
      </p>

      {rec.reasoning && (
        <p className="mt-3 px-1 text-[14px] leading-relaxed text-light-foreground/85">
          {rec.reasoning}
        </p>
      )}

      {candidates.length > 1 && (
        <div className="mt-6 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {candidates.map((c, i) => (
            <Chip
              key={i}
              size="sm"
              selected={selectedIdx === i}
              onClick={() => setSelectedIdx(i)}
            >
              {ROLE_LABELS[c.role as CandidateRole] ?? c.role}
            </Chip>
          ))}
        </div>
      )}

      {active && (
        <div className="mt-6">
          <h1 className="font-fraunces text-[28px] leading-tight tracking-[-0.01em] text-light-foreground px-1">
            {active.title}
          </h1>
          {basedOnReference(active.basedOn, active.title) && (
            <p className="text-[12px] text-light-muted-foreground mt-1 px-1">
              based on {basedOnReference(active.basedOn, active.title)}
            </p>
          )}
          <div className="flex items-center justify-between mt-2 px-1">
            <div className="flex items-center gap-2">
              <BrewMethodIcon method={activeMethod} className="w-5 h-5 text-light-foreground" />
              <p className="text-[13px] text-light-muted-foreground">{activeMethodLabel}</p>
            </div>
            <span
              className={`text-[13px] shrink-0 ${
                active.confidence === "high"
                  ? "text-light-foreground"
                  : "text-light-muted-foreground"
              }`}
            >
              {CONFIDENCE_LABELS[active.confidence]}
            </span>
          </div>
        </div>
      )}

      {activeRecipe && (
        <div className="mt-6 rounded-3xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 p-5 space-y-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <RecipeStat label="Dose" value={`${activeRecipe.doseGrams}g`} />
            <RecipeStat label={activeRecipe.iceGrams ? "Hot Water" : "Water"} value={`${activeRecipe.waterGrams}g`} />
            <RecipeStat label="Temp" value={`${activeRecipe.waterTempC}°C`} />
          </div>
          {activeRecipe.iceGrams != null && activeRecipe.iceGrams > 0 && (
            <div className="border-t border-light-foreground/10 pt-4 grid grid-cols-2 gap-4 text-center">
              <RecipeStat label="Ice" value={`${activeRecipe.iceGrams}g`} />
              <RecipeStat label="Final cup" value={`${activeRecipe.waterGrams + activeRecipe.iceGrams}g`} />
            </div>
          )}
          <div className="border-t border-light-foreground/10 pt-4 grid grid-cols-2 gap-4 text-center">
            <RecipeStat label="Grind" value={activeRecipe.grindSize} />
            <RecipeStat label="Time" value={formatSeconds(activeRecipe.targetTimeSec)} />
          </div>

          {activeRecipe.pourSequence && (
            <div className="border-t border-light-foreground/10 pt-4">
              <p className="label-eyebrow mb-4">Pour sequence</p>
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

      {active && (
        <div className="mt-6 rounded-3xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 p-4 space-y-3">
          <InfoRow label="Why" value={active.whyChosen} />
          <div className="border-t border-light-foreground/10 pt-3">
            <InfoRow label="Hypothesis" value={active.hypothesis} />
          </div>
          <div className="border-t border-light-foreground/10 pt-3">
            <InfoRow label="Predicted cup" value={active.predictedCupProfile} />
          </div>
          <div className="border-t border-light-foreground/10 pt-3">
            <InfoRow label="Observe" value={active.whatToObserve} />
          </div>
        </div>
      )}

      <CTA onClick={handleUse}>Brew with {activeMethodLabel}</CTA>
    </LightFlowShell>
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
  const parts = sequence.split(/\s*[–—\-]\s*/).map((s) => s.trim());
  const isCumulative = parts.length >= 2 && parts.every((p) => /^\d+$/.test(p));

  if (!isCumulative) {
    const steps = sequence.split(/\s*[·|]\s*/).map((s) => s.trim()).filter(Boolean);
    if (steps.length < 2) {
      return <p className="text-[13px] leading-relaxed text-light-foreground/70">{sequence}</p>;
    }
    return (
      <div className="space-y-2">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full border border-light-foreground/20 shrink-0 flex items-center justify-center mt-0.5">
              <span className="font-mono-num text-[11px] text-light-muted-foreground">{i + 1}</span>
            </div>
            <p className="text-[14px] capitalize leading-snug text-light-foreground">{step}</p>
          </div>
        ))}
      </div>
    );
  }

  const milestones = parts.map(Number);
  const n = milestones.length;
  const daysOld = roastDate
    ? Math.max(0, Math.floor((Date.now() - new Date(roastDate).getTime()) / 86_400_000))
    : null;
  const bloomDur =
    daysOld === null ? 45 : daysOld < 7 ? 50 : daysOld < 22 ? 45 : 30;
  const interval = n > 1 ? (targetTimeSec - bloomDur) / (n - 1) : 0;
  const stepTimes = milestones.map((_, i) => (i === 0 ? 0 : Math.round(bloomDur + (i - 1) * interval)));

  const rows: { time: string; label: React.ReactNode; isFirst?: boolean }[] = [
    {
      time: "",
      isFirst: true,
      label: <span className="text-[13px] text-light-muted-foreground">Ready</span>,
    },
    ...milestones.map((grams, i) => {
      const pourGrams = i === 0 ? grams : grams - milestones[i - 1];
      const label = i === 0 ? "Bloom" : i === n - 1 ? "Final pour" : `Pour ${i + 1}`;
      const agitation =
        i === 0
          ? getBloomAgitation(method, process)
          : i === n - 1
            ? getFinalAgitation(method)
            : null;
      return {
        time: stepTimes[i] === 0 ? "0:00" : formatSeconds(stepTimes[i]),
        label: (
          <div>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-[14px] font-medium text-light-foreground">{label}</span>
              <span className="font-mono-num text-[12px] font-semibold text-light-foreground">+{pourGrams}g</span>
              <span className="font-mono-num text-[12px] text-light-muted-foreground">→ {grams}g</span>
            </div>
            {agitation && (
              <span className="text-[12px] text-light-muted-foreground block mt-0.5">{agitation}</span>
            )}
          </div>
        ),
      };
    }),
    {
      time: formatSeconds(targetTimeSec),
      label: <span className="text-[13px] text-light-muted-foreground">Drawdown complete</span>,
    },
  ];

  return (
    <div className="relative">
      {rows.map((row, i) => {
        const isLast = i === rows.length - 1;
        return (
          <div key={i} className="flex items-center gap-0 min-h-[44px]">
            <div className="w-10 shrink-0 flex items-center justify-end pr-3">
              <span className="font-mono-num text-[11px] text-light-muted-foreground leading-none whitespace-nowrap">
                {row.time}
              </span>
            </div>
            <div className="relative flex flex-col items-center w-4 shrink-0 self-stretch">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-2.5 h-2.5 rounded-full bg-light-foreground/40" />
              {!isLast && (
                <div className="absolute top-1/2 bottom-0 left-1/2 -translate-x-1/2 w-px bg-light-foreground/15" />
              )}
              {!row.isFirst && (
                <div className="absolute top-0 bottom-1/2 left-1/2 -translate-x-1/2 w-px bg-light-foreground/15" />
              )}
            </div>
            <div className="flex-1 pl-3 py-2">{row.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function RecipeStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label-eyebrow mb-1">{label}</p>
      <p
        className="font-mono-num text-light-foreground font-medium"
        style={{ fontSize: "1.25rem", lineHeight: 1.2 }}
      >
        {value}
      </p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="label-eyebrow">{label}</p>
      <p className="text-[13px] leading-relaxed text-light-foreground/80">{value}</p>
    </div>
  );
}
