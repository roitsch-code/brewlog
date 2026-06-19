import { Capacitor } from "@capacitor/core";

/**
 * One place to get the user's location that works in BOTH the Safari PWA and
 * the iOS app.
 *
 * The catch (researched June 2026): the W3C `navigator.geolocation` API does
 * NOT resolve inside the iOS Capacitor WKWebView when the app loads a REMOTE
 * `server.url` — its secure-context geolocation path is only granted for the
 * `localhost` origin Capacitor uses when serving bundled assets, which we don't.
 * So on the installed app the web API's callbacks silently never fire and the
 * "locate me" button spins forever. The fix is the native `@capacitor/geolocation`
 * plugin, which talks to CoreLocation directly and works over a remote origin.
 *
 * This wrapper routes to the plugin on native (dynamic import → it never enters
 * the PWA's main chunk) and to the untouched web API in a real browser, where it
 * works fine. Both return the same `{ lat, lng }`.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

export async function getPosition(opts?: {
  highAccuracy?: boolean;
  timeoutMs?: number;
  maxAgeMs?: number;
}): Promise<GeoPoint> {
  const enableHighAccuracy = opts?.highAccuracy ?? false; // coarse = fast + reliable on a phone
  const timeout = opts?.timeoutMs ?? 15000;
  const maximumAge = opts?.maxAgeMs ?? 60000; // accept a recent cached fix → near-instant

  if (Capacitor.isNativePlatform()) {
    const { Geolocation } = await import("@capacitor/geolocation");
    try {
      const perm = await Geolocation.checkPermissions();
      if (perm.location !== "granted" && perm.coarseLocation !== "granted") {
        await Geolocation.requestPermissions();
      }
    } catch {
      /* requestPermissions can throw if already decided — getCurrentPosition reports the real state */
    }
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy, timeout, maximumAge });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  }

  return new Promise<GeoPoint>((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy, timeout, maximumAge },
    );
  });
}

/**
 * Silent best-effort position for the on-mount auto-locate: on the iOS app it
 * returns null WITHOUT prompting unless permission is already granted (so just
 * opening Nearby never throws a permission dialog — that's reserved for the
 * explicit "locate me" tap). In the browser it behaves as before. Never throws.
 */
export async function getPositionIfGranted(opts?: {
  highAccuracy?: boolean;
  timeoutMs?: number;
  maxAgeMs?: number;
}): Promise<GeoPoint | null> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      const perm = await Geolocation.checkPermissions();
      if (perm.location !== "granted" && perm.coarseLocation !== "granted") return null;
      return await getPosition(opts);
    } catch {
      return null;
    }
  }
  return getPosition(opts).catch(() => null);
}
