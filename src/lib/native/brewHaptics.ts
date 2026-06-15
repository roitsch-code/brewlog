/**
 * Brew-step HAPTICS — foreground Taptic cues for the iOS shell.
 *
 * Why this exists separately from brewNotifications.ts: during an active brew
 * the screen is held awake (wake lock), so the phone is NEVER on its lock
 * screen — the lock-screen notifications never show. The user is looking at
 * (or distracted near) an unlocked, foregrounded app. The only thing that can
 * refocus them then is a real vibration, and `navigator.vibrate()` — which the
 * timer already calls — is silently IGNORED by iOS inside a WKWebView. So this
 * module drives the native `@capacitor/haptics` plugin instead, which IS able
 * to fire Taptic feedback in the foreground.
 *
 * Pure-web module, ZERO `@capacitor/*` imports (strict-TS clean, ambient types
 * only). In any non-shell context (Safari PWA, desktop, CI Chromium) every
 * export is a silent no-op — the plugin is absent, so `getHaptics()` returns
 * null. Native-only by design: the existing `navigator.vibrate` path keeps
 * serving Android, and we don't want a double buzz there.
 *
 * Cue design (driven live by useBrewStepHaptics on the timer's tick — haptics
 * CANNOT be pre-scheduled like notifications; they must fire at the moment):
 *   - the last 3 seconds before a step: three short MEDIUM impact taps (3-2-1),
 *   - at the step boundary: one strong, longer continuous buzz.
 */

// ── Ambient bridge types (no @capacitor/* imports) ──────────────────────────

interface HapticsLike {
  impact(options: { style: string }): Promise<void>;
  vibrate(options: { duration: number }): Promise<void>;
}

interface CapacitorLike {
  isNativePlatform?: () => boolean;
  Plugins?: { Haptics?: HapticsLike };
}

// NB: we do NOT augment `Window.Capacitor` here — brewNotifications.ts already
// declares it with a different Plugins shape, and two global augmentations of
// the same property collide. Read it through a local cast instead.

// ── Cue tuning ───────────────────────────────────────────────────────────────

/** Seconds before a step boundary at which the 3-2-1 countdown taps fire. */
export const COUNTDOWN_SECONDS = [3, 2, 1] as const;

/** iOS UIImpactFeedbackStyle for a countdown tap — short + clearly felt. */
const TICK_STYLE = "MEDIUM";

/** Strong "act now" buzz at the step boundary. The plugin maps `vibrate` to a
 * full-intensity Core Haptics continuous event of this duration (ms) — a long,
 * unmistakable buzz, distinct from the short countdown taps. */
const STEP_BUZZ_MS = 650;

// ── Native bridge access ─────────────────────────────────────────────────────

function getHaptics(): HapticsLike | null {
  try {
    if (typeof window === "undefined") return null;
    const cap = (window as unknown as { Capacitor?: CapacitorLike }).Capacitor;
    if (!cap?.isNativePlatform?.()) return null;
    return cap.Plugins?.Haptics ?? null;
  } catch {
    return null;
  }
}

/** True only inside the Capacitor shell with the Haptics plugin present. */
export function isNativeHaptics(): boolean {
  return getHaptics() !== null;
}

/** One short countdown tap (t-3 / t-2 / t-1). No-op off the native shell. */
export function countdownTap(): void {
  const h = getHaptics();
  if (!h) return;
  // Fire-and-forget; a bridge hiccup must never disturb the brew loop.
  void h.impact({ style: TICK_STYLE }).catch(() => {});
}

/** The strong "do the step now" buzz at a boundary. No-op off the shell. */
export function stepBuzz(): void {
  const h = getHaptics();
  if (!h) return;
  void h.vibrate({ duration: STEP_BUZZ_MS }).catch(() => {});
}
