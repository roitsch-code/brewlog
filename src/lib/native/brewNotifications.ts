/**
 * Brew-step BOUNDARIES + a legacy-notification sweep.
 *
 * History: this module used to SCHEDULE iOS lock-screen notifications at every
 * pour/step boundary (so a locked/pocketed phone + its watch would buzz). That
 * was removed by owner request (2026-06-15): the brew runs with the app open +
 * wake-locked, so the phone is never on its lock screen — the notifications
 * only ever fired as **orphans after a force-quit** (iOS can't cancel a
 * scheduled notification once the app is killed). The foreground Taptic haptics
 * (`brewHaptics.ts`) are the only cue now; real wrist-always haptics will come
 * from a native Apple Watch app (roadmap G4 Tier 2), which is lifecycle-bound
 * and so can't orphan.
 *
 * What stays:
 *  - `buildBrewBoundaries()` — the pure step→cue schedule, now consumed only by
 *    `useBrewStepHaptics` (haptics fire LIVE off these times).
 *  - `sweepBrewNotifications()` — a one-shot cancel of the old fixed id range,
 *    called once on app open (LightShell) to clear any orphans a pre-removal
 *    build may have left pending. Pure no-op off the native shell.
 */

import type { PourStep, GuideStep } from "@/lib/utils/pourSequence";
import { isAgitationPourAction } from "@/lib/utils/pourSequence";

// ── Ambient bridge types (no @capacitor/* imports — strict-TS clean) ────────

interface LocalNotificationsLike {
  cancel(options: { notifications: Array<{ id: number }> }): Promise<unknown>;
}

interface CapacitorLike {
  isNativePlatform?: () => boolean;
  Plugins?: { LocalNotifications?: LocalNotificationsLike };
}

declare global {
  interface Window {
    Capacitor?: CapacitorLike;
  }
}

// ── Boundary model ───────────────────────────────────────────────────────────

/** One notification-worthy moment in a brew, relative to brew start. */
export interface BrewBoundary {
  /** Seconds since brew start. */
  atSec: number;
  title: string;
  body: string;
}

/** The fixed notification id range a pre-removal build scheduled into. The
 * sweep cancels the whole range so any orphan from before this change clears on
 * the next app open. */
const ID_BASE = 9300;
const ID_RANGE = 40;

function formatClock(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

/**
 * Derive the notification schedule from a brew's parsed steps. Pure — safe to
 * call on every render. Skips the bloom (t=0, the user just pressed Start and
 * is watching) and setup steps, and appends a final "brew finishing" boundary
 * at `targetTimeSec` when it lands meaningfully after the last step.
 */
export function buildBrewBoundaries(
  steps: PourStep[] | null,
  guideSteps: GuideStep[] | null,
  targetTimeSec?: number,
): BrewBoundary[] {
  const out: BrewBoundary[] = [];

  if (steps && steps.length > 0) {
    // Percolation (V60/Orea/Kalita/Chemex) — cumulative-grams pours plus
    // discrete agitation steps (swirl/stir/tap), each timed to its own moment.
    for (const s of steps) {
      if (s.startTimeSec <= 0) continue;
      if (isAgitationPourAction(s.action)) {
        // Agitation step: no grams — the cue IS the action.
        out.push({
          atSec: s.startTimeSec,
          title: s.label,
          body: s.notes ?? "after the pour",
        });
        continue;
      }
      const parts = [`→ ${s.cumulativeGrams}g total`];
      if (s.temperatureC != null) parts.push(`${s.temperatureC}°C`);
      out.push({
        atSec: s.startTimeSec,
        title: `${s.label} — +${s.pourGrams}g`,
        body: parts.join(" · "),
      });
    }
    if (targetTimeSec != null && targetTimeSec - (out[out.length - 1]?.atSec ?? 0) >= 5) {
      out.push({
        atSec: targetTimeSec,
        title: "Drawdown — brew finishing",
        body: `Target ${formatClock(targetTimeSec)} reached.`,
      });
    }
    return out;
  }

  if (guideSteps && guideSteps.length > 0) {
    // Immersion / AeroPress / iced — action steps (steep end, flip, press…).
    for (const s of guideSteps) {
      if (s.isSetup || s.startTimeSec <= 0) continue;
      const parts: string[] = [];
      if (s.cumulativeGrams != null) parts.push(`→ ${s.cumulativeGrams}g`);
      if (s.temperatureC != null) parts.push(`${s.temperatureC}°C`);
      if (s.notes) parts.push(s.notes);
      out.push({
        atSec: s.startTimeSec,
        title: s.label,
        body: parts.join(" · "),
      });
    }
    if (targetTimeSec != null && targetTimeSec - (out[out.length - 1]?.atSec ?? 0) >= 5) {
      out.push({
        atSec: targetTimeSec,
        title: "Brew finishing",
        body: `Target ${formatClock(targetTimeSec)} reached.`,
      });
    }
    return out;
  }

  return out; // prose-only legacy sequence — no machine-readable boundaries
}

// ── Native bridge access ─────────────────────────────────────────────────────

function getPlugin(): LocalNotificationsLike | null {
  try {
    if (typeof window === "undefined") return null;
    const cap = window.Capacitor;
    if (!cap?.isNativePlatform?.()) return null;
    return cap.Plugins?.LocalNotifications ?? null;
  } catch {
    return null;
  }
}

/**
 * One-shot: cancel any brew notification a pre-removal build left pending in the
 * fixed id range. Call once on app open (LightShell). Brews no longer schedule
 * notifications, so this only ever clears legacy orphans. Pure no-op off the
 * native shell or if the plugin is absent — never throws.
 */
export async function sweepBrewNotifications(): Promise<void> {
  const plugin = getPlugin();
  if (!plugin) return;
  try {
    const ids = Array.from({ length: ID_RANGE }, (_, i) => ({ id: ID_BASE + i }));
    await plugin.cancel({ notifications: ids });
  } catch {
    /* bridge failure — nothing actionable */
  }
}
