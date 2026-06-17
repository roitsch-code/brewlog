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
  stepLabel: string;
  stepIndex: number;
  stepCount: number;
  /** Epoch ms of the brew's target finish — drives the system timer/progress. */
  endMs: number;
  paused: boolean;
}

interface LiveActivityPluginLike {
  start(o: { recipeName: string; coffeeName: string; startMs: number } & BrewActivityState): Promise<{ started?: boolean }>;
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

/** The current brew step from the boundary schedule (the last boundary passed). */
export function currentBrewStep(
  boundaries: BrewBoundary[],
  elapsed: number,
): { stepLabel: string; stepIndex: number; stepCount: number } {
  let idx = -1;
  for (let i = 0; i < boundaries.length; i++) {
    if (boundaries[i].atSec <= elapsed) idx = i;
  }
  const stepLabel = idx >= 0 ? boundaries[idx].title : "Bloom";
  return { stepLabel, stepIndex: idx + 1, stepCount: boundaries.length };
}

export function startBrewActivity(
  opts: { recipeName: string; coffeeName: string; startMs: number } & BrewActivityState,
): void {
  getPlugin()?.start(opts).catch(() => {});
}

export function updateBrewActivity(state: BrewActivityState): void {
  getPlugin()?.update(state).catch(() => {});
}

export function endBrewActivity(): void {
  getPlugin()?.end().catch(() => {});
}
