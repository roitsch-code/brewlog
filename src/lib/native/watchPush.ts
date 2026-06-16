/**
 * Watch APNs push — the web side.
 *
 * New watch architecture (build 13+): the watch app is a dumb push receiver.
 * It registers for remote notifications, hands its APNs token to the phone over
 * WatchConnectivity; the phone's BrewWatch plugin surfaces that token to JS, and
 * we register it with the server here. Then, at each brew step, the phone POSTs
 * `/api/watch/push` and the server sends an APNs alert to the watch token — so
 * the wrist buzzes synced to the phone, with the watch app CLOSED.
 *
 * Ambient bridge access (zero `@capacitor/*` import, like brewWatch.ts). Every
 * export is a clean no-op off the native shell.
 */

interface BrewWatchPluginLike {
  /** Latest watch APNs token the plugin has received (may be empty). */
  getWatchToken?: () => Promise<{ token?: string }>;
  /** Fires when the watch registers / re-registers its push token. */
  addListener?: (
    event: "watchToken",
    cb: (data: { token?: string }) => void,
  ) => { remove: () => void } | Promise<{ remove: () => void }>;
}

interface CapacitorLike {
  isNativePlatform?: () => boolean;
  Plugins?: { BrewWatch?: BrewWatchPluginLike };
}

function cap(): CapacitorLike | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapacitorLike }).Capacitor;
}

function plugin(): BrewWatchPluginLike | null {
  try {
    const c = cap();
    if (!c?.isNativePlatform?.()) return null;
    return c.Plugins?.BrewWatch ?? null;
  } catch {
    return null;
  }
}

/** True only inside the native shell with the BrewWatch plugin present. */
export function isNativeWatch(): boolean {
  return plugin() !== null;
}

async function registerToken(token: string): Promise<void> {
  if (!token || token.length < 16) return;
  try {
    await fetch("/api/watch/register-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
  } catch {
    /* offline / transient — the watch re-emits its token on next launch */
  }
}

/**
 * Start relaying the watch's push token to the server: register a listener for
 * future tokens and pull the current one if it already arrived. Call once when
 * the brew flow mounts. No-op off the shell.
 */
export function initWatchTokenRelay(): () => void {
  const p = plugin();
  if (!p) return () => {};

  let removeFn: (() => void) | null = null;
  try {
    const sub = p.addListener?.("watchToken", (d) => {
      if (d?.token) void registerToken(d.token);
    });
    if (sub) {
      Promise.resolve(sub).then((s) => {
        if (s && typeof s.remove === "function") removeFn = s.remove;
      });
    }
  } catch {
    /* plugin without listener support — fall back to the pull below */
  }

  // Pull whatever token the plugin already holds (it may have registered before
  // this screen mounted).
  try {
    void p.getWatchToken?.().then((r) => {
      if (r?.token) void registerToken(r.token);
    });
  } catch {
    /* ignore */
  }

  return () => {
    try {
      removeFn?.();
    } catch {
      /* ignore */
    }
  };
}

/**
 * Fire one buzz to the watch RIGHT NOW (called at a step boundary, the same
 * instant the phone buzzes itself). Fire-and-forget; the server no-ops if APNs
 * isn't configured or no token is registered. No-op off the shell.
 */
export function pushWatchCue(title: string, body: string): void {
  if (!isNativeWatch()) return;
  try {
    void fetch("/api/watch/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body }),
      keepalive: true,
    });
  } catch {
    /* never disturb the brew loop */
  }
}
