"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useFlowStore } from "@/store/flowStore";
import FlowShell from "./FlowShell";
import CircularTimer from "@/components/ui/CircularTimer";
import { formatSeconds } from "@/lib/utils/formatTime";

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

function parsePourSteps(sequence: string, targetTimeSec: number): PourStep[] | null {
  const parts = sequence.split(/\s*[–—\-]\s*/).map(s => s.trim());
  if (parts.length < 2 || !parts.every(p => /^\d+$/.test(p))) return null;

  const milestones = parts.map(Number);
  const n = milestones.length;
  const bloomDur = Math.max(30, Math.min(50, Math.round(targetTimeSec * 0.22)));
  const remaining = targetTimeSec - bloomDur;
  const interval = n > 1 ? remaining / (n - 1) : 0;

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
  const recipe = rec?.primaryRecipe;
  const method = draft.brew?.methodUsed || rec?.primaryMethod || "Brew";

  const [elapsed, setElapsed] = useState(0);
  const [started, setStarted] = useState(false);

  const handleTick = useCallback((e: number) => {
    setElapsed(e);
    if (e === 1) setStarted(true);
  }, []);

  const handleDone = useCallback((actualSec?: number) => {
    setBrew({ ...draft.brew, methodUsed: method, followedRecipe: true, actualTimeSec: actualSec ?? elapsed });
    setStep("log");
  }, [draft.brew, method, elapsed, setBrew, setStep]);

  const handleTimerComplete = useCallback((e: number) => {
    setBrew({ ...draft.brew, methodUsed: method, followedRecipe: true, actualTimeSec: e });
  }, [draft.brew, method, setBrew]);

  const steps = recipe?.pourSequence && recipe.targetTimeSec
    ? parsePourSteps(recipe.pourSequence, recipe.targetTimeSec)
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

        {/* Agitation cue — fixed upper-right corner */}
        {steps && (
          <BrewAgitationCue
            elapsed={elapsed}
            started={started}
            process={draft.coffee?.process}
          />
        )}

        {/* Pour-over: structured live sequence */}
        {steps && recipe && (
          <LivePourSequence
            steps={steps}
            elapsed={elapsed}
            targetTimeSec={recipe.targetTimeSec}
            started={started}
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
}

function LivePourSequence({ steps, elapsed, targetTimeSec, started }: LivePourSequenceProps) {
  const activeIdx = started ? getActiveIdx(elapsed, steps) : -1;
  const activeStep = activeIdx >= 0 ? steps[activeIdx] : null;
  const nextStep  = activeIdx >= 0 && activeIdx < steps.length - 1 ? steps[activeIdx + 1] : null;
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
    return (
      <div className="bg-brew-surface rounded-2xl p-4">
        <p className="text-brew-muted text-xs uppercase tracking-widest mb-4">Pour plan</p>

        {/* Vertical timeline: time | dot+line | content */}
        <div className="space-y-0">
          {/* START anchor */}
          <TimelineRow
            time=""
            dotStyle="start"
            label={<span className="text-brew-muted text-xs tracking-widest uppercase">Start</span>}
            isLast={false}
          />

          {steps.map((step, i) => (
            <TimelineRow
              key={i}
              time={step.startTimeSec === 0 ? "0:00" : formatSeconds(step.startTimeSec)}
              dotStyle={i === 0 ? "accent" : "default"}
              label={
                <div>
                  <span className="text-white text-sm font-medium">{step.label}</span>
                  <span className="text-brew-accent font-mono-num text-xs ml-2">+{step.pourGrams}g</span>
                  <span className="text-white/30 font-mono-num text-xs ml-1">→ {step.cumulativeGrams}g</span>
                </div>
              }
              isLast={i === steps.length - 1}
            />
          ))}

          {/* Drawdown */}
          <TimelineRow
            time={formatSeconds(targetTimeSec)}
            dotStyle="empty"
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
              <SwirlButton label={activeStep.action === "bloom" ? "Stir" : "Swirl"} />
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
  time, dotStyle, label, isLast
}: {
  time: string;
  dotStyle: "start" | "accent" | "default" | "empty";
  label: React.ReactNode;
  isLast: boolean;
}) {
  return (
    <div className="flex items-center gap-0 min-h-[44px]">
      {/* Time column — fixed width, right-aligned, vertically centered */}
      <div className="w-10 shrink-0 flex items-center justify-end pr-3">
        <span className="font-mono-num text-[11px] text-brew-muted leading-none whitespace-nowrap">{time}</span>
      </div>

      {/* Dot + vertical connector — relative wrapper spans full row height */}
      <div className="relative flex flex-col items-center w-4 shrink-0 self-stretch">
        {/* Dot centered vertically */}
        <div className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-4">
          {dotStyle === "start" ? (
            <div className="w-1.5 h-1.5 rounded-full border border-white/25" />
          ) : dotStyle === "accent" ? (
            <div className="w-3 h-3 rounded-full bg-brew-accent/85" />
          ) : dotStyle === "empty" ? (
            <div className="w-1.5 h-1.5 rounded-full border border-white/20" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-white/40" />
          )}
        </div>
        {/* Connector lines — bottom half of current row to top half of next */}
        {!isLast && (
          <div className="absolute top-1/2 bottom-0 left-1/2 -translate-x-px w-px bg-brew-border" />
        )}
        <div className="absolute top-0 bottom-1/2 left-1/2 -translate-x-px w-px bg-brew-border" style={{ display: dotStyle === "start" ? "none" : "block" }} />
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
        {/* Connecting line behind dots */}
        <div className="absolute top-[9px] left-[9px] right-[9px] h-px bg-brew-border" />
        {/* Progress fill */}
        <div
          className="absolute top-[9px] left-[9px] h-px bg-brew-accent/50 transition-all duration-500"
          style={{ width: `${fillPct}%` }}
        />

        {labels.map((label, pos) => {
          const isDone   = pos < currentPos;
          const isActive = pos === currentPos;
          return (
            <div key={pos} className="relative flex flex-col items-center gap-1.5 z-10">
              <div className={`w-[18px] h-[18px] rounded-full flex items-center justify-center transition-all duration-300 ${
                isDone
                  ? "bg-brew-accent/20 border border-brew-accent/50"
                  : isActive
                    ? "bg-brew-accent/20 border-2 border-brew-accent"
                    : "bg-brew-bg border border-white/20"
              }`}>
                {isDone   && <div className="w-1.5 h-1.5 rounded-full bg-brew-accent/70" />}
                {isActive && <div className="w-1.5 h-1.5 rounded-full bg-brew-accent" />}
              </div>
              <span className={`text-[10px] font-mono-num leading-none text-center ${
                isActive ? "text-brew-accent" : isDone ? "text-white/30" : "text-white/30"
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

  const needsSwirl = (s: string) => /stir|swirl|agitate|mix|shake/i.test(s);

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
          {needsSwirl(effectiveSteps[currentIdx]) && <SwirlButton label="Stir" />}
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

function SwirlButton({ label }: { label: string }) {
  const [spinKey, setSpinKey] = useState(0);
  const [active, setActive]   = useState(false);

  const handleTap = () => {
    setSpinKey(k => k + 1);
    setActive(true);
    setTimeout(() => setActive(false), 650);
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(55);
  };

  return (
    <button
      type="button"
      onClick={handleTap}
      className={`flex-shrink-0 w-16 h-16 rounded-2xl flex flex-col items-center justify-center gap-1 border transition-all active:scale-90 ${
        active
          ? "bg-brew-accent/20 border-brew-accent/60"
          : "bg-brew-surface border-brew-border"
      }`}
    >
      <svg
        key={spinKey}
        className={`w-7 h-7 ${active ? "text-brew-accent animate-spin-once" : "text-white/60"}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.75}
      >
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
      </svg>
      <span className={`text-xs font-medium ${active ? "text-brew-accent" : "text-white/30"}`}>
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

// ── BrewAgitationCue ───────────────────────────────────────────────────────
// Fires at t=5s into the brew (bloom phase) to cue stir or swirl.
// Stir = Washed (vigorous, 3–5×) | Swirl = Natural/Honey (gentle circular).

interface BrewAgitationCueProps {
  elapsed: number;
  started: boolean;
  process?: string;
}

function BrewAgitationCue({ elapsed, started, process }: BrewAgitationCueProps) {
  const [active, setActive] = useState(false);
  const firedRef = useRef(false);

  const isWashed = process?.toLowerCase() === "washed";
  const label = isWashed ? "Stir 3×" : "Swirl";

  useEffect(() => {
    if (!started || firedRef.current) return;
    // Fire at t=5s — gives 5s warning before the 0:10 agitation moment
    if (elapsed >= 5) {
      firedRef.current = true;
      setActive(true);
      // Haptic cue if available
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([60, 40, 60]);
      }
      // Highlight lasts 4 seconds then fades
      const timer = setTimeout(() => setActive(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [elapsed, started]);

  return (
    <div
      className={`fixed top-16 right-4 z-50 flex flex-col items-center gap-1 transition-all duration-500 ${
        active ? "opacity-100 scale-100" : "opacity-20 scale-95"
      }`}
    >
      <div
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
          active
            ? "bg-brew-accent shadow-[0_0_20px_rgba(240,237,232,0.5)]"
            : "bg-brew-surface border border-brew-border"
        }`}
        style={active ? { animation: "cue-pulse 0.6s ease-in-out 3" } : undefined}
      >
        {isWashed ? (
          // Stir icon: two opposing horizontal arrows (vigorous back-and-forth)
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#0A0A0A" : "#888"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 8l-3 3 3 3" />
            <path d="M2 11h10" />
            <path d="M19 16l3-3-3-3" />
            <path d="M22 13H12" />
          </svg>
        ) : (
          // Swirl icon: gentle circular arrow (clockwise)
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#0A0A0A" : "#888"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
        )}
      </div>
      <span
        className={`text-xs font-medium transition-all duration-300 ${
          active ? "text-brew-accent" : "text-transparent"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
