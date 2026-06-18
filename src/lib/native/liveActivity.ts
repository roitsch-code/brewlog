/**
 * Brew Live Activity bridge — drives an iOS 16.2+ Live Activity (lock screen +
 * Dynamic Island) showing the live brew timer and current step.
 *
 * The timer + progress bar are SYSTEM-rendered (`Text(timerInterval:)` /
 * `ProgressView(timerInterval:)`), so they keep ticking on the lock screen even
 * when the WKWebView JS is frozen. Only the step LABEL needs an explicit
 * `update` call, which the hook fires when the step changes while the app is
 * foreground (during a brew the screen is wake-locked, so JS is alive at each
 * step boundary). Locked-phone step-label progression would need APNs ActivityKit
 * pushes — out of scope for v1; the ticking timer covers the locked case.
 *
 * Pure-web module, ZERO `@capacitor/*` imports (ambient types). Off the native
 * shell every export is a silent no-op.
 */
import type { BrewBoundary } from "@/lib/native/brewNotifications";

export interface BrewActivityState {
  currentStep: string;
  nextStep: string;
  /** Epoch ms when the NEXT step fires — the countdown target. */
  nextStepMs: number;
  /** Epoch ms when the current step started — progress-bar lower bound. */
  stepStartMs: number;
  stepIndex: number;
  stepCount: number;
}

interface LiveActivityPluginLike {
  start(o: { recipeName: string; coffeeName: string } & BrewActivityState): Promise<{ started?: boolean }>;
  update(o: BrewActivityState): Promise<void>;
  end(): Promise<void>;
}

interface CapacitorLike {
  isNativePlatform?: () => boolean;
  Plugins?: { LiveActivity?: LiveActivityPluginLike };
}

function getPlugin(): LiveActivityPluginLike | null {
  try {
    if (typeof window === "undefined") return null;
    const cap = (window as unknown as { Capacitor?: CapacitorLike }).Capacitor;
    if (!cap?.isNativePlatform?.()) return null;
    return cap.Plugins?.LiveActivity ?? null;
  } catch {
    return null;
  }
}

/** True only inside the Capacitor shell with the LiveActivity plugin present. */
export function isNativeLiveActivity(): boolean {
  return getPlugin() !== null;
}

/**
 * Build the activity state from the boundary schedule: the current step (last
 * boundary passed), the next step + when it fires (the countdown target), and
 * when the current step started (progress-bar lower bound). Before the first
 * boundary the current step is "Bloom"; after the last, the "next" is Drawdown
 * at the target finish.
 */
export function brewActivityState(
  boundaries: BrewBoundary[],
  elapsed: number,
  brewStartMs: number,
  targetTimeSec: number,
): BrewActivityState {
  let curIdx = -1;
  for (let i = 0; i < boundaries.length; i++) {
    if (boundaries[i].atSec <= elapsed) curIdx = i;
  }
  const currentStep = curIdx >= 0 ? boundaries[curIdx].title : "Bloom";
  const stepStartSec = curIdx >= 0 ? boundaries[curIdx].atSec : 0;
  const nextIdx = curIdx + 1;
  const hasNext = nextIdx < boundaries.length;
  const nextStep = hasNext ? boundaries[nextIdx].title : "Drawdown";
  const nextSec = hasNext ? boundaries[nextIdx].atSec : targetTimeSec;
  return {
    currentStep,
    nextStep,
    nextStepMs: brewStartMs + nextSec * 1000,
    stepStartMs: brewStartMs + stepStartSec * 1000,
    stepIndex: curIdx + 1,
    stepCount: boundaries.length,
  };
}

export function startBrewActivity(
  opts: { recipeName: string; coffeeName: string } & BrewActivityState,
): void {
  getPlugin()?.start(opts).catch(() => {});
}

export function updateBrewActivity(state: BrewActivityState): void {
  getPlugin()?.update(state).catch(() => {});
}

export function endBrewActivity(): void {
  getPlugin()?.end().catch(() => {});
}
