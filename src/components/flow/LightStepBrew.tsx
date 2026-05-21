"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useFlowStore } from "@/store/flowStore";
import LightFlowShell from "@/components/ui/light/LightFlowShell";
import LightCircularTimer from "@/components/ui/light/CircularTimer";
import { formatSeconds } from "@/lib/utils/formatTime";
import { useWakeLock } from "@/hooks/useWakeLock";
import { parsePourSteps, getActiveIdx, type PourStep } from "@/lib/utils/pourSequence";

/**
 * Light System fork of /components/flow/StepBrew.tsx.
 *
 * IMPORTANT: Logic is byte-for-byte identical to the Dark version —
 * same parsePourSteps, same getActiveIdx, same wake-lock activation
 * on first tick, same 2-tone Web Audio cue on step auto-advance, same
 * 80 ms navigator.vibrate on Android, same bloom/final cue windows,
 * same prose-method auto-advance. Only the visual layer changes.
 *
 * This is the highest daily-use risk step in the migration (Markus'
 * morning brew runs on this timer), so the discipline is: copy the
 * Dark file verbatim, swap surface classes, never touch hooks /
 * useEffect deps / parsePourSteps inputs / step transition triggers.
 *
 * Mounted only by /app/(light)/brew/preview when step === "brew".
 * Dark StepBrew keeps painting /brew/new until cut-over.
 */

export default function LightStepBrew() {
  const { draft, setBrew, setStep } = useFlowStore();
  const rec = draft.recommendation;
  const method = draft.brew?.methodUsed || rec?.primaryMethod || "Brew";
  const recipe = rec?.candidates?.find((c) => c.method === method)?.recipe ?? rec?.primaryRecipe;

  const methodLabel = method;

  const [elapsed, setElapsed] = useState(0);
  const [started, setStarted] = useState(false);

  const { enableWakeLock, disableWakeLock } = useWakeLock();

  const handleTick = useCallback(
    (e: number) => {
      setElapsed(e);
      if (e === 1) {
        setStarted(true);
        enableWakeLock();
      }
    },
    [enableWakeLock],
  );

  const handleDone = useCallback(
    (actualSec?: number) => {
      disableWakeLock();
      setBrew({
        ...draft.brew,
        methodUsed: method,
        followedRecipe: true,
        actualTimeSec: actualSec ?? elapsed,
      });
      setStep("log");
    },
    [draft.brew, method, elapsed, setBrew, setStep, disableWakeLock],
  );

  const handleTimerComplete = useCallback(
    (e: number) => {
      setBrew({
        ...draft.brew,
        methodUsed: method,
        followedRecipe: true,
        actualTimeSec: e,
      });
    },
    [draft.brew, method, setBrew],
  );

  const steps =
    recipe?.pourSequence && recipe.targetTimeSec
      ? parsePourSteps(recipe.pourSequence, recipe.targetTimeSec, draft.coffee?.roastDate)
      : null;

  const isProseMethod = recipe?.pourSequence && !steps;

  return (
    <LightFlowShell onNext={() => handleDone()} nextLabel="Done Brewing">
      <div className="flex flex-col gap-5">
        {recipe && (
          <div className="rounded-3xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 p-4">
            <p className="label-eyebrow mb-3">{methodLabel}</p>
            <div className="grid grid-cols-4 gap-2 text-center">
              <MiniStat label="Dose" value={`${recipe.doseGrams}g`} />
              <MiniStat label="Water" value={`${recipe.waterGrams}g`} />
              <MiniStat label="Temp" value={`${recipe.waterTempC}°`} />
              <MiniStat label="Grind" value={stripGrindPrefix(recipe.grindSize)} />
            </div>
          </div>
        )}

        <LightCircularTimer
          targetSeconds={recipe?.targetTimeSec}
          onComplete={handleTimerComplete}
          onTick={handleTick}
        />

        {steps && recipe && (
          <LivePourSequence
            steps={steps}
            elapsed={elapsed}
            targetTimeSec={recipe.targetTimeSec}
            started={started}
            process={draft.coffee?.process}
          />
        )}

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
    </LightFlowShell>
  );
}

// ── LivePourSequence ── pour-over methods (V60, Orea, Kalita, Chemex) ─────

interface LivePourSequenceProps {
  steps: PourStep[];
  elapsed: number;
  targetTimeSec: number;
  started: boolean;
  process?: string;
}

