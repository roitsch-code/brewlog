/**
 * Brew-step Apple Watch bridge — hands the whole step schedule to the watch at
 * brew start, so the watch app runs the timeline locally and buzzes the wrist
 * at each step (via a physical-therapy extended-runtime session — the only thing
 * that buzzes the wrist while the iPhone screen is ON during a wake-locked brew).
 *
 * Absolute epoch-ms fire times mean a slightly-late delivery self-corrects: the
 * watch schedules `atMs - Date.now()` for each remaining boundary and drops any
 * already in the past.
 *
 * Pure-web module, ZERO `@capacitor/*` imports (ambient types only). Off the
 * native shell every export is a silent no-op.
 */
import type { BrewBoundary } from "@/lib/native/brewNotifications";

export interface WatchFire {
  /** Epoch milliseconds at which the watch should buzz. */
  atMs: number;
  /** Short label shown on the watch face for this step. */
  label: string;
}

interface BrewWatchPluginLike {
  startBrew(options: { recipeName: string; brewId: number; fires: WatchFire[] }): Promise<void>;
  endBrew(): Promise<void>;
}

interface CapacitorLike {
  isNativePlatform?: () => boolean;
  Plugins?: { BrewWatch?: BrewWatchPluginLike };
}

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

/** Convert the brew's relative-second boundaries into absolute epoch-ms fires. */
export function boundariesToFires(boundaries: BrewBoundary[], startedAtMs: number): WatchFire[] {
  return boundaries.map((b) => ({ atMs: startedAtMs + Math.round(b.atSec * 1000), label: b.title }));
}

/** Hand the watch the full schedule at brew start. No-op off the native shell. */
export function startBrewOnWatch(
  boundaries: BrewBoundary[],
  startedAtMs: number,
  recipeName: string,
): void {
  const plugin = getPlugin();
  if (!plugin) return;
  const fires = boundariesToFires(boundaries, startedAtMs);
  if (fires.length === 0) return;
  // startedAtMs doubles as the stable brewId — the watch dedupes on it, so the
  // periodic re-send from the hook never restarts an already-running brew.
  void plugin.startBrew({ recipeName, brewId: startedAtMs, fires }).catch(() => {});
}

/** Tell the watch the brew ended / reset. No-op off the native shell. */
export function endBrewOnWatch(): void {
  const plugin = getPlugin();
  if (!plugin) return;
  void plugin.endBrew().catch(() => {});
}
