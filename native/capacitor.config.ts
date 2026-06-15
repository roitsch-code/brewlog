/// <reference types="@capacitor/cli" />
import type { CapacitorConfig } from "@capacitor/cli";

/**
 * BTTS iOS shell — Capacitor 8 remote-URL configuration.
 *
 * The shell does NOT bundle the web app. It points a chrome-less WKWebView at
 * the live Next.js site on Hetzner (server.url) and injects the Capacitor
 * bridge into that origin, so native plugins (local notifications now; haptics
 * / Bluetooth / widgets later) become available to the existing web code via
 * feature detection (`Capacitor.isNativePlatform()`). The Safari PWA keeps
 * working in parallel — this is additive. See docs/ios-shell-roadmap.md.
 */
const config: CapacitorConfig = {
  appId: "com.roitsch.btts",
  appName: "BTTS",
  // Capacitor requires a webDir even in remote-URL mode; www/ is a placeholder
  // (the real UI loads from server.url). It only paints if the remote origin
  // is unreachable at cold launch.
  webDir: "www",
  server: {
    // Single-origin remote shell. No `allowNavigation` — navigation stays on
    // the production origin so the bridge stays injected (verified behavior).
    url: "https://bettertastethansorry.com",
    cleartext: false,
  },
  ios: {
    // Full-bleed: the app already uses viewportFit=cover + env(safe-area-inset-*)
    // everywhere, so a chrome-less WKWebView lays out correctly with no insets.
    contentInset: "never",
  },
  plugins: {
    LocalNotifications: {
      // Empty array = suppress the foreground banner/sound/badge. While the app
      // is foregrounded the existing Web Audio cue covers each step change; iOS
      // shows the lock-screen banner only when backgrounded/locked. This is the
      // no-double-cue mechanism the Phase-1 web bridge (src/lib/native/
      // brewNotifications.ts) is built around.
      presentationOptions: [],
    },
  },
};

export default config;