function LivePourSequence({
  steps,
  elapsed,
  targetTimeSec,
  started,
  process,
}: LivePourSequenceProps) {
  const activeIdx = started ? getActiveIdx(elapsed, steps) : -1;
  const activeStep = activeIdx >= 0 ? steps[activeIdx] : null;
  const nextStep = activeIdx >= 0 && activeIdx < steps.length - 1 ? steps[activeIdx + 1] : null;
  const isWashed = process?.toLowerCase() === "washed";
  const bloomCueActive =
    started && activeStep?.action === "bloom" && elapsed >= 20 && elapsed < 40;
  const finalStep = steps[steps.length - 1];
  const finalCueActive =
    started &&
    activeStep?.action === "final" &&
    elapsed >= finalStep.startTimeSec + 28 &&
    elapsed < finalStep.startTimeSec + 55;
  const nextCountdown = nextStep ? Math.max(0, nextStep.startTimeSec - elapsed) : null;
  const lastPourStart = steps[steps.length - 1].startTimeSec;
  const pourGraceSec = Math.min(20, Math.round((targetTimeSec - lastPourStart) * 0.35));
  const allPoursDone = started && elapsed >= lastPourStart + pourGraceSec;

  const [flashKey, setFlashKey] = useState(0);
  useEffect(() => {
    if (activeIdx > 0) setFlashKey((k) => k + 1);
  }, [activeIdx]);

  if (!started) {
    const bloomAgitation = isWashed ? "Stir 3–5×" : "Gentle swirl";
    const finalAgitation = "Gentle swirl";

    return (
      <div className="rounded-3xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 p-4">
        <p className="label-eyebrow mb-4">Pour Sequence</p>

        <div className="space-y-0">
          <TimelineRow
            time=""
            isFirst
            label={<span className="text-[13px] text-light-muted-foreground">Ready</span>}
            isLast={false}
          />

          {steps.map((step, i) => {
            const agitation =
              step.action === "bloom"
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
                      <span className="text-[14px] font-medium text-light-foreground">{step.label}</span>
                      <span className="font-mono-num text-[12px] font-semibold text-light-foreground">+{step.pourGrams}g</span>
                      <span className="font-mono-num text-[12px] text-light-muted-foreground">→ {step.cumulativeGrams}g</span>
                    </div>
                    {agitation && (
                      <span className="text-[12px] text-light-muted-foreground block mt-0.5">
                        {agitation}
                      </span>
                    )}
                  </div>
                }
                isLast={i === steps.length - 1}
              />
            );
          })}

          <TimelineRow
            time={formatSeconds(targetTimeSec)}
            label={<span className="text-[13px] text-light-muted-foreground">Drawdown complete</span>}
            isLast={true}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activeStep && !allPoursDone && (
        <div
          key={`step-${flashKey}`}
          className="rounded-3xl bg-light-card-selected backdrop-blur-light-card backdrop-saturate-150 shadow-light-card-pressed p-4 animate-step-activate"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="label-eyebrow mb-1">Now</p>
              <p className="font-fraunces text-[24px] leading-tight text-light-foreground">
                {activeStep.label}
              </p>
              <p className="font-mono-num text-[14px] mt-1">
                <span className="font-semibold text-light-foreground">+{activeStep.pourGrams}g</span>
                <span className="text-light-muted-foreground"> → </span>
                <span className="text-light-foreground">{activeStep.cumulativeGrams}g total</span>
              </p>
              {activeStep.action === "bloom" && (
                <p className="text-[12px] text-light-muted-foreground mt-2">
                  Pour in slow circles from centre outward
                </p>
              )}
              {activeStep.action === "pour" && (
                <p className="text-[12px] text-light-muted-foreground mt-2">
                  Slow spiral from centre outward
                </p>
              )}
              {activeStep.action === "final" && (
                <p className="text-[12px] text-light-muted-foreground mt-2">
                  Last pour — swirl gently after
                </p>
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

          {nextCountdown !== null && nextCountdown <= 20 && nextCountdown > 0 && (
            <div className="mt-3 pt-3 border-t border-light-foreground/15 flex items-center justify-between">
              <span className="text-[12px] text-light-muted-foreground">{nextStep!.label}</span>
              <span
                // key={nextCountdown} so React replaces the DOM node on every
                // tick. Otherwise the infinite opacity pulse can be mid-cycle
                // when the digit changes (6 → 5), and iOS Safari leaves the
                // previous glyph faintly visible behind the new one.
                key={nextCountdown}
                className={`font-mono-num text-[14px] ${
                  nextCountdown <= 5
                    ? "font-bold text-light-foreground animate-countdown-pulse"
                    : "font-medium text-light-muted-foreground"
                }`}
              >
                in 0:{String(nextCountdown).padStart(2, "0")}
              </span>
            </div>
          )}
        </div>
      )}

      {allPoursDone && (
        <div className="rounded-3xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 p-4 animate-step-activate">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="label-eyebrow mb-1">Draining</p>
              <p className="text-[14px] text-light-foreground">
                All pours done — wait for drawdown
              </p>
              <p className="font-mono-num text-[12px] text-light-muted-foreground mt-1">
                Target finish: {formatSeconds(targetTimeSec)}
              </p>
            </div>
            {steps[steps.length - 1].action === "final" && <SwirlButton label="Swirl" />}
          </div>
        </div>
      )}

      <StepDots steps={steps} activeIdx={activeIdx} allDone={allPoursDone} />
    </div>
  );
}

