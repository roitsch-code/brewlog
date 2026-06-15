# BTTS — iOS shell (Capacitor 8)

A thin native wrapper that turns the live BTTS PWA into a real iOS app
distributed through **TestFlight internal testing**. It exists to unlock the
things Apple blocks in Safari — first **lock-screen pour-step notifications**
(the web bridge already ships in `src/lib/native/brewNotifications.ts`), later
Acaia Bluetooth, widgets, Live Activity, Apple Watch.

> Full plan, phases, idea backlog and session log: **`../docs/ios-shell-roadmap.md`**.

## How it works

This is a **remote-URL shell**. It does *not* bundle the web app. A chrome-less
`WKWebView` loads the live Next.js site (`server.url` =
`https://bettertastethansorry.com`) and Capacitor injects its bridge into that
origin, so the existing web code can reach native plugins via
`Capacitor.isNativePlatform()`. The Safari PWA keeps working in parallel — the
shell is purely additive.

- `capacitor.config.ts` — appId `com.roitsch.btts`, the remote `server.url`, and
  `LocalNotifications.presentationOptions: []` (no foreground banner; iOS shows
  the lock-screen banner only when backgrounded/locked — the no-double-cue rule).
- `www/index.html` — placeholder; Capacitor requires a `webDir` even in remote
  mode. Only paints if the live origin is unreachable at cold launch.
- `exportOptions.plist` — App Store Connect export, automatic cloud signing.
- `assets/logo.svg` — 1024×1024 source for `@capacitor/assets` (app icon + splash).
- `ios/` — the generated Xcode project (committed once by `ios-bootstrap`; not
  present until then). Pods + the cordova-plugins bridge are gitignored and
  regenerated in CI.

The Next app's dependencies are untouched: this folder has its own
`package.json`, is excluded from the root `tsconfig.json`, and is kept out of the
Docker build context via `.dockerignore`.

## Workflow runbook (all from the GitHub Actions tab — no Mac needed)

1. **`ios-bootstrap`** (one-shot, Phase 3) — generates `native/ios/`, runs
   `@capacitor/assets`, and opens a PR that commits the Xcode project. Merge it.
2. **`ios-testflight`** (Phase 4) — builds, signs via the App Store Connect API
   key, and uploads to TestFlight. Runs on `workflow_dispatch`, a monthly cron
   (TestFlight builds expire after 90 days), and pushes touching `native/**`.
   Alerts on failure via the coffee-alert webhook.

Local builds on the owner's MacBook are a debug fallback only — the CI path is
the production path.

## "Don't Allow" notifications recovery

If you tap **Don't Allow** on the first notification prompt, brews continue
exactly as before (foreground Web Audio cue only). To re-enable lock-screen
pour alerts: **iOS Settings → BTTS → Notifications → Allow Notifications**.

## Regenerating icons / splash

From `native/`, after editing `assets/logo.svg`:

```
npm run assets        # capacitor-assets generate --ios (cream background)
```
