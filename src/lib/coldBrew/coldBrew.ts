/**
 * Cold-brew / long-steep timer.
 *
 * Unlike the hot brew flow there's no pour guide — you set a coffee + a steep
 * duration (hours), start it, and get reminded when it's ready. The reminder is
 * a SINGLE iOS local notification scheduled at the finish time, which fires even
 * with the app killed/backgrounded (the schedule-one-notification model — iOS
 * doesn't run JS for hours, and it doesn't need to). The active brew is stored
 * in localStorage so the countdown survives a reload / app reopen.
 *
 * Reuses the `@capacitor/local-notifications` plugin already in the shell — no
 * new native build needed. Off the native shell the notification is a no-op
 * (the in-app countdown still works); a desktop/PWA simply won't get the push.
 */

export interface ColdBrew {
  /** Also the notification id (fixed — only one cold brew at a time). */
  id: number;
  coffeeName: string;
  startMs: number;
  endMs: number;
}

const STORE_KEY = "btts.coldbrew.active";
const NOTIF_ID = 9400;

export function getActiveColdBrew(): ColdBrew | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as ColdBrew) : null;
  } catch {
    return null;
  }
}

function persist(cb: ColdBrew | null): void {
  try {
    if (cb) localStorage.setItem(STORE_KEY, JSON.stringify(cb));
    else localStorage.removeItem(STORE_KEY);
  } catch {
    /* ignore */
  }
}

// ── Native LocalNotifications bridge (ambient — no @capacitor/* import) ───────

interface LocalNotificationsLike {
  checkPermissions(): Promise<{ display: string }>;
  requestPermissions(): Promise<{ display: string }>;
  schedule(options: {
    notifications: Array<{ id: number; title: string; body: string; schedule: { at: Date } }>;
  }): Promise<unknown>;
  cancel(options: { notifications: Array<{ id: number }> }): Promise<unknown>;
}

interface CapacitorLike {
  isNativePlatform?: () => boolean;
  Plugins?: { LocalNotifications?: LocalNotificationsLike };
}

function notifications(): LocalNotificationsLike | null {
  try {
    if (typeof window === "undefined") return null;
    const cap = (window as unknown as { Capacitor?: CapacitorLike }).Capacitor;
    if (!cap?.isNativePlatform?.()) return null;
    return cap.Plugins?.LocalNotifications ?? null;
  } catch {
    return null;
  }
}

/** Start a cold brew: persist it + schedule the "ready" notification. */
export async function startColdBrew(coffeeName: string, durationMinutes: number): Promise<ColdBrew> {
  const startMs = Date.now();
  const endMs = startMs + durationMinutes * 60_000;
  const cb: ColdBrew = { id: NOTIF_ID, coffeeName: coffeeName.trim(), startMs, endMs };
  persist(cb);

  const plugin = notifications();
  if (plugin) {
    try {
      const perm = await plugin.checkPermissions();
      if (perm.display !== "granted") await plugin.requestPermissions();
      await plugin.cancel({ notifications: [{ id: NOTIF_ID }] });
      await plugin.schedule({
        notifications: [
          {
            id: NOTIF_ID,
            title: "Cold brew ready",
            body: cb.coffeeName ? `${cb.coffeeName} has finished steeping.` : "Your long steep is done.",
            schedule: { at: new Date(endMs) },
          },
        ],
      });
    } catch {
      /* the in-app countdown still works without the notification */
    }
  }
  return cb;
}

/** Cancel / clear the active cold brew + its scheduled notification. */
export async function cancelColdBrew(): Promise<void> {
  persist(null);
  const plugin = notifications();
  if (plugin) {
    try {
      await plugin.cancel({ notifications: [{ id: NOTIF_ID }] });
    } catch {
      /* ignore */
    }
  }
}

/** Duration presets offered in the UI (label + minutes). */
export const COLD_BREW_PRESETS: Array<{ label: string; minutes: number }> = [
  { label: "8h", minutes: 8 * 60 },
  { label: "12h", minutes: 12 * 60 },
  { label: "16h", minutes: 16 * 60 },
  { label: "24h", minutes: 24 * 60 },
];
