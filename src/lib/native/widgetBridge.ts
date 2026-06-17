/**
 * Home-screen widget DATA bridge — pushes the user's in-rotation coffees into
 * the iOS widget so the medium widget can render them as tap-to-brew tiles.
 *
 * Data path (App Group, NOT a network fetch from the widget): the web app, when
 * running inside the Capacitor shell, hands the rotation list to the native
 * `WidgetBridge` plugin (an app-local Capacitor plugin registered in
 * MainViewController, mirroring `BrewWatch`). The plugin writes the JSON into
 * the shared App Group container and calls `WidgetCenter.reloadAllTimelines()`,
 * so the widget process reads it with no auth/token surface and no network.
 *
 * Pure-web module, ZERO `@capacitor/*` imports (ambient types only). Off the
 * native shell (Safari PWA / desktop / CI) `getPlugin()` returns null and every
 * export is a silent no-op — the widget simply never updates, which is correct
 * because there is no widget outside the shell.
 *
 * v1 is text-only (roaster + name): a WidgetKit timeline can't async-download a
 * remote bag photo without caching it into the App Group first, so photos are a
 * deliberate follow-up. We send only what the tile renders.
 */

/** One rotation tile in the widget. Keep this in sync with the Swift decode in
 * `native/ios/App/BTTSWidget/BTTSWidget.swift`. */
export interface WidgetRotationCoffee {
  /** Coffee row id — deep-linked back as `btts://brew?coffeeId=<id>`. */
  id: string;
  roaster: string;
  name: string;
}

interface WidgetBridgePluginLike {
  setRotation(options: { coffees: WidgetRotationCoffee[] }): Promise<void>;
}

interface CapacitorLike {
  isNativePlatform?: () => boolean;
  Plugins?: { WidgetBridge?: WidgetBridgePluginLike };
}

function getPlugin(): WidgetBridgePluginLike | null {
  try {
    if (typeof window === "undefined") return null;
    const cap = (window as unknown as { Capacitor?: CapacitorLike }).Capacitor;
    if (!cap?.isNativePlatform?.()) return null;
    return cap.Plugins?.WidgetBridge ?? null;
  } catch {
    return null;
  }
}

/** True only inside the Capacitor shell with the WidgetBridge plugin present. */
export function isWidgetBridgeNative(): boolean {
  return getPlugin() !== null;
}

/** Push the current rotation list to the home-screen widget. No-op off the
 * native shell. Safe to call on every app open — it just refreshes the tiles. */
export function pushRotationToWidget(coffees: WidgetRotationCoffee[]): void {
  const plugin = getPlugin();
  if (!plugin) return;
  void plugin.setRotation({ coffees }).catch(() => {});
}
