"use client";
import { useState, useEffect, useCallback } from "react";
import { useFlowStore } from "@/store/flowStore";
import FlowShell from "./FlowShell";
import CircularTimer from "@/components/ui/CircularTimer";
import { formatSeconds } from "@/lib/utils/formatTime";
import { useWakeLock } from "@/hooks/useWakeLock";

// ── Types ──────────────────────────────────────────────────────────────────

interface PourStep {
  index: number;
  label: string;
  cumulativeGrams: number;
  pourGrams: number;
  startTimeSec: number;
  action: "bloom" | "pour" | "final";
}

// ── Helpers ────────────────────────────────────────────────────────────────

// Hoffmann/Rao consensus: 45s for peak-window coffee; shorter for old, slightly longer for very fresh
function getBloomDuration(roastDate?: string): number {
  if (roastDate) {
    const daysOld = Math.floor((Date.now() - new Date(roastDate).getTime()) / 86_400_000);
    if (daysOld < 7)  return 50; // very fresh: slight extension for heavy CO2
    if (daysOld < 22) return 45; // peak window: Hoffmann/Rao standard
    return 30;                    // older: minimal CO2, move on
  }
  return 45; // default: expert standard
}

function parsePourSteps(sequence: string, targetTimeSec: number, roastDate?: string): PourStep[] | null {
  const parts = sequence.split(/\s*[–—\-]\s*/).map(s => s.trim());
  if (parts.length < 2 || !parts.every(p => /^\d+$/.test(p))) return null;

  const milestones = parts.map(Number);
  const n = milestones.length;
  const bloomDur = getBloomDuration(roastDate);
  // Reserve 33% of brew time after last pour for pouring + drawdown.
  // Calibrated for Drip Assist (disc bottleneck): ~89s at 270s, ~69s at 210s.
  const drawdownReserve = Math.round(targetTimeSec * 0.33);
  const remaining = targetTimeSec - bloomDur - drawdownReserve;
  // n-2: there are (n-2) intervals between pour 1 and the final pour,
  // so the last pour lands exactly at (targetTimeSec - drawdownReserve).
  const interval = n > 2 ? remaining / (n - 2) : 0;

  return milestones.map((grams, i) => ({
    index: i,
    label: i === 0 ? "Bloom" : i === n - 1 ? "Final pour" : `Pour ${i + 1}`,
    cumulativeGrams: grams,
    pourGrams: i === 0 ? grams : grams - milestones[i - 1],
    startTimeSec: i === 0 ? 0 : Math.round(bloomDur + (i - 1) * interval),
    action: (i === 0 ? "bloom" : i === n - 1 ? "final" : "pour") as PourStep["action"],
  }));
}

