/**
 * Brew Live Activity bridge — drives an iOS 16.2+ Live Activity (lock screen +
 * Dynamic Island + watch Smart Stack) showing the live brew step + countdown.
 *
 * The timer + progress bar are SYSTEM-rendered (`Text(timerInterval:)`), so they
 * keep ticking on the lock screen even when the WKWebView JS is frozen. Step
 * ADVANCEMENT while the phone is locked is driven by APNs: the activity is
 * started with a push token, which we register with the Hetzner server along
 * with the whole step schedule; the server pushes each step at its boundary time
 * so the activity advances + re-counts-down even with the app suspended. A
 * foreground `update` per step is kept as an instant-update bonus.
 *
 * Pure-web module, ZERO `@capacitor/*` imports (ambient types). Off the native
 * shell every export is a silent no-op.
 */
import { type BrewBoundary, formatNowStep, formatNextStep } from "@/lib/native/brewNotifications";

export interface BrewActivityState {
  currentStep: string;
  nextStep: string;
  /** Epoch SECONDS when the NEXT step fires — the countdown target. */
  nextStepEpoch: number;
  /** Epoch SECONDS when the current step started — progress-bar lower bound. */
  stepStartEpoch: number;
  stepIndex: number;
  stepCount: number;
}

interface ScheduledStep {
  fireEpochMs: number;
  state: BrewActivityState;
}

interface ListenerHandle {
  remove?: () => void;
}

interface LiveActivityPluginLike {
  start(o: { recipeName: string; coffeeName: string } & BrewActivityState): Promise<{ started?: boolean }>;
  update(o: BrewActivityState): Promise<void>;
  end(): Promise<void>;
  addListener(
    event: "liveActivityToken",
    cb: (data: { token: string }) => void,
  ): Promise<ListenerHandle> | ListenerHandle;
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
 * at the target finish. Times are epoch SECONDS.
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
  const currentStep = curIdx >= 0 ? formatNowStep(boundaries[curIdx]) : "Bloom";
  const stepStartSec = curIdx >= 0 ? boundaries[curIdx].atSec : 0;
  const nextIdx = curIdx + 1;
  const hasNext = nextIdx < boundaries.length;
  const nextStep = hasNext ? formatNextStep(boundaries[nextIdx]) : "Drawdown";
  const nextSec = hasNext ? boundaries[nextIdx].atSec : targetTimeSec;
  const startSec = brewStartMs / 1000;
  return {
    currentStep,
    nextStep,
    nextStepEpoch: startSec + nextSec,
    stepStartEpoch: startSec + stepStartSec,
    stepIndex: curIdx + 1,
    stepCount: boundaries.length,
  };
}

/** The per-step push schedule the server arms: each boundary's state + fire time. */
export function buildBrewSchedule(
  boundaries: BrewBoundary[],
  brewStartMs: number,
  targetTimeSec: number,
): ScheduledStep[] {
  return boundaries.map((b) => ({
    fireEpochMs: brewStartMs + b.atSec * 1000,
    state: brewActivityState(boundaries, b.atSec, brewStartMs, targetTimeSec),
  }));
}

// --- push-token registration -------------------------------------------------

interface PendingStart {
  recipeName: string;
  coffeeName: string;
  schedule: ScheduledStep[];
}

let listenerReady = false;
let pendingStart: PendingStart | null = null;

function postStart(token: string, p: PendingStart): void {
  try {
    void fetch("/api/live-activity/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        recipeName: p.recipeName,
        coffeeName: p.coffeeName,
        schedule: p.schedule,
      }),
    }).catch(() => {});
  } catch {
    /* noop */
  }
}

function ensureTokenListener(plugin: LiveActivityPluginLike): void {
  if (listenerReady) return;
  listenerReady = true;
  try {
    // A fresh Activity.request mints a fresh push token, so this fires once per
    // brew; when it does, register the brew that's currently pending.
    void Promise.resolve(
      plugin.addListener("liveActivityToken", ({ token }) => {
        if (pendingStart && token) {
          postStart(token, pendingStart);
          pendingStart = null;
        }
      }),
    ).catch(() => {});
  } catch {
    /* noop */
  }
}

export function startBrewActivity(
  opts: { recipeName: string; coffeeName: string } & BrewActivityState,
  schedule: ScheduledStep[],
): void {
  const plugin = getPlugin();
  if (!plugin) return;
  ensureTokenListener(plugin);
  pendingStart = { recipeName: opts.recipeName, coffeeName: opts.coffeeName, schedule };
  plugin.start(opts).catch(() => {});
}

export function updateBrewActivity(state: BrewActivityState): void {
  getPlugin()?.update(state).catch(() => {});
}

export function endBrewActivity(): void {
  pendingStart = null;
  getPlugin()?.end().catch(() => {});
  try {
    void fetch("/api/live-activity/end", { method: "POST" }).catch(() => {});
  } catch {
    /* noop */
  }
}
