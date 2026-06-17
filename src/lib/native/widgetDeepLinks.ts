/**
 * Home-screen widget DEEP-LINK handler — turns a widget tap into the right
 * in-app action via the `btts://` custom URL scheme.
 *
 *   - `btts://brew?coffeeId=<id>` → load that coffee, seed the flow, land on the
 *     Context step (the existing `startBrewAgain()` path, same as the library
 *     "Brew" button).
 *   - `btts://scan`               → a fresh scan: reset the flow and open
 *     `/brew/new` at Step "scan".
 *
 * The scheme is registered in the shell's Info.plist (CFBundleURLTypes) and the
 * open event is delivered by `@capacitor/app`'s `appUrlOpen`, which we read
 * through the injected `window.Capacitor.Plugins.App` — so this module needs NO
 * `@capacitor/*` import and stays a silent no-op off the native shell.
 *
 * Navigation is injected (`nav`) rather than hard-wired, so the listener can use
 * the Next.js client router (SPA navigation) instead of a full reload that would
 * drop the just-seeded flow-store state.
 */

import { useFlowStore } from "@/store/flowStore";
import { startBrewAgain } from "@/lib/flow/brewAgain";
import type { Coffee } from "@/lib/types/coffee";
import type { CoffeeIdentity } from "@/lib/types/session";

/** SPA navigate — `router.push` from the mounting component. */
export type Nav = (path: string) => void;

interface AppUrlOpenData {
  url: string;
}
interface AppListenerHandle {
  remove: () => void;
}
interface AppPluginLike {
  addListener(
    eventName: "appUrlOpen",
    listener: (data: AppUrlOpenData) => void,
  ): Promise<AppListenerHandle>;
  getLaunchUrl(): Promise<{ url: string } | null>;
}
interface CapacitorLike {
  isNativePlatform?: () => boolean;
  Plugins?: { App?: AppPluginLike };
}

function getApp(): AppPluginLike | null {
  try {
    if (typeof window === "undefined") return null;
    const cap = (window as unknown as { Capacitor?: CapacitorLike }).Capacitor;
    if (!cap?.isNativePlatform?.()) return null;
    return cap.Plugins?.App ?? null;
  } catch {
    return null;
  }
}

/** Brew a known library coffee by id — hydrate the identity, seed the flow,
 * navigate. Falls back to the library on any failure (a deleted/unknown id). */
async function brewCoffeeById(coffeeId: string, nav: Nav): Promise<void> {
  try {
    const r = await fetch(`/api/coffees/${coffeeId}`, { cache: "no-store" });
    if (!r.ok) throw new Error("not found");
    const coffee = (await r.json()) as Coffee;
    // Synthesize the identity exactly like the library "Brew" button: roastLevel
    // isn't on the Coffee row, so default to Light (the owner's profile). The
    // /recommend route re-hydrates the full row from coffeeId server-side.
    const identity: CoffeeIdentity = {
      roaster: coffee.roaster,
      name: coffee.name,
      origin: coffee.origin,
      process: coffee.process,
      roastLevel: "Light",
      roastDate: coffee.latestRoastDate,
      bagPhotoUrl: coffee.bagPhotoUrl,
      aiExtracted: false,
      coffeeId: coffee.id,
    };
    startBrewAgain(identity, coffee.fieldZones ?? null);
    nav("/brew/new");
  } catch {
    nav("/coffees");
  }
}

/** Result of parsing a `btts://…` widget URL. `null` = not ours / malformed. */
export type WidgetAction =
  | { kind: "scan" }
  | { kind: "brew"; coffeeId: string | null };

/**
 * Pure parse of a `btts://…` URL into an action. Side-effect-free + store-free,
 * so it's unit-testable. Returns null for anything that isn't a recognised BTTS
 * widget link.
 */
export function parseWidgetUrl(url: string): WidgetAction | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "btts:") return null;
  // `btts://brew?…` parses to host "brew"; be tolerant of `btts:///brew` too.
  const action = (parsed.host || parsed.pathname.replace(/\//g, "")).toLowerCase();
  if (action === "scan") return { kind: "scan" };
  if (action === "brew") return { kind: "brew", coffeeId: parsed.searchParams.get("coffeeId") };
  return null;
}

/** Parse + dispatch a single `btts://…` URL. Exported for unit testing. */
export async function handleWidgetUrl(url: string, nav: Nav): Promise<void> {
  const action = parseWidgetUrl(url);
  if (!action) return;

  if (action.kind === "scan") {
    useFlowStore.getState().reset(); // reset() lands on Step "scan", mode "home"
    nav("/brew/new");
    return;
  }
  if (action.kind === "brew") {
    if (!action.coffeeId) {
      nav("/coffees");
      return;
    }
    await brewCoffeeById(action.coffeeId, nav);
  }
}

/**
 * Register the widget deep-link listener. Returns a cleanup function. No-op off
 * the native shell. Also drains the cold-start launch URL (the app being opened
 * by a widget tap from a not-running state).
 */
export function registerWidgetDeepLinks(nav: Nav): () => void {
  const app = getApp();
  if (!app) return () => {};

  let handle: AppListenerHandle | null = null;
  let removed = false;

  // NB: addListener may return either a Promise<handle> OR the handle directly
  // depending on the Capacitor build, so we never chain `.then` on it raw (that
  // threw "addListener(...).then is not a function" and aborted the bridge).
  // Wrap in Promise.resolve and isolate each call so neither can throw out.
  try {
    const res = app.addListener("appUrlOpen", (data) => {
      void handleWidgetUrl(data?.url ?? "", nav);
    });
    Promise.resolve(res as unknown)
      .then((h) => {
        const handle_ = h as AppListenerHandle | undefined;
        if (removed) handle_?.remove?.();
        else handle = handle_ ?? null;
      })
      .catch(() => {});
  } catch {
    /* ignore — deep links just won't attach */
  }

  // Cold start: the app was launched by the tap, so the event may have fired
  // before this listener attached — getLaunchUrl recovers it.
  try {
    Promise.resolve(app.getLaunchUrl() as unknown)
      .then((r) => {
        const url = (r as { url?: string } | null)?.url;
        if (url) void handleWidgetUrl(url, nav);
      })
      .catch(() => {});
  } catch {
    /* ignore */
  }

  return () => {
    removed = true;
    try {
      handle?.remove?.();
    } catch {
      /* ignore */
    }
  };
}
