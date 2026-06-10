# BTTS as a native iOS app — Capacitor shell + TestFlight

> **Working doc, not a one-off plan.** Lives in the repo so every new Claude Code session sees the current state via the `@./docs/ios-shell-roadmap.md` reference in CLAUDE.md. Updated in-place at the end of every session that advances the project, in the same commit as the code. When this doc disagrees with reality, reality wins — and the next action is to update the doc, not work around it.

## Context

BTTS today is a Next.js 14 PWA on Hetzner (single-user, owner-only). The PWA closes most needs but Apple structurally blocks four things that matter for the brewing flow: lock-screen / background notifications (pour-step alerts that survive a screen-off iPhone), Web Bluetooth (the Acaia Lunar + Pearl can't be reached), and the native extension surface (home-screen widget, Live Activity / Dynamic Island, Apple Watch).

The plan closes all four with a **Capacitor 7 remote-URL shell** distributed via **TestFlight internal testing**. The Next.js app on Hetzner stays unchanged and server-rendered — the shell wraps it. The Safari PWA keeps working in parallel. A public App Store listing is out (single-user app fails Apple review); internal TestFlight needs no review and lands builds on the owner's iPhone in ~15–30 minutes after CI.

Documented gap this closes (CLAUDE.md "Permanent gaps"): *"Step alerts during background are missed — iOS suspends JS; no workaround without server-push notifications."* A native shell schedules iOS local notifications at pour-step boundaries that fire even with the screen locked, no APNs server needed.

Constraints: TestFlight builds expire after **90 days** (monthly cron rebuild), and the only manual owner steps are the ones genuinely behind Apple web UIs (€99/yr enrollment etc. — spending money is the owner's call, listed as a checklist, never automated).

**Mac setup:** the owner has a MacBook Pro. The GitHub-Actions-driven CI-build flow stays the production path (clean, reproducible, "push → TestFlight in ~20 min", no terminal work on owner's side), because that's what the Operating-mode rule wants. The MacBook is held in reserve as (a) a faster local debug loop if a phase hits a wall in CI and (b) a fallback if Xcode cloud signing misbehaves on a fresh account. The regular flow is NOT routed through `xcodebuild` on the MacBook — the owner shouldn't have to type build commands.

## Multi-session execution model

This file is the source of truth for the iOS shell project across sessions. The owner runs Claude Code from a phone — there is no "paste this back into the next session" handoff.

- **Auto-loaded every session:** `CLAUDE.md` references this file via `@./docs/ios-shell-roadmap.md`, so every new Claude Code session sees the current state on cold start with zero owner action.
- **Update cadence:** every session that touches anything in this scope ends with three writes into this doc, committed alongside the code change — (a) a session-log entry below, (b) any new traps added to the Stolperstein log, (c) ticking off the relevant Pre-flight or Phase checkbox. No separate "what did we do today" message — the doc IS the memo.
- **Read order on a fresh session:** Context → Multi-session model → **Status & next entry-point** (right below) → most recent Session-log entry → Stolperstein log → current Phase section. Everything else is reference, consulted on demand.
- **When this doc disagrees with reality, reality wins** — and the next action is to update the doc, not work around it.

## Status & next entry-point

*Updated at the end of every advancing session. A fresh session reads this immediately after Context + Multi-session model.*

- **Current phase:** pre-Phase-1. Roadmap doc + CLAUDE.md reference shipped (PR TBD). No code touched in `src/`, `native/`, or `.github/workflows/ios-*` yet.
- **Blocked on owner?** No.
- **Apple Developer enrollment status:** not started — the €99 enrollment from the Owner Checklist is the gate for Phases 3–4. Phase 1 (web-side notification bridge) and Phase 2 (`native/` scaffold) ship without it.
- **Next entry-point:** create `src/lib/native/brewNotifications.ts` per the Phase 1 spec below.

## Architecture (decided, research-verified)

- **Capacitor 7 remote-URL shell**: `server.url = "https://bettertastethansorry.com"` (domain confirmed in `Caddyfile`). No bundled web assets — the Next.js app stays server-rendered on Hetzner; the shell is additive, the Safari PWA keeps working. Bridge injection into the remote origin is verified behavior (single-origin app, no `allowNavigation`).
- **Bundle ID** `com.roitsch.btts`, display name **BTTS**, lives in `native/` with its own `package.json` so the Next app's dependencies stay untouched. Generated `native/ios/` Xcode project is committed (Pods are not — `pod install` runs in CI).
- **Notifications**: schedule all step boundaries once at brew start with plugin config `presentationOptions: []` — iOS silently swallows them while the app is foregrounded (the existing Web Audio cue covers foreground), and shows lock-screen banner + sound when backgrounded/locked. No visibilitychange choreography needed. Permission prompt fires in-foreground right after the user taps Start Brew, once ever.
- **Signing**: Xcode **cloud signing** via App Store Connect API key (`xcodebuild -allowProvisioningUpdates -authenticationKey*`) — no certificates, no p12s, no fastlane. Only 4 GitHub secrets.
- **Upload**: `apple-actions/upload-testflight-build@v5`. TestFlight **internal** testing = no Apple review; builds reach the phone ~15–30 min after CI with automatic distribution.
- **Auth in shell**: existing PIN login (WebAuthn is unreliable in WKWebView). `cf_session` is an httpOnly server-set cookie → persists in WKWebView, ITP 7-day cap doesn't apply; PIN re-login roughly monthly (30-day expiry).

## Verified repo facts the implementation builds on

- Full step schedule known at brew start: `PourStep[]`/`GuideStep[]` with `startTimeSec`, built by `buildPourOver()`/`buildGuideSteps()` in `src/lib/utils/pourSequence.ts`.
- Brew-start hook: `src/components/flow/LightStepBrew.tsx` `handleTick` marks `started` at elapsed=1 s (wake lock enabled there); guide-step transitions fire audio + vibrate ~lines 631–657; Reset emits `onTick(0)`; timer is wall-clock anchored (`CircularTimer.tsx`).
- `viewportFit: "cover"` + `env(safe-area-inset-*)` everywhere → renders correctly in a chrome-less WKWebView. No platform-detection code to conflict with.
- CI patterns: `ci.yml` / `deploy.yml` / `migration.yml`, secrets via `${{ secrets.NAME }}`, no macOS usage yet.

## Phases (each an independently shippable PR)

### Phase 1 — Web-side notification bridge (pure web, no-op in browsers, ships first)
- **New `src/lib/native/brewNotifications.ts`** — zero npm deps on `@capacitor/*`: local ambient types for `window.Capacitor` + a minimal `LocalNotificationsLike` interface (strict-TS clean). Exports:
  - `buildBrewBoundaries(steps, guideSteps, targetTimeSec): BrewBoundary[]` — pure; skips bloom (t=0, user is watching), titles like "Pour 2 — +60g" / body "→ 180g total · 92°C", includes guide actions (flip/press) and a final "Drawdown — brew finishing" boundary at `targetTimeSec`. Prose-only legacy sequences → no notifications (documented limitation).
  - `ensurePermission()` (caches denial), `scheduleBrew(boundaries, anchorMs)` (cancel-then-schedule, fixed id range, skips boundaries ≤2 s away), `cancelBrew()`. Everything try/caught — a bridge failure must never break the brew timer.
- **New `src/hooks/useBrewStepNotifications.ts`** — glue, all refs: schedule at first tick (`started && elapsed >= 1`, same moment wake lock engages); reschedule if the wall-clock anchor drifts >1.5 s (Stop→Resume); cancel on Reset (`elapsed === 0` after scheduling), on a 1 s watchdog detecting *visible-but-paused* (Stop pressed — backgrounding stalls ticks too but `visibilityState === "hidden"`, so notifications survive backgrounding, which is the whole point), and on unmount.
- **Edit `src/components/flow/LightStepBrew.tsx`** — ~12 additive lines: `useMemo` boundaries, hook call, `cancelAll()` added to `handleDone`. No existing effects/transitions touched; no double-cue (foreground banners suppressed by config).
- Optional same PR: login page defaults to the PIN tab when `Capacitor.isNativePlatform?.()` is true.

### Phase 2 — `native/` scaffold (authorable on Linux)
```
native/
  package.json            # @capacitor/{core,ios,local-notifications}@^7; dev: cli, assets
  capacitor.config.ts     # appId, appName "BTTS", server.url, LocalNotifications presentationOptions: []
  www/index.html          # placeholder (Capacitor requires webDir even in remote mode)
  exportOptions.plist     # app-store-connect, automatic signing
  assets/                 # 1024px icon + splash from public/ PWA icons
  .gitignore              # node_modules, ios/App/Pods, build artifacts
  README.md               # how the shell works, workflow runbook, "Don't Allow" recovery note
```
Plus: add `"native"` to root `tsconfig.json` `exclude` (alongside `lovable-v7`) so the Capacitor config stays out of the Next typecheck.

### Phase 3 — One-shot bootstrap workflow `.github/workflows/ios-bootstrap.yml`
`workflow_dispatch`, `macos-15`: `npm ci` in `native/` → `npx cap add ios` → `npx @capacitor/assets generate --ios` → `plutil -replace ITSAppUsesNonExemptEncryption -bool false …/Info.plist` (kills the per-build export-compliance prompt) → sanity `npx cap sync ios` → commit `native/ios/` to a branch + open a PR the owner merges from their phone.

### Phase 4 — Build & upload workflow `.github/workflows/ios-testflight.yml`
Triggers: `workflow_dispatch` + monthly cron (1st of month — comfortably inside the 90-day expiry) + push to main on `native/**`. Job (`macos-15`, `concurrency: ios-testflight`):
1. `npm ci` + `npx cap sync ios` in `native/` (CocoaPods preinstalled on runners).
2. Write `~/private_keys/AuthKey_${KEY_ID}.p8` from the secret.
3. `xcodebuild archive … CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM=$APPLE_TEAM_ID CURRENT_PROJECT_VERSION=$GITHUB_RUN_NUMBER -allowProvisioningUpdates -authenticationKeyPath/-KeyID/-KeyIssuerID` (cloud signing auto-creates the distribution cert/profile; run number = unique build number).
4. `xcodebuild -exportArchive` with `native/exportOptions.plist`.
5. `apple-actions/upload-testflight-build@v5` with the same API-key secrets.

### Phase 5 (optional polish, later)
`server.errorPath` offline page for cold-launch-with-no-network; App-Bound Domains only if in-shell service-worker offline mode is ever wanted (v1 targets the live site; the Safari PWA keeps full offline mode).

## Realistic session count

- **Phase 1 (web-side notification bridge):** 1 session — pure web code, no Apple account, ships to live PWA the same day.
- **Phase 2 (native scaffold):** 0.5 session — small, often folded into Phase 1's session or Phase 3's session.
- **Phase 3 (bootstrap workflow):** 0.5–1 session — first time signing kisses the Apple side, expect one round of "agreement pending in App Store Connect" debugging.
- **Phase 4 (TestFlight build):** 0.5–1 session — first build often surfaces an Info.plist or capability adjustment; iterates quickly.
- **G1 (Acaia BT):** 1–2 sessions — one to port the decoder + plugin wiring, one for on-device debugging if iOS connection timing bites.
- **Total to "TestFlight on phone with lock-screen pour-notifications + live Acaia weight": ~3–5 sessions** spread over however long the owner wants between them. Each session ends with something shipped (PR merged, doc updated, log entry added).

## Sequencing note

Phase 1 + 2 can ship immediately (pure code, no Apple account needed). Phases 3–4 are blocked on the owner completing checklist items 1–5 (the €99 enrollment is the gate — owner's wallet, owner's call).

## Gadget roadmap (v2+, research-verified June 2026)

Each milestone is independently shippable on the v1 shell. Two infrastructure tracks: **BLE** (Acaia — needs only the v1 shell) and **extension targets** (widget / Live Activity / watch — share one-time Xcode-project + CI-signing surgery). All sized by three web-research agents against primary sources (Beanconqueror source tarball, Apple docs, plugin repos).

### G1 — Acaia Lunar + Pearl over Bluetooth (1–2 day port + on-device spike)

- **Why native-only:** iOS Safari has no Web Bluetooth and Apple won't ship it — the shell is the only path to the scale.
- **The protocol work is already done.** Beanconqueror (MIT) carries ~1,050 lines of **framework-free TypeScript** (`src/classes/devices/acaia/` — `acaia.ts` 701 lines, `decoder.ts` 272, `common.ts`/`constants.ts`) implementing the full reverse-engineered protocol: ident handshake, 1 s heartbeat (scale goes silent without it), frame decoder with checksums, weight/battery/timer/button events, tare + timer commands. Zero Angular dependency — `decoder.ts`/`common.ts`/`constants.ts` copy verbatim; `acaia.ts` needs ~30 lines of app-imports stripped.
- **Both owner scales are OLD-protocol** (single characteristic `00002a80-…`): Lunar 2017 + original Pearl. New-protocol (Pyxis/Lunar 2021/Pearl S) handling comes free in the same code via characteristic-based detection. Old Pearls may advertise as `PROCHBT001` — name-prefix scan list must include it.
- **Transport swap is the actual port:** Beanconqueror uses the Cordova BLE plugin (`window.ble`, 6 call sites: requestMtu / startNotification / write / writeWithoutResponse) → rewrite against `@capacitor-community/bluetooth-le` v7 (mature, Capacitor 7-compatible, v7.3.2 Feb 2026). Plus our own scan/connect/reconnect shell. `NSBluetoothAlwaysUsageDescription` Info.plist key mandatory (crash without it). No OS pairing — plain GATT connect; tell the owner NOT to pair in iOS Settings.
- **Bridge works over remote `server.url`** (verified — same mechanism as live-reload; the plugin's JS ships in the web bundle and registers against the injected `window.Capacitor`; feature-detect `Capacitor.isNativePlatform()` so the Safari PWA is untouched).
- **What it buys in the brew flow:** live grams + flow rate on the timer screen, tare from the app, auto-log final dose/water into the session, optional pour auto-advance from rate-of-change (manual tap stays).
- **Residual risk:** iOS connection-timing quirks (Beanconqueror has two iOS connection modes + magic 150 ms sleeps for a reason) and scale auto-sleep. First step is a one-evening on-device spike: shell + plugin + verbatim decoder, confirm weight events stream from the Lunar.

### G2 — Home-screen widget (2–3 days; validates the extension pipeline)

- The deliberately-easy first extension milestone: a small SwiftUI timeline widget showing rotation bags / last brew, fetching a tiny authenticated JSON endpoint directly via URLSession from the widget process (Apple-documented pattern — no bridge plugin needed). Needs a long-lived token endpoint since the session cookie lives in WKWebView.
- Refresh budget ~40–70/day — generous for data that changes a few times a day.
- **One-time shared cost it pays down:** adding a widget-extension target to the committed Xcode project without a Mac (scripted pbxproj edit or one-time generation on a runner — XcodeGen exists as fallback), own bundle id (`com.roitsch.btts.widgets`), and cloud signing for multi-target archives (`-allowProvisioningUpdates` handles extensions automatically — verified, with known-but-solvable CI config friction). Everything G3 needs, de-risked on the simplest possible extension.

### G3 — Live Activity brew timer (3–5 days on top of G2)

- Plugin: `@ludufre/capacitor-live-activities` (v8.0.0 May 2026, iOS 16.2+) — **layouts defined from JS as JSON** (lock screen + all Dynamic Island states, incl. timer elements); no SwiftUI authoring. Reuses G2's extension target + signing.
- **Key mechanic:** `Text(timerInterval:)` is system-rendered — elapsed/countdown keeps ticking on the lock screen even when WKWebView JS is frozen. Step-text changes need explicit `updateActivity()` calls; ActivityKit cannot schedule future content locally.
- **v1 of the Live Activity:** foreground-driven updates only (during a brew the app is open + wake-locked, so JS is alive at every step boundary) + a stale-tolerant layout (whole-brew progress bar + "next: 180g at 1:30" static text). Locked-phone step progression would need APNs ActivityKit pushes from the Hetzner server (all boundaries known at brew start, so schedulable) — real backend work, defer; the lock-screen notifications from v1 already cover locked-phone step alerts.
- No frequent-update entitlement needed at brew-step cadence.

### G4 — Apple Watch (tiered; the expensive tier is optional)

- **Tier 0 — free with v1:** iOS notification mirroring sends each pour-step notification to the watch with a haptic — **but only while the iPhone is locked/asleep** (Apple routing rule). Covers phone-in-pocket brewing; phone-unlocked-on-the-counter routes to the phone instead. Custom haptic patterns impossible on mirrored notifications; owner can enable watch-side "Prominent Haptic".
- **Tier 1 — free with G3:** since watchOS 11, iPhone Live Activities auto-appear in the watch Smart Stack (compact leading/trailing views + auto-launch on alerting updates; `supplementalActivityFamilies([.small])` for a watch-sized layout). Glanceable step/elapsed on the wrist with zero watch code. Per-step wrist *taps* from this path are shaky (needs alerting updates while JS may be suspended) — Tier 0 notifications provide the haptics.
- **Tier 2 — native SwiftUI watch app (1–2 weeks, endgame only if the habit sticks):** the only tier delivering reliable taps + glance regardless of iPhone lock state. watchOS has no WKWebView, so it's real SwiftUI: WatchConnectivity payload at brew start (`{steps[], totalSec, startedAt}` — watch runs the whole schedule locally), `WKExtendedRuntimeSession` ("smart alarm" category) for screen-off haptics via `notifyUser(hapticType:)`. Bridge plugin: `@capgo/capacitor-watch` (maintained) — ionic-team's CapacitorWatch is experimental/stale, avoid. Watch app rides the same TestFlight build; cloud signing covers the extra target.

### Suggested order

G1 (Acaia — biggest daily payoff, smallest cost, independent track) → G2 (widget — pipeline de-risk) → G3 (Live Activity, gets Tier-1 watch free) → reassess whether Tier-2 watch is still wanted.

## GitHub secrets (complete list — 4)

`APP_STORE_CONNECT_ISSUER_ID`, `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_API_KEY_P8` (paste the .p8 contents), `APPLE_TEAM_ID`.

## Owner manual checklist (only Apple-web-UI steps, all doable from an iPhone)

1. Enroll in the Apple Developer Program (€99/yr, approval hours–2 days); note the Team ID.
2. App Store Connect → Users and Access → Integrations: create a Team API key (role **App Manager**); record Issuer ID + Key ID, download the `.p8` (one-time download).
3. Add the 4 GitHub secrets (repo Settings → Secrets → Actions).
4. developer.apple.com → Identifiers: register App ID `com.roitsch.btts` (no extra capabilities needed).
5. App Store Connect → New App: iOS, "BTTS", that bundle ID.
6. Run `ios-bootstrap` from the Actions tab; merge its PR; run `ios-testflight`.
7. TestFlight → Internal Testing → group with automatic distribution → add self.
8. Install the TestFlight app, accept the invite, install BTTS, log in with PIN.
9. Recurring: yearly membership renewal; occasional ASC license-agreement acceptances (CI fails loudly when one is pending); PIN re-login ~monthly.

## Risks (flagged, accepted)

- Capacitor docs label `server.url` "not intended for production" — works and is widely used; re-verify on major Capacitor upgrades; keep navigation single-origin.
- Cloud signing can be flaky on a brand-new account (pending agreements) — retry usually fixes; fastlane match is the documented fallback, only adopt if needed.
- Notification delivery is second-granular (±~1 s) — fine for humans with kettles. iOS 64-pending cap is far above any brew's step count.
- If the owner taps "Don't Allow" on the permission prompt, brews continue exactly as today; re-enable via Settings → BTTS → Notifications (noted in README).
- No service worker in the shell → in-shell offline mode is weaker than the Safari PWA; the PWA remains installed and unaffected.

## Verification

- **Phase 1**: `npx tsc --noEmit` + existing `node --test` suite must stay green; CI screenshots artifact confirms the brew flow renders unchanged (the bridge is a runtime no-op in Chromium). Merged via the normal PR flow → auto-deploys; verify on the live PWA that a brew behaves identically.
- **Phases 2–4**: each workflow run IS the test — bootstrap must produce a mergeable `native/ios` PR; the TestFlight workflow must end with a processed build visible in App Store Connect.
- **End-to-end**: owner installs via TestFlight, logs in with PIN, starts a real brew, locks the phone — pour-step notifications must arrive on the lock screen at the right offsets; finishing/resetting a brew must leave no stray notifications.

## Stolperstein log

*Grows over time. Every trap hit once goes here so a future session reads it before starting. Entries stay short; link to the commit or PR that fixed it.*

- *(empty so far — entries are added as we hit them)*

## Session log

*Each session adds one entry at the END (newest at the bottom, so a glance at the file's tail shows the current state). Keep entries tight; the doc is the memo, not a journal.*

### Template

```
### YYYY-MM-DD — Phase N (short description)
- **Done:** bullet list
- **Open / blocked:** bullet list (or "—")
- **Traps found:** bullet list also added to Stolperstein log above (or "—")
- **Next entry-point:** one sentence — exact next file or workflow to touch
- **PRs / commits this session:** #NNN, #NNN
```

### Entries

### 2026-06-10 — pre-Phase-1 (multi-session scaffold)

- **Done:** Approved iOS shell plan ported into the repo as this doc; CLAUDE.md updated to auto-load it via `@./docs/ios-shell-roadmap.md`; Status & next entry-point section seeded. No code under `src/`, `native/`, or `.github/workflows/ios-*` was touched.
- **Open / blocked:** Apple Developer enrollment not started (blocks Phases 3–4 only — Phase 1 + 2 are pure code).
- **Traps found:** —
- **Next entry-point:** create `src/lib/native/brewNotifications.ts` per the Phase 1 spec (pure-web module, zero `@capacitor/*` deps, ambient types).
- **PRs / commits this session:** (filled in once PR is opened)
