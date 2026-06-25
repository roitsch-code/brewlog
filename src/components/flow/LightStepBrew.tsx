"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useFlowStore } from "@/store/flowStore";
import LightFlowShell from "@/components/ui/light/LightFlowShell";
import LightCircularTimer from "@/components/ui/light/CircularTimer";
import { formatSeconds } from "@/lib/utils/formatTime";
import { useWakeLock } from "@/hooks/useWakeLock";
import {
  getActiveIdx,
  isAgitationPourAction,
  poursCompleteAtSec,
  type PourStep,
  type GuideStep,
} from "@/lib/utils/pourSequence";
import { buildBrewTimeline, type BrewTimeline } from "@/lib/brew/timeline";
import type { BrewStepAction } from "@/lib/types/session";
import { basedOnReference } from "@/lib/utils/resolveRecipe";
import { useBrewStepHaptics } from "@/hooks/useBrewStepHaptics";
import { useBrewStepWatch } from "@/hooks/useBrewStepWatch";
import { useBrewLiveActivity } from "@/hooks/useBrewLiveActivity";
import { boundariesFromTimeline } from "@/lib/native/brewNotifications";
import { ScalePanel } from "@/components/flow/ScalePanel";
import ColdBrewSteep from "@/components/flow/ColdBrewSteep";
import { useAcaiaScale } from "@/hooks/useAcaiaScale";
import { coachFlow, type WeightSample, type FlowComparison } from "@/lib/brew/flowCoach";
import { analyzeFlow, type FlowCurvePoint } from "@/lib/brew/flowAnalysis";

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
  // Read the chosen candidate by explicit index (set on the recommend screen).
  // Two candidates can share a method, so name-matching would pick the wrong
  // one — the find-by-method fallback that used to live here is the exact
  // bug PR #193 was engineered to eliminate. For legacy drafts (no idx),
  // pair method + recipe from the same primary source so they stay aligned
  // — never fall back to draft.brew.methodUsed for recipe lookup, because
  // it can point at a different brewer than primaryRecipe carries.
  const idx = draft.brew?.selectedCandidateIdx;
  const selectedCandidate = idx != null ? rec?.candidates?.[idx] : undefined;
  const recipe = selectedCandidate?.recipe ?? rec?.primaryRecipe;
  const method =
    selectedCandidate?.method ?? rec?.primaryMethod ?? draft.brew?.methodUsed ?? "Brew";

  const methodLabel = method;

  // Recipe name shown on the brew screen (the user wants to know WHAT they're
  // brewing, not just the brewer). title is the AI's per-brew name; basedOn is
  // the stable reference recipe it adapts (populated by the recommend model).
  const recipeName = selectedCandidate?.title;
  const basedOn = basedOnReference(selectedCandidate?.basedOn, selectedCandidate?.title);


  const [elapsed, setElapsed] = useState(0);
  const [started, setStarted] = useState(false);

  const { enableWakeLock, disableWakeLock } = useWakeLock();

  const handleTick = useCallback(
    (e: number) => {
      setElapsed(e);
      if (e === 1) {
        setStarted(true);
        enableWakeLock();
        brewStartMsRef.current = Date.now() - 1000; // elapsed=1 ≈ 1 s after start
      }
    },
    [enableWakeLock],
  );

  // ── Live scale (Acaia) ─────────────────────────────────────────────────────
  // The brew screen owns the scale so the live flow coach reads the SAME weight
  // + sample stream the ScalePanel shows. Downsample the ~10–20 Hz BLE stream to
  // ~5 Hz into a rolling ~6 s window — a ref, so samples never trigger renders.
  const samplesRef = useRef<WeightSample[]>([]); // ~6 s rolling window for the live coach
  const fullCurveRef = useRef<FlowCurvePoint[]>([]); // whole-brew curve for post-brew analysis
  const brewStartMsRef = useRef(0);
  const lastSampleMsRef = useRef(0);
  const lastCurveMsRef = useRef(0);
  const pushSample = useCallback((grams: number, atMs: number) => {
    // Live-coach window: ~5 Hz, keep the last 6 s.
    if (atMs - lastSampleMsRef.current >= 200) {
      lastSampleMsRef.current = atMs;
      const buf = samplesRef.current;
      buf.push({ atMs, grams });
      const cutoff = atMs - 6000;
      while (buf.length > 0 && buf[0].atMs < cutoff) buf.shift();
    }
    // Whole-brew curve: ~2 Hz, in brew-relative seconds, for the post-brew report.
    if (brewStartMsRef.current > 0 && atMs - lastCurveMsRef.current >= 500) {
      lastCurveMsRef.current = atMs;
      const tSec = (atMs - brewStartMsRef.current) / 1000;
      if (tSec >= 0) {
        const curve = fullCurveRef.current;
        curve.push({ tSec, grams });
        if (curve.length > 600) curve.shift(); // safety cap (~5 min @ 2 Hz)
      }
    }
  }, []);
  const scale = useAcaiaScale({ onSample: pushSample });

  // Clear capture on reset so a re-brew never coaches/analyses off stale pours.
  useEffect(() => {
    if (elapsed === 0) {
      samplesRef.current = [];
      fullCurveRef.current = [];
      brewStartMsRef.current = 0;
      lastCurveMsRef.current = 0;
    }
  }, [elapsed]);

  // The current timeline, in a ref, so handleDone can analyse without being
  // re-created every render (timeline is a fresh object each render).
  const timelineRef = useRef<BrewTimeline | null>(null);

  const handleDone = useCallback(
    (actualSec?: number) => {
      disableWakeLock();
      // Guard the arg: if a click event leaks in via onNext={handleDone} it is
      // truthy, so `actualSec ?? elapsed` would store the (non-serializable)
      // event as actualTimeSec — which threw inside the localStorage-persisted
      // store and left the brew stuck on this screen, unable to log (#320
      // regression). Coerce anything that isn't a finite number to elapsed.
      const finalSec =
        typeof actualSec === "number" && Number.isFinite(actualSec) ? actualSec : elapsed;
      // If a scale captured the pour, derive the objective flow analysis and let
      // it drive the flow grade (so the log screen needn't ask). Null off-scale /
      // on immersion → nothing changes.
      const analysis = analyzeFlow(timelineRef.current, fullCurveRef.current, finalSec);
      setBrew({
        ...draft.brew,
        methodUsed: method,
        followedRecipe: true,
        actualTimeSec: finalSec,
        ...(analysis
          ? { flowAnalysis: analysis, flowSource: "measured", flow: analysis.derivedFlow }
          : {}),
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

  const roastDate = draft.coffee?.roastDate;

  // The canonical "intended flow" for this recipe — one builder that lowers both
  // percolation and immersion into a single model (the source of truth the live
  // flow coach compares the actual pour against). It also exposes the SAME
  // renderer-ready arrays the two renderers always consumed, so the brew guide is
  // unchanged. See src/lib/brew/timeline.ts.
  const timeline = recipe ? buildBrewTimeline(recipe, roastDate) : null;

  // Percolation → cumulative-grams pour-over renderer; immersion → action-aware
  // step guide; prose → legacy "·"-separated string. All derived once above.
  const steps = timeline?.pourSteps ?? null;
  const guideSteps = timeline?.guideSteps ?? null;
  const proseSequence = timeline?.proseSequence ?? null;
  timelineRef.current = timeline;

  // The step cue schedule (one entry per pour + agitation step). Lock-screen
  // notifications were removed (they only ever orphaned after a force-quit — see
  // brewNotifications.ts); these boundaries now drive the foreground Taptic
  // haptics only — a 3-2-1 countdown then a strong buzz at each step, fired live
  // while the app is awake. Native-only no-op elsewhere.
  const boundaries = timeline ? boundariesFromTimeline(timeline) : [];
  useBrewStepHaptics(boundaries, elapsed, started);

  // Live pour-flow comparison. Off the native shell / immersion / no weight yet
  // → cue "none", so the coach UI renders nothing (no-scale path unchanged).
  const coach = coachFlow(timeline, elapsed, started, scale.weight, samplesRef.current);
  // Hand the whole step schedule to the paired Apple Watch at brew start; the
  // watch app runs the timeline and buzzes the wrist per step via a
  // physical-therapy extended-runtime session (fires screen-off / wrist-down,
  // directly on the watch — no notification delay). Native-only no-op.
  useBrewStepWatch(boundaries, elapsed, started, recipeName ?? "Brew");

  // Live Activity — live brew timer on the lock screen / Dynamic Island. The
  // timer + progress tick natively; the step label updates on step change.
  // Native-only no-op.
  useBrewLiveActivity(
    boundaries,
    elapsed,
    started,
    recipeName ?? "Brew",
    draft.coffee?.name ?? "",
    recipe?.targetTimeSec ?? 0,
  );

  // Cold brew is a long cold immersion steep (hours) — no live pour timer. When
  // the chosen recipe is a cold steep (occasion "cold-brew", or a recipe whose
  // target time is in the hours), render the steep view: recipe card + a
  // "Start steep" that schedules an iOS "ready" reminder, then hand off to log.
  // All the hooks above still run (elapsed stays 0 → they all no-op), so the
  // rules-of-hooks are respected; only the rendered output branches here.
  const isColdSteep =
    !!recipe &&
    (draft.context?.occasion === "cold-brew" || (recipe.targetTimeSec ?? 0) >= 3600);

  if (isColdSteep && recipe) {
    const steepMinutes = Math.min(
      1440,
      Math.max(240, Math.round((recipe.targetTimeSec || 43200) / 60)),
    );
    return (
      <LightFlowShell>
        <ColdBrewSteep
          recipe={recipe}
          methodLabel={methodLabel}
          recipeName={recipeName}
          basedOn={basedOn}
          coffeeName={draft.coffee?.name ?? ""}
          steepMinutes={steepMinutes}
          onLog={() => handleDone(recipe.targetTimeSec || steepMinutes * 60)}
        />
      </LightFlowShell>
    );
  }

  return (
    <LightFlowShell
      onNext={() => handleDone()}
      nextLabel="Done Brewing"
    >
      <div className="flex flex-col gap-5">
        {/* Connect / tare lives here ONLY before the brew starts. Once the timer
            runs, the live weight folds inline into the active pour step's grams
            line — no separate scale card to shove the layout around mid-brew. */}
        {!started && <ScalePanel {...scale} />}
        {recipe && (
          <div className="rounded-3xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 p-4">
            <div className="mb-3">
              <p className="label-eyebrow">{methodLabel}</p>
              {recipeName && (
                <p className="font-fraunces text-[18px] leading-tight text-light-foreground mt-1">
                  {recipeName}
                </p>
              )}
              {basedOn && (
                <p className="text-[11px] text-light-muted-foreground mt-0.5">based on {basedOn}</p>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <MiniStat label="Dose" value={`${recipe.doseGrams}g`} />
              <MiniStat label={recipe.iceGrams ? "Hot" : "Water"} value={`${recipe.waterGrams}g`} />
              <MiniStat label="Temp" value={`${recipe.waterTempC}°`} />
              <MiniStat label="Grind" value={stripGrindPrefix(recipe.grindSize)} />
            </div>
            {recipe.iceGrams != null && recipe.iceGrams > 0 && (
              <div className="mt-2 grid grid-cols-2 gap-2 text-center border-t border-light-foreground/10 pt-2">
                <MiniStat label="Ice" value={`${recipe.iceGrams}g`} />
                <MiniStat label="Final cup" value={`${recipe.waterGrams + recipe.iceGrams}g`} />
              </div>
            )}
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
            coach={coach}
          />
        )}

        {guideSteps && (
          <StepGuide steps={guideSteps} elapsed={elapsed} started={started} coach={coach} />
        )}

        {proseSequence && <StepGuide sequence={proseSequence} elapsed={elapsed} started={started} />}
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
  /** Live pour-flow comparison (scale connected). Null/"none" → nothing renders. */
  coach?: FlowComparison | null;
}

/** The active pour's cumulative-grams figure — and, with a connected scale, a
 * live counter. It ticks "147 / 240g" up toward the step's target right where
 * the recipe already shows the grams, so the scale needs no separate card. Tints
 * amber when the pour drifts off the intended rate (state ahead/behind); calm
 * foreground otherwise. The parent's `font-mono-num` fixes the digit width, so
 * the ticking number never nudges the layout. No scale → the static target. */
function CumulativeTarget({
  target,
  coach,
}: {
  target: number;
  coach?: FlowComparison | null;
}) {
  const live = coach?.liveGrams;
  if (live == null) return <span className="text-light-foreground">{target}g</span>;
  const tint =
    coach?.state === "ahead" || coach?.state === "behind"
      ? "text-light-accent-overtime"
      : "text-light-foreground";
  return (
    <span className={tint}>
      {Math.round(live)} / {target}g
    </span>
  );
}

/** Short SwirlButton label for an agitation step. */
function agitationButtonLabel(action: PourStep["action"]): string {
  return action === "stir" ? "Stir" : action === "tap" ? "Tap" : "Swirl";
}

function LivePourSequence({ steps, elapsed, targetTimeSec, started, coach }: LivePourSequenceProps) {
  const activeIdx = started ? getActiveIdx(elapsed, steps) : -1;
  const activeStep = activeIdx >= 0 ? steps[activeIdx] : null;
  const nextStep = activeIdx >= 0 && activeIdx < steps.length - 1 ? steps[activeIdx + 1] : null;
  const nextCountdown = nextStep ? Math.max(0, nextStep.startTimeSec - elapsed) : null;
  // Draining begins once we're a grace beyond the last step. The grace covers
  // the time to physically pour the last step's water — a flat 20 s cap used to
  // cut big final pours short (the "last pour disappears too fast" bug). See
  // poursCompleteAtSec.
  const allPoursDone = started && elapsed >= poursCompleteAtSec(steps, targetTimeSec);

  const [flashKey, setFlashKey] = useState(0);
  useEffect(() => {
    if (activeIdx > 0) setFlashKey((k) => k + 1);
  }, [activeIdx]);

  // Countdown footer ("Swirl in 0:05") — shared by the pour + agitation cards.
  const countdownFooter =
    nextStep && nextCountdown !== null && nextCountdown <= 20 && nextCountdown > 0 ? (
      <div className="mt-3 pt-3 border-t border-light-foreground/15 flex items-center justify-between">
        <span className="text-[12px] text-light-muted-foreground">{nextStep.label}</span>
        <span
          // key={nextCountdown} so React replaces the DOM node on every tick.
          // Otherwise the infinite opacity pulse can be mid-cycle when the digit
          // changes (6 → 5), and iOS Safari leaves the previous glyph faintly
          // visible behind the new one.
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
    ) : null;

  if (!started) {
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

          {steps.map((step, i) => (
            <TimelineRow
              key={i}
              time={step.startTimeSec === 0 ? "0:00" : formatSeconds(step.startTimeSec)}
              label={
                isAgitationPourAction(step.action) ? (
                  <span className="text-[14px] font-medium text-light-foreground">{step.label}</span>
                ) : (
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-[14px] font-medium text-light-foreground">{step.label}</span>
                    <span className="font-mono-num text-[12px] font-semibold text-light-foreground">+{step.pourGrams}g</span>
                    <span className="font-mono-num text-[12px] text-light-muted-foreground">→ {step.cumulativeGrams}g</span>
                    {step.temperatureC != null && (
                      <span className="font-mono-num text-[12px] text-light-muted-foreground">· {step.temperatureC}°C</span>
                    )}
                  </div>
                )
              }
              isLast={i === steps.length - 1}
            />
          ))}

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
      {activeStep && !allPoursDone && isAgitationPourAction(activeStep.action) && (
        // Agitation step — its own prominent moment (the cue the 3-2-1 buzz lands on).
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
              <p className="text-[12px] text-light-muted-foreground mt-2">
                {activeStep.notes ?? defaultPourNote(activeStep.action)}
              </p>
            </div>
            <SwirlButton
              isStir={activeStep.action === "stir"}
              label={agitationButtonLabel(activeStep.action)}
              cueActive
            />
          </div>
          {countdownFooter}
        </div>
      )}

      {activeStep && !allPoursDone && !isAgitationPourAction(activeStep.action) && (
        // Pour step — grams only; agitation is now a discrete step of its own.
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
                <CumulativeTarget target={activeStep.cumulativeGrams} coach={coach} />
                <span className="text-light-muted-foreground"> total</span>
                {activeStep.temperatureC != null && (
                  <>
                    <span className="text-light-muted-foreground"> · </span>
                    <span className="text-light-foreground">{activeStep.temperatureC}°C water</span>
                  </>
                )}
              </p>
              <p className="text-[12px] text-light-muted-foreground mt-2">
                {activeStep.notes ?? defaultPourNote(activeStep.action)}
              </p>
            </div>
          </div>
          {countdownFooter}
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
  // Label each dot by its action: agitation steps get their own short tag,
  // pours are numbered among the pours only (so an interleaved swirl doesn't
  // bump the pour count).
  let pourNo = 0;
  const stepLabels = steps.map((step) => {
    if (isAgitationPourAction(step.action)) {
      return step.action === "stir" ? "Stir" : step.action === "tap" ? "Tap" : "Swirl";
    }
    pourNo += 1;
    if (step.action === "bloom") return "Bloom";
    if (step.action === "final") return "Final";
    return `P${pourNo}`;
  });
  const labels = ["Ready", ...stepLabels, "Drain"];
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

// ── Pour-over note fallback (LivePourSequence) ────────────────────────────

function defaultPourNote(action: PourStep["action"]): string {
  switch (action) {
    case "bloom":
      return "Pour in slow circles from centre outward";
    case "final":
      return "Last pour";
    case "swirl":
      return "Gentle swirl to even the bed";
    case "stir":
      return "Stir evenly to settle the bed";
    case "tap":
      return "Tap to settle and level the bed";
    default:
      return "Slow spiral from centre outward";
  }
}

// ── StepGuide helpers (immersion / AeroPress / staged) ────────────────────

/** Default per-step hint when a structured step has no note. */
function defaultGuideNote(action: BrewStepAction): string {
  switch (action) {
    case "wait":
      return "Let it steep — don't disturb the bed";
    case "press":
      return "Press down slowly and evenly";
    case "flip":
      return "Flip onto your cup, then press";
    case "invert":
      return "Build it inverted, filter cap off";
    case "drain":
      return "Let it drain through";
    case "bypass":
      return "Add cool water to taste";
    case "stir":
      return "Stir evenly to settle the bed";
    case "swirl":
      return "Gentle swirl to even the bed";
    case "melodrip":
      return "Pour through the Melodrip — minimal turbulence";
    case "agitate-bed":
      return "Agitate the bed to wet it evenly";
    default:
      return "Pour evenly";
  }
}

/** A short, loud tag for the decisive hand-action steps. */
function actionTag(action: BrewStepAction): string | null {
  switch (action) {
    case "flip":
      return "FLIP NOW";
    case "press":
      return "PRESS";
    case "drain":
      return "DRAIN";
    case "bypass":
      return "DILUTE";
    default:
      return null;
  }
}

const isAgitationAction = (a: BrewStepAction) => a === "stir" || a === "swirl" || a === "agitate-bed";
const isStirAction = (a: BrewStepAction) => a === "stir" || a === "agitate-bed";

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

function isSetupText(s: string): boolean {
  // Orientation / assembly only — NOT flip or cap-and-press, which are timed
  // hand-actions the brewer must hit at the right moment.
  return /^inverted|^assemble|^position|^set.?up|^load|^rinse|^place/i.test(s.trim());
}

/** Infer a structured action from a prose step label (legacy recommendations). */
function actionFromText(s: string): BrewStepAction {
  const t = s.toLowerCase();
  if (/plunge|press/.test(t)) return "press";
  if (/\bflip\b/.test(t)) return "flip";
  if (/invert/.test(t)) return "invert";
  if (/bypass|dilute|top.?up|top up/.test(t)) return "bypass";
  if (/drain|draw.?down|release|drip/.test(t)) return "drain";
  if (/steep|wait|brew|\brest\b/.test(t)) return "wait";
  if (/\bstir\b|agitat|mix/.test(t)) return "stir";
  if (/swirl|shake/.test(t)) return "swirl";
  return "pour";
}

/** Normalise a legacy "·"-separated prose sequence into timed GuideSteps. */
function proseToGuideSteps(sequence: string): GuideStep[] {
  const raw = sequence.split(/\s*[·|]\s*/).map((s) => s.trim()).filter(Boolean);
  const all = raw.length >= 2 ? raw : sequence.split(/\s*,\s*/).map((s) => s.trim()).filter(Boolean);
  let clock = 0;
  return all.map((label, i): GuideStep => {
    const action = actionFromText(label);
    const setup = isSetupText(label);
    const durationSec = setup ? 0 : parseStepDuration(label);
    const startTimeSec = setup ? 0 : clock;
    if (!setup) clock += durationSec;
    return { index: i, label, action, startTimeSec, durationSec, isSetup: setup };
  });
}

// ── StepGuide ── immersion / AeroPress / Clever / iced / staged ───────────
// Action-aware, time-driven. Setup (invert / load) shows in a Setup card; the
// timeline auto-advances pour → stir → steep → flip/press → bypass, firing the
// same 2-tone cue + vibration as the pour-over renderer on each transition.

function StepGuide({
  steps: stepsProp,
  sequence,
  elapsed,
  started,
  coach,
}: {
  steps?: GuideStep[];
  sequence?: string;
  elapsed: number;
  started: boolean;
  /** Live scale flow comparison — shown on this view's water-pour steps when the
   * Acaia is connected (same cue the pour-over renderer uses). Null/"none" → nothing. */
  coach?: FlowComparison | null;
}) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const prevAutoIdxRef = useRef(-1);
  const [manualIdx, setManualIdx] = useState<number | null>(null);

  const allSteps = stepsProp ?? (sequence ? proseToGuideSteps(sequence) : []);
  const setupSteps = allSteps.filter((s) => s.isSetup);
  const timed = allSteps.filter((s) => !s.isSetup);

  let autoIdx = 0;
  if (started) {
    for (let i = 0; i < timed.length; i++) {
      if (elapsed >= timed[i].startTimeSec) autoIdx = i;
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

  useEffect(() => {
    if (manualIdx !== null && autoIdx >= manualIdx) setManualIdx(null);
  }, [autoIdx, manualIdx]);

  if (timed.length === 0) return null;

  const current = timed[currentIdx];
  const isLast = currentIdx >= timed.length - 1;
  const tag = actionTag(current.action);
  const isSteep = current.action === "wait";

  const stepCueActive =
    started && elapsed >= current.startTimeSec && elapsed < current.startTimeSec + 10;
  const stepRemaining = started
    ? Math.max(0, current.startTimeSec + current.durationSec - elapsed)
    : current.durationSec;

  const nextStep = currentIdx < timed.length - 1 ? timed[currentIdx + 1] : null;
  const nextCountdown = nextStep && started ? Math.max(0, nextStep.startTimeSec - elapsed) : null;

  return (
    <div className="space-y-3">
      {setupSteps.length > 0 && (
        <div className="rounded-3xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 px-4 py-3">
          <p className="label-eyebrow mb-1">Setup</p>
          {setupSteps.map((s) => (
            <p key={s.index} className="text-[14px] text-light-foreground/70">
              {s.label}
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
            <div className="flex items-center gap-2 mb-1">
              <p className="label-eyebrow">
                Step {currentIdx + 1} of {timed.length}
              </p>
              {tag && (
                <span className="px-2 py-0.5 rounded-full bg-light-foreground text-light-text-on-dark text-[10px] font-semibold tracking-wide">
                  {tag}
                </span>
              )}
            </div>
            <p className="font-fraunces text-[22px] leading-snug text-light-foreground">
              {current.label}
            </p>
            {(current.cumulativeGrams != null || current.temperatureC != null) && (
              <p className="font-mono-num text-[14px] mt-1 text-light-foreground">
                {current.cumulativeGrams != null && (
                  <span>
                    → <CumulativeTarget target={current.cumulativeGrams} coach={coach} />
                  </span>
                )}
                {current.cumulativeGrams != null && current.temperatureC != null && (
                  <span className="text-light-muted-foreground"> · </span>
                )}
                {current.temperatureC != null && <span>{current.temperatureC}°C water</span>}
              </p>
            )}
            <p className="text-[12px] text-light-muted-foreground mt-2">
              {current.notes ?? defaultGuideNote(current.action)}
            </p>
            {isSteep ? (
              <p className="font-mono-num text-[13px] text-light-foreground mt-2">
                Steeping — {formatSeconds(stepRemaining)} left
              </p>
            ) : (
              current.durationSec > 0 && (
                <p className="font-mono-num text-[12px] text-light-muted-foreground mt-1">
                  ~{current.durationSec}s
                </p>
              )
            )}
          </div>
          {isAgitationAction(current.action) && (
            <SwirlButton
              isStir={isStirAction(current.action)}
              label={isStirAction(current.action) ? "Stir" : "Swirl"}
              cueActive={stepCueActive}
            />
          )}
        </div>

        {nextStep && nextCountdown !== null && nextCountdown <= 15 && nextCountdown > 0 && (
          <div className="mt-3 pt-3 border-t border-light-foreground/15 flex items-center justify-between">
            <span className="text-[12px] text-light-muted-foreground">Next: {nextStep.label}</span>
            <span
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

        {!isLast && nextStep && (
          <button
            type="button"
            onClick={() => setManualIdx(currentIdx + 1)}
            className="mt-4 w-full py-2.5 rounded-2xl bg-light-card-default backdrop-blur-light-card backdrop-saturate-150 text-[14px] font-medium text-light-foreground/70 active:scale-95 transition-all text-left px-3"
          >
            <span className="text-light-muted-foreground text-[12px] mr-2">
              {isSteep ? "Done — next:" : "Next:"}
            </span>
            {nextStep.label}
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
          {timed.map((step, i) => {
            const isDone = i < currentIdx;
            const isActive = i === currentIdx;
            return (
              <div
                key={step.index}
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
                    className={`text-[14px] leading-relaxed ${
                      isActive
                        ? "text-light-foreground font-medium"
                        : isDone
                          ? "text-light-muted-foreground"
                          : "text-light-foreground/70"
                    }`}
                  >
                    {step.label}
                    {step.temperatureC != null && (
                      <span className="font-mono-num text-[12px] text-light-muted-foreground"> · {step.temperatureC}°C</span>
                    )}
                  </p>
                  {!isDone && !isActive && step.startTimeSec > 0 && (
                    <p className="font-mono-num text-[12px] text-light-muted-foreground">
                      @ {formatSeconds(step.startTimeSec)}
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
