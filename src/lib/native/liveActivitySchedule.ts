/**
 * Live Activity per-step push scheduler (server-side, in-memory).
 *
 * ActivityKit can't schedule future content locally, so at brew start the web
 * hands us the whole step schedule (each step's content-state + its fire time)
 * plus the activity's push token. We arm one timer per step; when a step's time
 * comes we push its update over APNs → the locked-phone activity advances + the
 * countdown resets to the next step.
 *
 * Single-user app → exactly one active brew. A new `scheduleBrew` cancels the
 * previous one; `endBrew` clears everything + sends the end push. The standalone
 * Next server is one long-running process, so module-level timers persist across
 * requests (a process restart mid-brew loses them — acceptable for a ~4-min brew).
 */
import {
  sendLiveActivityPush,
  type LiveActivityState,
} from "@/lib/native/liveActivityPush";

export interface ScheduledStep {
  /** Epoch ms when this step fires. */
  fireEpochMs: number;
  state: LiveActivityState;
}

interface ActiveBrew {
  token: string;
  timers: ReturnType<typeof setTimeout>[];
  lastState: LiveActivityState | null;
}

// Module-level singleton (single user, one brew at a time).
let active: ActiveBrew | null = null;

const MAX_STEPS = 64; // APNs pending-cap headroom; brews have far fewer.

function clearTimers() {
  if (!active) return;
  for (const t of active.timers) clearTimeout(t);
  active.timers = [];
}

/**
 * Arm a push for every future step. Steps already in the past (or <250 ms away)
 * are skipped — the local foreground start already set the initial state, and a
 * just-passed step needs no push. Returns the number of pushes armed.
 */
export function scheduleBrew(token: string, schedule: ScheduledStep[]): number {
  endBrew(false); // cancel any prior brew (no end push — this supersedes it)

  const now = Date.now();
  const timers: ReturnType<typeof setTimeout>[] = [];
  const upcoming = schedule
    .filter((s) => s.fireEpochMs - now > 250)
    .sort((a, b) => a.fireEpochMs - b.fireEpochMs)
    .slice(0, MAX_STEPS);

  active = { token, timers, lastState: null };

  for (const step of upcoming) {
    const delay = step.fireEpochMs - now;
    const timer = setTimeout(() => {
      if (active?.token !== token) return; // superseded by a newer brew
      active.lastState = step.state;
      void sendLiveActivityPush(token, step.state, { event: "update" });
    }, delay);
    timers.push(timer);
  }
  return upcoming.length;
}

/** Cancel all pending pushes and (optionally) end the live activity remotely. */
export function endBrew(sendEndPush = true): void {
  if (!active) return;
  clearTimers();
  const { token, lastState } = active;
  active = null;
  if (sendEndPush) {
    const nowSec = Math.floor(Date.now() / 1000);
    void sendLiveActivityPush(token, lastState, {
      event: "end",
      dismissalEpochSec: nowSec,
    });
  }
}
