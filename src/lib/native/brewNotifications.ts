/**
 * Brew-step lock-screen notifications — the web side of the iOS shell bridge.
 *
 * Pure-web module with ZERO npm dependencies on `@capacitor/*`. When BTTS runs
 * inside the Capacitor shell (TestFlight build, see docs/ios-shell-roadmap.md),
 * the native bridge injects `window.Capacitor` with a `LocalNotifications`
 * plugin proxy; this module schedules an iOS local notification at every
 * pour/step boundary so the cues survive a locked phone — closing the
 * documented "Step alerts during background are missed" gap. In any normal
 * browser (Safari PWA, desktop, CI Chromium) every export is a silent no-op
 * and the existing Web Audio cue + vibration remain the only cues.
 *
 * Design (Phase 1 of the roadmap):
 *  - The full step schedule is known at brew start (`PourStep[]`/`GuideStep[]`
 *    carry `startTimeSec`), so everything is scheduled ONCE, anchored to the
 *    timer's wall-clock start. No background JS needed — iOS fires on time.
 *  - The shell's LocalNotifications config uses `presentationOptions: []`, so
 *    a foregrounded app swallows the banners (Web Audio covers foreground);
 *    locked/backgrounded shows the banner. No double cue.
 *  - A bridge failure must never break the brew timer: every native call is
 *    try/caught and failure degrades to exactly today's behavior.
 *  - Prose-only legacy sequences produce no notifications (documented
 *    limitation — they carry no machine-readable boundaries).
 */

import type { PourStep, GuideStep } from "@/lib/utils/pourSequence";
import { isAgitationPourAction } from "@/lib/utils/pourSequence";

// ── Ambient bridge types (no @capacitor/* imports — strict-TS clean) ────────

interface LocalNotificationLike {
  id: number;
  title: string;
  body: string;
  schedule: { at: Date };
  /** iOS: setting ANY non-nil sound flips the notification from passively
   * delivered (silent banner, no haptic) to "alerting" — it then plays a sound
   * AND fires the default vibration on the iPhone + mirrors the haptic to a
   * paired Apple Watch (when the phone is locked/asleep). A missing custom file
   * falls back to the system default tone. Omitting this field is why early
   * builds buzzed nothing. */
  sound?: string;
  /** iOS interruption level. `timeSensitive` lets a pour cue break through a
   * Focus / Do-Not-Disturb mode and reads as urgent — the right semantic for a
   * live brew timer. (Breaking through Focus also needs the Time-Sensitive
   * entitlement on the App ID; without it this degrades gracefully to a normal
   * alert.) */
  interruptionLevel?: "passive" | "active" | "timeSensitive" | "critical";
}

interface LocalNotificationsLike {
  checkPermissions(): Promise<{ display: string }>;
  requestPermissions(): Promise<{ display: string }>;
  schedule(options: { notifications: LocalNotificationLike[] }): Promise<unknown>;
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

/** Fixed notification id range — cancel always sweeps the whole range so a
 * mid-brew reload can't leave orphans from the previous page load. iOS caps
 * pending local notifications at 64; no brew has anywhere near 40 steps. */
const ID_BASE = 9300;
const ID_RANGE = 40;

/** Skip boundaries closer than this to "now" when scheduling — the user is
 * looking at the screen and the foreground cue already covers them. */
const MIN_LEAD_MS = 2000;

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

/** True only inside the Capacitor shell with the plugin present. */
export function isNativeShell(): boolean {
  return getPlugin() !== null;
}

/** iOS never re-prompts after a denial — cache it so a denied user doesn't pay
 * a failed permission round-trip on every brew. */
let permissionDenied = false;

/**
 * Resolve notification permission, prompting at most once (in-foreground,
 * right after Start Brew — the moment the user's intent is clearest).
 */
export async function ensurePermission(): Promise<boolean> {
  const plugin = getPlugin();
  if (!plugin || permissionDenied) return false;
  try {
    const status = await plugin.checkPermissions();
    if (status.display === "granted") return true;
    if (status.display === "denied") {
      permissionDenied = true;
      return false;
    }
    const req = await plugin.requestPermissions();
    if (req.display === "granted") return true;
    permissionDenied = true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Cancel-then-schedule the full brew. `anchorMs` is the wall-clock timestamp
 * of brew start (Date.now() − elapsed·1000 — same anchor the timer runs on).
 * Boundaries already past or within MIN_LEAD_MS are skipped.
 */
export async function scheduleBrew(boundaries: BrewBoundary[], anchorMs: number): Promise<void> {
  const plugin = getPlugin();
  if (!plugin) return;
  try {
    await cancelBrew();
    const now = Date.now();
    const notifications = boundaries.slice(0, ID_RANGE).flatMap((b, i) => {
      const at = new Date(anchorMs + b.atSec * 1000);
      if (at.getTime() - now < MIN_LEAD_MS) return [];
      return [
        {
          id: ID_BASE + i,
          title: b.title,
          body: b.body,
          schedule: { at },
          // Make the cue alerting, not passive — sound + iPhone vibration +
          // Apple Watch haptic on a locked phone. See LocalNotificationLike.
          sound: "default",
          interruptionLevel: "timeSensitive" as const,
        },
      ];
    });
    if (notifications.length > 0) await plugin.schedule({ notifications });
  } catch {
    /* bridge failure — brew continues with foreground cues only */
  }
}

/** Cancel every brew notification (full fixed id range). */
export async function cancelBrew(): Promise<void> {
  const plugin = getPlugin();
  if (!plugin) return;
  try {
    const ids = Array.from({ length: ID_RANGE }, (_, i) => ({ id: ID_BASE + i }));
    await plugin.cancel({ notifications: ids });
  } catch {
    /* bridge failure — nothing actionable */
  }
}