// ── TimelineRow ────────────────────────────────────────────────────────────

function TimelineRow({
  time,
  label,
  isLast,
  isFirst = false,
}: {
  time: string;
  label: React.ReactNode;
  isLast: boolean;
  isFirst?: boolean;
}) {
  return (
    <div className="flex items-center gap-0 min-h-[44px]">
      <div className="w-10 shrink-0 flex items-center justify-end pr-3">
        <span className="font-mono-num text-[11px] text-light-muted-foreground leading-none whitespace-nowrap">
          {time}
        </span>
      </div>
      <div className="relative flex flex-col items-center w-4 shrink-0 self-stretch">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-2.5 h-2.5 rounded-full bg-light-foreground/40" />
        {!isLast && (
          <div className="absolute top-1/2 bottom-0 left-1/2 -translate-x-1/2 w-px bg-light-foreground/15" />
        )}
        {!isFirst && (
          <div className="absolute top-0 bottom-1/2 left-1/2 -translate-x-1/2 w-px bg-light-foreground/15" />
        )}
      </div>
      <div className="flex-1 pl-3 py-2">{label}</div>
    </div>
  );
}

// ── StepDots ─── horizontal progress track during brew ────────────────────

function StepDots({
  steps,
  activeIdx,
  allDone,
}: {
  steps: PourStep[];
  activeIdx: number;
  allDone: boolean;
}) {
  const pourLabels = steps.map((_, i) =>
    i === 0 ? "Bloom" : i === steps.length - 1 ? "Final" : `P${i + 1}`,
  );
  const labels = ["Ready", ...pourLabels, "Drain"];
  const total = labels.length;
  const currentPos = allDone ? total - 1 : activeIdx === -1 ? 0 : activeIdx + 1;
  const fillPct = total > 1 ? (currentPos / (total - 1)) * 100 : 0;

  return (
    <div className="px-1">
      <div className="relative flex items-start justify-between">
        <div className="absolute top-[10px] left-[10px] right-[10px] h-px bg-light-foreground/15" />
        <div
          className="absolute top-[10px] left-[10px] h-px bg-light-foreground transition-all duration-500"
          style={{ width: `${fillPct}%` }}
        />

        {labels.map((label, pos) => {
          const isActive = pos === currentPos;
          return (
            <div key={pos} className="relative flex flex-col items-center gap-1.5 z-10">
              <div className="w-5 h-5 flex items-center justify-center">
                <div
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                    isActive ? "bg-light-foreground scale-[1.3]" : "bg-light-foreground/30"
                  }`}
                />
              </div>
              <span
                className={`text-[10px] font-mono-num leading-none text-center ${
                  isActive ? "text-light-foreground font-medium" : "text-light-muted-foreground"
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ProseStepGuide helpers (identical to Dark) ────────────────────────────

function parseStepDuration(step: string): number {
  const s = step.toLowerCase();
  const mmss = s.match(/(?<!(?:at|until|by)\s{0,3})(\d+):(\d{2})(?=\s|[·,.|]|$)/);
  if (mmss) return +mmss[1] * 60 + +mmss[2];
  const mins = s.match(/(\d+)\s*min(?:ute)?s?/);
  const secs = s.match(/(\d+)\s*s(?:ec(?:ond)?s?)?(?=\s|[·,.|]|$)/);
  if (mins && secs) return +mins[1] * 60 + +secs[1];
  if (mins) return +mins[1] * 60;
  if (secs) return +secs[1];
  if (/press|plunge/.test(s)) return 25;
  if (/steep|wait|brew|rest/.test(s)) return 60;
  if (/stir|agitat|swirl|mix/.test(s)) return 10;
  if (/pour|add|fill|water/.test(s)) return 10;
  return 12;
}

function isSetupStep(s: string): boolean {
  return /^inverted|^flip|^cap\b|^assemble|^position|^set.?up/i.test(s.trim());
}

// ── ProseStepGuide ── AeroPress / Clever Dripper / Moccamaster ─────────────

function ProseStepGuide({
  sequence,
  elapsed,
  started,
}: {
  sequence: string;
  method: string;
  elapsed: number;
  targetTimeSec: number;
  started: boolean;
}) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const prevAutoIdxRef = useRef(-1);
  const [manualIdx, setManualIdx] = useState<number | null>(null);

  const raw = sequence.split(/\s*[·|]\s*/).map((s) => s.trim()).filter(Boolean);
  const all = raw.length >= 2 ? raw : sequence.split(/\s*,\s*/).map((s) => s.trim()).filter(Boolean);

  const setupNotes = all.filter((s) => isSetupStep(s));
  const steps = all.filter((s) => !isSetupStep(s));
  const effectiveSteps = steps.length > 0 ? steps : all;

  const durations = effectiveSteps.map(parseStepDuration);
  const cumulativeStarts = effectiveSteps.map((_, i) =>
    durations.slice(0, i).reduce((a, b) => a + b, 0),
  );

  let autoIdx = 0;
  if (started) {
    for (let i = 0; i < effectiveSteps.length; i++) {
      if (elapsed >= cumulativeStarts[i]) autoIdx = i;
    }
  }

  useEffect(() => {
    if (started && autoIdx > prevAutoIdxRef.current && autoIdx > 0) {
      try {
        if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
        const ctx = audioCtxRef.current;
        const tones: [number, number, number][] = [
          [880, 0, 0.18],
          [660, 0.2, 0.14],
        ];
        tones.forEach(([freq, delay, gain]) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.connect(g);
          g.connect(ctx.destination);
          osc.frequency.value = freq;
          g.gain.setValueAtTime(gain, ctx.currentTime + delay);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.22);
          osc.start(ctx.currentTime + delay);
          osc.stop(ctx.currentTime + delay + 0.25);
        });
      } catch (_e) {
        /* audio unavailable */
      }
      navigator.vibrate?.(80);
    }
    prevAutoIdxRef.current = autoIdx;
  }, [autoIdx, started]);

  const currentIdx = manualIdx !== null ? Math.max(manualIdx, autoIdx) : autoIdx;
  const isLast = currentIdx >= effectiveSteps.length - 1;

  useEffect(() => {
    if (manualIdx !== null && autoIdx >= manualIdx) setManualIdx(null);
  }, [autoIdx, manualIdx]);

  const needsAgitation = (s: string) => /stir|swirl|agitate|mix|shake/i.test(s);
  const isStirStep = (s: string) => /\bstir\b|agitat|mix/i.test(s) && !/swirl/i.test(s);
  const stepCueActive =
    started &&
    elapsed >= cumulativeStarts[currentIdx] &&
    elapsed < cumulativeStarts[currentIdx] + 10;

  const nextStart = currentIdx < effectiveSteps.length - 1 ? cumulativeStarts[currentIdx + 1] : null;
  const nextCountdown = nextStart !== null && started ? Math.max(0, nextStart - elapsed) : null;

  return (
    <div className="space-y-3">
      {setupNotes.length > 0 && (
        <div className="rounded-3xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 px-4 py-3">
          <p className="label-eyebrow mb-1">Setup</p>
          {setupNotes.map((note, i) => (
            <p key={i} className="text-[14px] text-light-foreground/70 capitalize">
              {note}
            </p>
          ))}
        </div>
      )}

      <div
        key={currentIdx}
        className="rounded-3xl bg-light-card-selected backdrop-blur-light-card backdrop-saturate-150 shadow-light-card-pressed p-4 animate-step-activate"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="label-eyebrow mb-1">
              Step {currentIdx + 1} of {effectiveSteps.length}
            </p>
            <p className="font-fraunces text-[22px] leading-snug capitalize text-light-foreground">
              {effectiveSteps[currentIdx]}
            </p>
            {durations[currentIdx] > 0 && (
              <p className="font-mono-num text-[12px] text-light-muted-foreground mt-1">
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

        {nextCountdown !== null && nextCountdown <= 15 && nextCountdown > 0 && (
          <div className="mt-3 pt-3 border-t border-light-foreground/15 flex items-center justify-between">
            <span className="text-[12px] text-light-muted-foreground capitalize">
              Next: {effectiveSteps[currentIdx + 1]}
            </span>
            <span
              // see comment on the pour-countdown span above — same reason
              // for keying on the tick.
              key={nextCountdown}
              className={`font-mono-num text-[14px] ${
                nextCountdown <= 5
                  ? "font-bold text-light-foreground animate-countdown-pulse"
                  : "font-medium text-light-muted-foreground"
              }`}
            >
              {nextCountdown}s
            </span>
          </div>
        )}

        {!isLast && (
          <button
            type="button"
            onClick={() => setManualIdx(currentIdx + 1)}
            className="mt-4 w-full py-2.5 rounded-2xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 text-[14px] font-medium text-light-foreground/70 active:scale-95 transition-all text-left px-3"
          >
            <span className="text-light-muted-foreground text-[12px] mr-2">Next:</span>
            {effectiveSteps[currentIdx + 1]}
          </button>
        )}
        {isLast && (
          <p className="mt-3 text-[12px] text-light-muted-foreground text-center">
            Last step — tap Done Brewing when ready
          </p>
        )}
      </div>

      <div className="rounded-3xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 p-4">
        <div className="space-y-3">
          {effectiveSteps.map((step, i) => {
            const isDone = i < currentIdx;
            const isActive = i === currentIdx;
            return (
              <div
                key={i}
                className={`flex items-start gap-3 transition-opacity ${i > currentIdx ? "opacity-40" : ""}`}
              >
                <div
                  className={`w-5 h-5 rounded-full shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                    isDone
                      ? "bg-light-foreground/15"
                      : isActive
                        ? "border-2 border-light-foreground"
                        : "border border-light-foreground/20"
                  }`}
                >
                  {isDone ? (
                    <svg
                      className="w-3 h-3 text-light-foreground"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="font-mono-num text-[11px] text-light-muted-foreground">{i + 1}</span>
                  )}
                </div>
                <div className="flex-1">
                  <p
                    className={`text-[14px] capitalize leading-relaxed ${
                      isActive
                        ? "text-light-foreground font-medium"
                        : isDone
                          ? "text-light-muted-foreground"
                          : "text-light-foreground/70"
                    }`}
                  >
                    {step}
                  </p>
                  {!isDone && !isActive && cumulativeStarts[i] > 0 && (
                    <p className="font-mono-num text-[12px] text-light-muted-foreground">
                      @ {formatSeconds(cumulativeStarts[i])}
                    </p>
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
  isStir?: boolean;
  cueActive?: boolean;
}

function SwirlButton({ label, isStir = false, cueActive = false }: SwirlButtonProps) {
  const [spinKey, setSpinKey] = useState(0);
  const [tapped, setTapped] = useState(false);

  const handleTap = () => {
    setSpinKey((k) => k + 1);
    setTapped(true);
    setTimeout(() => setTapped(false), 650);
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(isStir ? [55, 30, 55] : 55);
    }
  };

  const isHighlighted = tapped || cueActive;

  return (
    <button
      type="button"
      onClick={handleTap}
      className={`flex-shrink-0 w-16 h-16 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all active:scale-90 backdrop-blur-light-card backdrop-saturate-150 ${
        isHighlighted
          ? "bg-light-card-selected shadow-light-card-pressed"
          : "bg-light-card-default"
      } ${cueActive && !tapped ? "animate-step-activate" : ""}`}
    >
      {isStir ? (
        <svg
          key={spinKey}
          className={`w-7 h-7 text-light-foreground ${tapped ? "animate-spin-once" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M4 8l-3 3 3 3" />
          <path d="M1 11h9" />
          <path d="M20 16l3-3-3-3" />
          <path d="M23 13H14" />
          <path d="M10 8h4" />
          <path d="M10 16h4" />
        </svg>
      ) : (
        <svg
          key={spinKey}
          className={`w-7 h-7 text-light-foreground ${tapped ? "animate-spin-once" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
          />
        </svg>
      )}
      <span
        className={`text-[11px] font-medium ${isHighlighted ? "text-light-foreground" : "text-light-muted-foreground"}`}
      >
        {label}
      </span>
    </button>
  );
}

// ── MiniStat + grind prefix stripper (identical to Dark) ───────────────────

function stripGrindPrefix(raw: string): string {
  return (
    raw
      .replace(/niche(\s*(zero)?)?[\s°]*/i, "")
      .replace(/comandante(\s*(c40\s*(mk\d)?)?)?[\s]*/i, "")
      .replace(/\s*clicks?\s*$/i, "")
      .trim() || raw
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label-eyebrow mb-0.5">{label}</p>
      <p className="font-mono-num text-light-foreground text-[14px] font-medium truncate">{value}</p>
    </div>
  );
}
