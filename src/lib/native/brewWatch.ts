/**
 * Brew-step APPLE WATCH bridge — the decisive cue for an active brew.
 *
 * Why this exists on top of brewHaptics.ts: during a brew the iPhone screen is
 * held awake (wake lock), so the phone is NEVER on its lock screen. iOS only
 * mirrors notifications to the Watch while the phone is *locked* — so the watch
 * gets nothing in the exact scenario that matters (phone on the counter, screen
 * on). The only way to buzz the wrist per step while the phone screen is on is a
 * native watchOS app that runs the brew schedule itself.
 *
 * This module is the phone→watch handoff. At brew start it hands the native
 * `BrewWatch` Capacitor plugin the WHOLE schedule as ABSOLUTE epoch-ms fire
 * times. The plugin forwards it once over WatchConnectivity; the watch app runs
 * the timeline locally (its own timer + extended-runtime session) and plays a
 * wrist haptic at each boundary — independent of what the phone screen is doing,
 * and resilient to a phone↔watch hiccup mid-brew (the watch already has the
 * whole schedule, so no per-step message can be dropped).
 *
 * Using absolute epoch-ms fire times (not relative offsets) means a slightly
 * late delivery is self-correcting: Apple devices are NTP-synced, so the watch
 * just schedules `atMs - Date.now()` for each remaining boundary and drops any
 * already in the past.
 *
 * Pure-web module, ZERO `@capacitor/*` imports (strict-TS clean, ambient types
 * only). Off the native shell — Safari PWA, desktop, CI Chromium, Android, and
 * iOS until the watch build ships — every export is a silent no-op.
 */

import type { BrewBoundary } from "@/lib/native/brewNotifications";

// ── Ambient bridge types (no @capacitor/* imports) ──────────────────────────

/** One scheduled wrist cue, as an absolute wall-clock time. */
export interface WatchFire {
  /** Epoch milliseconds at which the watch should buzz. */
  atMs: number;
  /** Short label shown on the watch face for this step (e.g. "Pour 2 — +60g"). */
  label: string;
}

interface BrewWatchPluginLike {
  /** Hand the watch the full schedule; it runs the timeline + haptics locally. */
  startBrew(options: { recipeName: string; fires: WatchFire[] }): Promise<void>;
  /** Tell the watch the brew ended / was reset — stop its timeline + runtime session. */
  endBrew(): Promise<void>;
}

interface CapacitorLike {
  isNativePlatform?: () => boolean;
  Plugins?: { BrewWatch?: BrewWatchPluginLike };
}

// NB: do NOT augment `Window.Capacitor` here — brewNotifications.ts already
// declares it with a different Plugins shape, and two global augmentations of
// the same property collide. Read it through a local cast instead.

// ── Native bridge access ─────────────────────────────────────────────────────

function getPlugin(): BrewWatchPluginLike | null {
  try {
    if (typeof window === "undefined") return null;
    const cap = (window as unknown as { Capacitor?: CapacitorLike }).Capacitor;
    if (!cap?.isNativePlatform?.()) return null;
    return cap.Plugins?.BrewWatch ?? null;
  } catch {
    return null;
  }
}

/** True only inside the Capacitor shell with the BrewWatch plugin present. */
export function isNativeWatch(): boolean {
  return getPlugin() !== null;
}

/**
 * Convert the brew's relative-second boundaries into absolute epoch-ms fire
 * times. `startedAtMs` is the wall-clock moment the brew timer hit zero (= now
 * minus the elapsed seconds at the moment we send). Pure — no native access.
 */
export function boundariesToFires(boundaries: BrewBoundary[], startedAtMs: number): WatchFire[] {
  return boundaries.map((b) => ({ atMs: startedAtMs + Math.round(b.atSec * 1000), label: b.title }));
}

/**
 * Hand the watch the full schedule at brew start. No-op off the native shell.
 * Fire-and-forget — a bridge failure must never disturb the brew loop.
 */
export function startBrewOnWatch(
  boundaries: BrewBoundary[],
  startedAtMs: number,
  recipeName: string,
): void {
  const plugin = getPlugin();
  if (!plugin) return;
  const fires = boundariesToFires(boundaries, startedAtMs);
  if (fires.length === 0) return;
  void plugin.startBrew({ recipeName, fires }).catch(() => {});
}

/** Tell the watch the brew ended / reset. No-op off the native shell. */
export function endBrewOnWatch(): void {
  const plugin = getPlugin();
  if (!plugin) return;
  void plugin.endBrew().catch(() => {});
}