function getActiveIdx(elapsed: number, steps: PourStep[]): number {
  let idx = 0;
  for (let i = 0; i < steps.length; i++) {
    if (elapsed >= steps[i].startTimeSec) idx = i;
  }
  return idx;
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function StepBrew() {
  const { draft, setBrew, setStep } = useFlowStore();
  const rec = draft.recommendation;
  const method = draft.brew?.methodUsed || rec?.primaryMethod || "Brew";
  const recipe = rec?.candidates?.find(c => c.method === method)?.recipe ?? rec?.primaryRecipe;

  const [elapsed, setElapsed] = useState(0);
  const [started, setStarted] = useState(false);

  // Prevent the iPhone screen from dimming/locking during an active pour-over.
  // enableWakeLock is called on the first timer tick; disableWakeLock on exit.
  // The hook's unmount cleanup handles all other exit paths automatically.
  const { enableWakeLock, disableWakeLock } = useWakeLock();

  const handleTick = useCallback((e: number) => {
    setElapsed(e);
    if (e === 1) {
      setStarted(true);
      enableWakeLock(); // screen must stay on while the timer runs
    }
  }, [enableWakeLock]);

  const handleDone = useCallback((actualSec?: number) => {
    disableWakeLock(); // brewing complete — screen can sleep normally again
    setBrew({ ...draft.brew, methodUsed: method, followedRecipe: true, actualTimeSec: actualSec ?? elapsed });
    setStep("log");
  }, [draft.brew, method, elapsed, setBrew, setStep, disableWakeLock]);

  const handleTimerComplete = useCallback((e: number) => {
    setBrew({ ...draft.brew, methodUsed: method, followedRecipe: true, actualTimeSec: e });
  }, [draft.brew, method, setBrew]);

  const steps = recipe?.pourSequence && recipe.targetTimeSec
    ? parsePourSteps(recipe.pourSequence, recipe.targetTimeSec, draft.coffee?.roastDate)
    : null;

  // Detect prose-based methods (AeroPress, Clever Dripper, Moccamaster, French Press)
  const isProseMethod = recipe?.pourSequence && !steps;

  return (
    <FlowShell onNext={() => handleDone()} nextLabel="Done Brewing →">
      <div className="flex flex-col px-5 py-4 gap-5">

        {/* Recipe mini bar */}
        {recipe && (
          <div className="bg-brew-surface rounded-2xl p-4">
            <p className="text-brew-muted text-xs tracking-widest uppercase mb-3">{method}</p>
            <div className="grid grid-cols-4 gap-2 text-center">
              <MiniStat label="Dose"  value={`${recipe.doseGrams}g`} />
              <MiniStat label="Water" value={`${recipe.waterGrams}g`} />
              <MiniStat label="Temp"  value={`${recipe.waterTempC}°`} />
              <MiniStat label="Grind" value={stripGrindPrefix(recipe.grindSize)} />
            </div>
          </div>
        )}

        {/* Timer */}
        <CircularTimer
          targetSeconds={recipe?.targetTimeSec}
          onComplete={handleTimerComplete}
          onTick={handleTick}
        />

        {/* Pour-over: structured live sequence */}
        {steps && recipe && (
          <LivePourSequence
            steps={steps}
            elapsed={elapsed}
            targetTimeSec={recipe.targetTimeSec}
            started={started}
            process={draft.coffee?.process}
          />
        )}

        {/* Immersion / pressure methods: step-through guide */}
        {isProseMethod && recipe?.pourSequence && (
          <ProseStepGuide
            sequence={recipe.pourSequence}
            method={method}
            elapsed={elapsed}
            targetTimeSec={recipe.targetTimeSec || 120}
            started={started}
          />
        )}

      </div>
    </FlowShell>
  );
}

// ── LivePourSequence ── (pour-over methods: V60, Orea, Kalita, Chemex) ────

interface LivePourSequenceProps {
  steps: PourStep[];
  elapsed: number;
  targetTimeSec: number;
  started: boolean;
  process?: string;
}

function LivePourSequence({ steps, elapsed, targetTimeSec, started, process }: LivePourSequenceProps) {
  const activeIdx = started ? getActiveIdx(elapsed, steps) : -1;
  const activeStep = activeIdx >= 0 ? steps[activeIdx] : null;
  const nextStep  = activeIdx >= 0 && activeIdx < steps.length - 1 ? steps[activeIdx + 1] : null;
  const isWashed = process?.toLowerCase() === "washed";
  // Bloom cue: highlight from t=20s–40s.
  // Pouring 70 ml through the Drip Assist at 3.5–5 g/s takes ~14–20 s, so t=5 was
  // firing while the pour was still in progress. Start at 20 s (pour complete) and
  // keep visible for 20 s so there's ample time to stir/swirl.
  const bloomCueActive = started && activeStep?.action === "bloom" && elapsed >= 20 && elapsed < 40;
  // Final pour cue: delay 28 s after the pour starts, then show for 27 s.
  // The final pour is 120–150 ml; at 5 g/s that takes 24–30 s to pour completely.
  // Firing at t=0 of the final pour (old behaviour) prompted the swirl while still pouring.
  const finalStep = steps[steps.length - 1];
  const finalCueActive = started && activeStep?.action === "final" &&
    elapsed >= finalStep.startTimeSec + 28 && elapsed < finalStep.startTimeSec + 55;
  const nextCountdown = nextStep ? Math.max(0, nextStep.startTimeSec - elapsed) : null;
  const lastPourStart = steps[steps.length - 1].startTimeSec;
  const pourGraceSec = Math.min(20, Math.round((targetTimeSec - lastPourStart) * 0.35));
  const allPoursDone = started && elapsed >= lastPourStart + pourGraceSec;

  const [flashKey, setFlashKey] = useState(0);
  useEffect(() => {
    if (activeIdx > 0) setFlashKey(k => k + 1);
  }, [activeIdx]);

  // ── Pre-brew: vertical timeline plan ──────────────────────────────────
  if (!started) {
    const bloomAgitation = isWashed ? "Stir 3–5×" : "Gentle swirl";
    const finalAgitation = "Gentle swirl";

    return (
      <div className="bg-brew-surface rounded-2xl p-4">
        <p className="text-brew-muted text-xs uppercase tracking-widest mb-4">Pour Sequence</p>

        {/* Vertical timeline: time | dot+line | content */}
        <div className="space-y-0">
          {/* Ready anchor */}
          <TimelineRow
            time=""
            isFirst
            label={<span className="text-white/30 text-sm">Ready</span>}
            isLast={false}
          />

          {steps.map((step, i) => {
            const agitation = step.action === "bloom"
              ? bloomAgitation
              : step.action === "final"
                ? finalAgitation
                : null;
            return (
              <TimelineRow
                key={i}
                time={step.startTimeSec === 0 ? "0:00" : formatSeconds(step.startTimeSec)}
                label={
                  <div>
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-white text-sm font-medium">{step.label}</span>
                      <span className="text-brew-accent font-mono-num text-xs">+{step.pourGrams}g</span>
                      <span className="text-white/30 font-mono-num text-xs">→ {step.cumulativeGrams}g</span>
                    </div>
                    {agitation && <span className="text-white/30 text-xs block mt-0.5">{agitation}</span>}
                  </div>
                }
                isLast={i === steps.length - 1}
              />
            );
          })}

          {/* Drawdown */}
          <TimelineRow
            time={formatSeconds(targetTimeSec)}
            label={<span className="text-white/30 text-sm">Drawdown complete</span>}
            isLast={true}
          />
        </div>
      </div>
    );
  }

  // ── During brew ───────────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {/* Active step card */}
      {activeStep && !allPoursDone && (
        <div
          key={`step-${flashKey}`}
          className="bg-brew-elevated rounded-2xl p-4 border border-brew-border/60 animate-step-activate"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-brew-muted text-xs uppercase tracking-widest mb-1">Now</p>
              <p className="text-white font-display text-2xl leading-tight">{activeStep.label}</p>
              <p className="font-mono-num text-sm mt-1">
                <span className="text-brew-accent">+{activeStep.pourGrams}g</span>
                <span className="text-white/30"> → </span>
                <span className="text-white">{activeStep.cumulativeGrams}g total</span>
              </p>
              {activeStep.action === "bloom" && (
                <p className="text-white/40 text-xs mt-2">Pour in slow circles from centre outward</p>
              )}
              {activeStep.action === "pour" && (
                <p className="text-white/40 text-xs mt-2">Outer ring · 3.5–5 g/s</p>
              )}
              {activeStep.action === "final" && (
                <p className="text-white/40 text-xs mt-2">Last pour — swirl gently after</p>
              )}
            </div>

            {(activeStep.action === "bloom" || activeStep.action === "final") && (
              <SwirlButton
                isStir={activeStep.action === "bloom" && isWashed}
                label={activeStep.action === "bloom" ? (isWashed ? "Stir" : "Swirl") : "Swirl"}
                cueActive={activeStep.action === "bloom" ? bloomCueActive : finalCueActive}
              />
            )}
          </div>

          {/* Next pour countdown */}
          {nextCountdown !== null && nextCountdown <= 20 && nextCountdown > 0 && (
            <div className="mt-3 pt-3 border-t border-brew-border flex items-center justify-between">
              <span className="text-brew-muted text-xs">{nextStep!.label}</span>
              <span className={`font-mono-num text-sm font-medium ${
                nextCountdown <= 5 ? "text-brew-accent animate-countdown-pulse" : "text-white/60"
              }`}>
                in 0:{String(nextCountdown).padStart(2, "0")}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Drawdown card — keep swirl button if last step had one */}
      {allPoursDone && (
        <div className="bg-brew-surface rounded-2xl p-4 border border-brew-border/30 animate-step-activate">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-brew-muted text-xs uppercase tracking-widest mb-1">Draining</p>
              <p className="text-white text-sm">All pours done — wait for drawdown</p>
              <p className="text-brew-muted font-mono-num text-xs mt-1">
                Target finish: {formatSeconds(targetTimeSec)}
              </p>
            </div>
            {steps[steps.length - 1].action === "final" && (
              <SwirlButton label="Swirl" />
            )}
          </div>
        </div>
      )}

      {/* Step progress dots */}
      <StepDots steps={steps} activeIdx={activeIdx} allDone={allPoursDone} />
    </div>
  );
}

// ── TimelineRow ────────────────────────────────────────────────────────────

function TimelineRow({
  time, label, isLast, isFirst = false
}: {
  time: string;
  label: React.ReactNode;
  isLast: boolean;
  isFirst?: boolean;
}) {
  return (
    <div className="flex items-center gap-0 min-h-[44px]">
      {/* Time column — fixed width, right-aligned, vertically centered */}
      <div className="w-10 shrink-0 flex items-center justify-end pr-3">
        <span className="font-mono-num text-[11px] text-brew-muted leading-none whitespace-nowrap">{time}</span>
      </div>

      {/* Dot + vertical connector — relative wrapper spans full row height */}
      <div className="relative flex flex-col items-center w-4 shrink-0 self-stretch">
        {/* Dot — always uniform, rendered above lines via z-10 */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-2.5 h-2.5 rounded-full bg-white/25" />
        {/* Bottom-half connector */}
        {!isLast && <div className="absolute top-1/2 bottom-0 left-1/2 -translate-x-1/2 w-px bg-brew-border" />}
        {/* Top-half connector — skip for first row */}
        {!isFirst && <div className="absolute top-0 bottom-1/2 left-1/2 -translate-x-1/2 w-px bg-brew-border" />}
      </div>

      {/* Content — vertically centered */}
      <div className="flex-1 pl-3 py-2">
        {label}
      </div>
    </div>
  );
}

// ── StepDots ── (horizontal progress track during brew) ───────────────────

function StepDots({ steps, activeIdx, allDone }: {
  steps: PourStep[];
  activeIdx: number;
  allDone: boolean;
}) {
  // Build full dot sequence matching the pour plan: Ready → pours → Drain
  const pourLabels = steps.map((_, i) =>
    i === 0 ? "Bloom" : i === steps.length - 1 ? "Final" : `P${i + 1}`
  );
  const labels = ["Ready", ...pourLabels, "Drain"];
  const total = labels.length;

  // activeIdx === -1 means not yet started → position 0 (Ready)
  const currentPos = allDone ? total - 1 : activeIdx === -1 ? 0 : activeIdx + 1;
  const fillPct = total > 1 ? (currentPos / (total - 1)) * 100 : 0;

  return (
    <div className="px-1">
      <div className="relative flex items-start justify-between">
        {/* Connecting line behind dots — centered on the 20px container */}
        <div className="absolute top-[10px] left-[10px] right-[10px] h-px bg-brew-border" />
        {/* Progress fill */}
        <div
          className="absolute top-[10px] left-[10px] h-px bg-brew-accent transition-all duration-500"
          style={{ width: `${fillPct}%` }}
        />

        {labels.map((label, pos) => {
          const isActive = pos === currentPos;
          return (
            <div key={pos} className="relative flex flex-col items-center gap-1.5 z-10">
              {/* 20px transparent wrapper keeps line alignment consistent */}
              <div className="w-5 h-5 flex items-center justify-center">
                <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                  isActive ? "bg-brew-accent scale-[1.3]" : "bg-white"
                }`} />
              </div>
              <span className={`text-[10px] font-mono-num leading-none text-center ${
                isActive ? "text-brew-accent font-medium" : "text-white/30"
              }`}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ProseStepGuide helpers ─────────────────────────────────────────────────

/**
 * Parses actual duration from a step description.
 * Explicit seconds ("60s", "30 sec") and minutes ("1 min") take priority.
 * Falls back to action-type defaults: steep=60s, press=25s, stir=5s, pour=10s.
 */
function parseStepDuration(step: string): number {
  const s = step.toLowerCase();
  const mmss = s.match(/(\d+):(\d{2})/);
  if (mmss) return +mmss[1] * 60 + +mmss[2];
  const mins = s.match(/(\d+)\s*min(?:ute)?s?/);
  // Seconds: must be followed by boundary/end to avoid matching "50g" as seconds
  const secs = s.match(/(\d+)\s*s(?:ec(?:ond)?s?)?(?=\s|[·,]|$)/);
  if (mins && secs) return +mins[1] * 60 + +secs[1];
  if (mins) return +mins[1] * 60;
  if (secs) return +secs[1];
  // Action-type defaults
  if (/press|plunge/.test(s)) return 25;
  if (/steep|wait|brew|rest/.test(s)) return 60;
  if (/stir|agitat|swirl|mix/.test(s)) return 5;
  if (/pour|add|fill|water/.test(s)) return 10;
  return 12;
}

/** Steps that are setup/position info, not timed brew actions */
function isSetupStep(s: string): boolean {
  return /^inverted|^flip|^cap\b|^assemble|^position|^set.?up/i.test(s.trim());
}

// ── ProseStepGuide ── (AeroPress, Clever Dripper, Moccamaster, etc.) ───────

function ProseStepGuide({
  sequence, elapsed, started,
}: {
  sequence: string; method: string; elapsed: number; targetTimeSec: number; started: boolean;
}) {
  const raw = sequence.split(/\s*[·|]\s*/).map(s => s.trim()).filter(Boolean);
  const all = raw.length >= 2 ? raw : sequence.split(/\s*,\s*/).map(s => s.trim()).filter(Boolean);

  // Setup notes (e.g. "inverted") shown as a prep card, not timed steps
  const setupNotes = all.filter(s => isSetupStep(s));
  const steps = all.filter(s => !isSetupStep(s));
  const effectiveSteps = steps.length > 0 ? steps : all;

  // Real per-step durations and cumulative start times
  const durations = effectiveSteps.map(parseStepDuration);
  const cumulativeStarts = effectiveSteps.map((_, i) =>
    durations.slice(0, i).reduce((a, b) => a + b, 0)
  );

  // Auto-advance: find last step whose start time has passed
  let autoIdx = 0;
  if (started) {
    for (let i = 0; i < effectiveSteps.length; i++) {
      if (elapsed >= cumulativeStarts[i]) autoIdx = i;
    }
  }

  const [manualIdx, setManualIdx] = useState<number | null>(null);
  const currentIdx = manualIdx !== null ? Math.max(manualIdx, autoIdx) : autoIdx;
  const isLast = currentIdx >= effectiveSteps.length - 1;

  useEffect(() => {
    if (manualIdx !== null && autoIdx >= manualIdx) setManualIdx(null);
  }, [autoIdx, manualIdx]);

  const needsAgitation = (s: string) => /stir|swirl|agitate|mix|shake/i.test(s);
  // "stir" implies vigorous back-and-forth; "swirl" implies gentle circular
  const isStirStep = (s: string) => /\bstir\b|agitat|mix/i.test(s) && !/swirl/i.test(s);
  // Cue active for first 10s of the current step, so it highlights when step first appears
  const stepCueActive = started && elapsed >= cumulativeStarts[currentIdx] && elapsed < cumulativeStarts[currentIdx] + 10;

  const nextStart = currentIdx < effectiveSteps.length - 1 ? cumulativeStarts[currentIdx + 1] : null;
  const nextCountdown = nextStart !== null && started ? Math.max(0, nextStart - elapsed) : null;

  return (
    <div className="space-y-3">

      {/* Setup note — shown always as a reminder of initial position */}
      {setupNotes.length > 0 && (
        <div className="bg-brew-surface rounded-2xl px-4 py-3 border border-brew-border/30">
          <p className="text-brew-muted text-xs uppercase tracking-widest mb-1">Setup</p>
          {setupNotes.map((note, i) => (
            <p key={i} className="text-white/60 text-sm capitalize">{note}</p>
          ))}
        </div>
      )}

      {/* Current step hero */}
      <div
        key={currentIdx}
        className="bg-brew-elevated rounded-2xl p-4 border border-brew-border/60 animate-step-activate"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-brew-muted text-xs uppercase tracking-widest mb-1">
              Step {currentIdx + 1} of {effectiveSteps.length}
            </p>
            <p className="text-white font-display text-xl leading-snug capitalize">
              {effectiveSteps[currentIdx]}
            </p>
            {durations[currentIdx] > 0 && (
              <p className="text-brew-muted font-mono-num text-xs mt-1">
                ~{durations[currentIdx]}s
              </p>
            )}
          </div>
          {needsAgitation(effectiveSteps[currentIdx]) && (
            <SwirlButton
              isStir={isStirStep(effectiveSteps[currentIdx])}
              label={isStirStep(effectiveSteps[currentIdx]) ? "Stir" : "Swirl"}
              cueActive={stepCueActive}
            />
          )}
        </div>

        {/* Next step countdown — shown in last 15s before transition */}
        {nextCountdown !== null && nextCountdown <= 15 && nextCountdown > 0 && (
          <div className="mt-3 pt-3 border-t border-brew-border flex items-center justify-between">
            <span className="text-brew-muted text-xs capitalize">
              Next: {effectiveSteps[currentIdx + 1]}
            </span>
            <span className={`font-mono-num text-sm font-medium ${
              nextCountdown <= 5 ? "text-brew-accent animate-countdown-pulse" : "text-white/60"
            }`}>
              {nextCountdown}s
            </span>
          </div>
        )}

        {!isLast && (
          <button
            type="button"
            onClick={() => setManualIdx(currentIdx + 1)}
            className="mt-4 w-full py-2.5 rounded-xl bg-white/8 border border-white/10 text-white/60 text-sm font-medium active:scale-95 transition-all text-left px-3"
          >
            <span className="text-white/30 text-xs mr-2">Next:</span>
            {effectiveSteps[currentIdx + 1]}
          </button>
        )}
        {isLast && (
          <p className="mt-3 text-brew-muted text-xs text-center">Last step — tap Done Brewing when ready</p>
        )}
      </div>

      {/* Steps checklist */}
      <div className="bg-brew-surface rounded-2xl p-4">
        <div className="space-y-3">
          {effectiveSteps.map((step, i) => {
            const isDone   = i < currentIdx;
            const isActive = i === currentIdx;
            return (
              <div
                key={i}
                className={`flex items-start gap-3 transition-opacity ${i > currentIdx ? "opacity-35" : ""}`}
              >
                <div className={`w-5 h-5 rounded-full shrink-0 mt-0.5 flex items-center justify-center border transition-all ${
                  isDone
                    ? "bg-brew-accent/20 border-brew-accent/40"
                    : isActive
                      ? "border-2 border-brew-accent"
                      : "border-white/20"
                }`}>
                  {isDone ? (
                    <svg className="w-3 h-3 text-brew-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="font-mono-num text-xs text-white/40">{i + 1}</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className={`text-sm capitalize leading-relaxed ${
                    isActive ? "text-white font-medium" : isDone ? "text-white/30" : "text-white/60"
                  }`}>
                    {step}
                  </p>
                  {!isDone && !isActive && cumulativeStarts[i] > 0 && (
                    <p className="text-brew-muted font-mono-num text-xs">@ {formatSeconds(cumulativeStarts[i])}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── SwirlButton ────────────────────────────────────────────────────────────

interface SwirlButtonProps {
  label: string;
  isStir?: boolean;   // true = Washed (vigorous back-and-forth); false = gentle circular swirl
  cueActive?: boolean; // highlight to prompt the user it's time to agitate
}

function SwirlButton({ label, isStir = false, cueActive = false }: SwirlButtonProps) {
  const [spinKey, setSpinKey] = useState(0);
  const [tapped, setTapped]   = useState(false);

  const handleTap = () => {
    setSpinKey(k => k + 1);
    setTapped(true);
    setTimeout(() => setTapped(false), 650);
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(isStir ? [55, 30, 55] : 55);
    }
  };

  // Visual state: tapped overrides cue, cue overrides idle
  const isHighlighted = tapped || cueActive;

  return (
    <button
      type="button"
      onClick={handleTap}
      className={`flex-shrink-0 w-16 h-16 rounded-2xl flex flex-col items-center justify-center gap-1 border transition-all active:scale-90 ${
        isHighlighted
          ? "bg-brew-accent/20 border-brew-accent/60"
          : "bg-brew-surface border-brew-border"
      } ${cueActive && !tapped ? "animate-step-activate" : ""}`}
    >
      {isStir ? (
        // Stir icon: two opposing arrows (vigorous back-and-forth)
        <svg
          key={spinKey}
          className={`w-7 h-7 ${isHighlighted ? "text-brew-accent" : "text-white/60"} ${tapped ? "animate-spin-once" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 8l-3 3 3 3" />
          <path d="M1 11h9" />
          <path d="M20 16l3-3-3-3" />
          <path d="M23 13H14" />
          <path d="M10 8h4" />
          <path d="M10 16h4" />
        </svg>
      ) : (
        // Swirl icon: gentle circular arrow (existing)
        <svg
          key={spinKey}
          className={`w-7 h-7 ${isHighlighted ? "text-brew-accent animate-spin-once" : "text-white/60"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
        >
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
      )}
      <span className={`text-xs font-medium ${isHighlighted ? "text-brew-accent" : "text-white/30"}`}>
        {label}
      </span>
    </button>
  );
}

// ── MiniStat ───────────────────────────────────────────────────────────────

/**
 * Strip brand prefixes ("Niche° ", "Niche Zero ", "Comandante C40 ") and unit
 * suffixes (" clicks") from the grind value — the user already knows which grinder
 * they picked, so just show the number: "388°" or "24".
 */
function stripGrindPrefix(raw: string): string {
  return raw
    .replace(/niche(\s*(zero)?)?[\s°]*/i, "")   // "Niche° 388°" → "388°"
    .replace(/comandante(\s*(c40\s*(mk\d)?)?)?[\s]*/i, "") // "Comandante C40 24 clicks" → "24 clicks"
    .replace(/\s*clicks?\s*$/i, "")              // "24 clicks" → "24"
    .trim() || raw;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-brew-muted text-xs uppercase tracking-widest mb-0.5">{label}</p>
      <p className="font-mono-num text-white text-sm font-medium truncate">{value}</p>
    </div>
  );
}

