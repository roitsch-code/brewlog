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

- **Current phase: 🟡 G4 TIER 2 WATCH APP BUILT + ARCHIVED (build 4) — awaiting ASC issuer ID to upload (2026-06-15).** The decisive feature ("Handgelenk-Buzz per Brew Step bei iPhone Screen AN"): a native watchOS app that runs the brew schedule itself and buzzes the wrist at each step **regardless of phone screen state** — the only path that works during a wake-locked brew, where iOS will NOT mirror notifications to the watch. Built this session: `BTTSWatch` target injected into the Capacitor project from source via a Ruby `xcodeproj` script (no GUI); App + watch both compile; the unsigned archive correctly embeds `BTTSWatch.app` (bundle `com.roitsch.btts.watchkitapp`, `WKApplication`, companion `com.roitsch.btts`, build 4) at `/tmp/App.xcarchive`. **The ONE blocker: export+upload needs the App Store Connect ISSUER ID** (owner-held, not on the Mac — I have team ID `WTZD878P9H`, the `AuthKey_A57ZL8HND3.p8` key, and the ready archive). **Owner action now:** paste the **Issuer ID** (App Store Connect → Users and Access → Integrations → your Team Key → Issuer ID, a UUID). Then I export (`-allowProvisioningUpdates` auto-creates the watch provisioning profile) + `altool` upload → build 4. After install: **open the BTTS watch app**, start a brew, leave the phone screen ON → the wrist buzzes per step.
- **Previous: ✅ BUILD 3 (HAPTICS) ON TESTFLIGHT (2026-06-15).** Foreground Taptic haptics on the iPhone (3-2-1 countdown + strong step buzz, PR #315), `@capacitor/haptics` plugin, committed shared `App.xcscheme`, iPhone-only. That's the phone-side cue; the watch app (this session) is the wrist-side cue.
- **The working build recipe (Mac — bump `CURRENT_PROJECT_VERSION` each time):** prefix every `xcodebuild` with `GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=safe.bareRepository GIT_CONFIG_VALUE_0=all` (Mac global git has `safe.bareRepository=explicit`, blocks SPM). **(0) `cd native && npm install && npx cap sync ios && npm run assets && ruby scripts/add_watch_target.rb`** — the watch-target step is MANDATORY and goes AFTER `cap sync` (sync can rewrite the pbxproj; the Ruby script is idempotent — it drops any prior `BTTSWatch` target first — so it always re-adds the watch app + the `BrewWatchPlugin.swift` App-target ref + the Embed Watch Content phase). Needs the `xcodeproj` gem once: `gem install xcodeproj --user-install --no-document` (works on system ruby 2.6). (1) `xcodebuild archive -project native/ios/App/App.xcodeproj -scheme App -configuration Release -destination 'generic/platform=iOS' -archivePath /tmp/App.xcarchive CURRENT_PROJECT_VERSION=<N+1> CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY=""`; (2) `plutil -replace teamID -string <APPLE_TEAM_ID> native/exportOptions.plist` then `xcodebuild -exportArchive -archivePath /tmp/App.xcarchive -exportPath /tmp/export -exportOptionsPlist native/exportOptions.plist -allowProvisioningUpdates -authenticationKeyPath ~/.appstoreconnect/private_keys/AuthKey_A57ZL8HND3.p8 -authenticationKeyID A57ZL8HND3 -authenticationKeyIssuerID <ISSUER_ID>` (`git checkout native/exportOptions.plist` after — no team id in the repo); (3) `xcrun altool --upload-app -f /tmp/export/App.ipa -t ios --apiKey A57ZL8HND3 --apiIssuer <ISSUER_ID>`. **`<APPLE_TEAM_ID>` is the GitHub secret / decodable from the build's provisioning profile — it is NOT the `(…)` in the "Apple Development: …" keychain cert (that's the wrong personal team — see Stolperstein). `<ISSUER_ID>` is the ASC API issuer (owner has it; not findable on the Mac).**
- **NEXT PHASE — ordered plan for the next (fresh) session:**
  1. **Verify the payoff on-device:** install build 3, start a brew, **don't lock the phone** (the real case) → confirm it **vibrates**: 3 short taps at t-3/2/1 before each step, a strong buzz AT each step (pours AND Swirl/Stir/Tap). Confirm the Watch buzzes too (phone locked only). Confirm the **screen stays awake** (wake-lock — if it dims add `@capacitor-community/keep-awake`). Record results here.
  2. **Splash asset missing:** `npm run assets` errors on `Splash.imageset` (dir absent) — cosmetic (app launches on the cream LaunchScreen), but regenerate/commit it when convenient.
  3. **Monthly-rebuild / CI fix (task #3, still deferred — owner chose the Mac build this round):** the shared `App.xcscheme` is now committed, so harden `ios-testflight.yml`: `-project App.xcodeproj` (not `-workspace`), the **unsigned-archive-then-export** pattern (CI's `CODE_SIGN_STYLE=Automatic` archive fails with no device), `npm run assets` step, **Admin** ASC key for cloud signing.
  4. **Then the gadget tracks:** G1 Acaia first (biggest daily payoff, BLE), then widget / Live Activity / watch.

## Architecture (decided, research-verified)

- **Capacitor 8 remote-URL shell**: `server.url = "https://bettertastethansorry.com"` (domain confirmed in `Caddyfile`). No bundled web assets — the Next.js app stays server-rendered on Hetzner; the shell is additive, the Safari PWA keeps working. Bridge injection into the remote origin is verified behavior (single-origin app, no `allowNavigation`). *(Pinned to Capacitor 8 at Phase-2 implementation — `@capacitor/core|ios|cli` 8.4.0, `local-notifications` 8.2.0, `assets` 3.0.5; the plan had said 7, but 8 was current on npm — see Stolperstein log.)*
- **Bundle ID** `com.roitsch.btts`, display name **BTTS**, lives in `native/` with its own `package.json` so the Next app's dependencies stay untouched. Generated `native/ios/` Xcode project is committed (Pods are not — `pod install` runs in CI).
- **Notifications**: schedule all step boundaries once at brew start with plugin config `presentationOptions: []` — iOS silently swallows them while the app is foregrounded (the existing Web Audio cue covers foreground), and shows lock-screen banner + sound when backgrounded/locked. No visibilitychange choreography needed. Permission prompt fires in-foreground right after the user taps Start Brew, once ever.
- **Signing**: Xcode **cloud signing** via App Store Connect API key (`xcodebuild -allowProvisioningUpdates -authenticationKey*`) — no certificates, no p12s, no fastlane. Only 4 GitHub secrets.
- **Upload**: `apple-actions/upload-testflight-build@v5`. TestFlight **internal** testing = no Apple review; builds reach the phone ~15–30 min after CI with automatic distribution.
- **Version skew (stated principle):** the web app deploys continuously; the shell rebuilds monthly. Native capabilities ship in the shell BEFORE any web code that calls them is deployed; web code always feature-detects via `Capacitor.isNativePlatform()` / plugin presence. Sequence for every new plugin (first hit: G1, when `@capacitor-community/bluetooth-le` JS enters the web bundle): shell PR with the native plugin → TestFlight build installed on the phone → THEN the web-side code merges.
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

### Phase 2 — `native/` scaffold (authorable on Linux) — ✅ SHIPPED (2026-06-15)
```
native/
  package.json            # @capacitor/{core,ios,local-notifications}@^8; dev: cli, assets@^3
  package-lock.json       # committed (npm ci in CI)
  capacitor.config.ts     # appId com.roitsch.btts, appName "BTTS", server.url, LocalNotifications presentationOptions: [], ios.contentInset: never
  www/index.html          # placeholder (Capacitor requires webDir even in remote mode)
  exportOptions.plist     # app-store-connect, automatic signing (teamID injected from secret)
  assets/logo.svg         # 1024×1024 source (copied from public/icons/icon-source.svg) for @capacitor/assets
  .gitignore              # node_modules, ios/App/Pods, cordova-plugins, build artifacts
  README.md               # how the shell works, workflow runbook, "Don't Allow" recovery note
```
Plus (done): `"native"` added to root `tsconfig.json` `exclude` (alongside `lovable-v7`); `native/` added to `.dockerignore` (own `@capacitor/*` deps, must not enter the Next build worker scan path — same precedent as `lovable-v7`). Config parse-validated by the cap CLI.

### Phase 3 — One-shot bootstrap workflow `.github/workflows/ios-bootstrap.yml` — ✅ SHIPPED (2026-06-15)
`workflow_dispatch`, `macos-15`, `permissions: contents+pull-requests: write`: `npm ci` in `native/` → `npx cap add ios` → `npm run assets` (`capacitor-assets generate --ios`, cream bg) → `plutil -replace ITSAppUsesNonExemptEncryption -bool false ios/App/App/Info.plist` (kills the per-build export-compliance prompt) → sanity `npx cap sync ios` → branch `ios/bootstrap-generated`, `git add native/ios`, `gh pr create` (uses `GITHUB_TOKEN`). Owner merges that PR. Needs NO Apple secrets.

### Phase 4 — Build & upload workflow `.github/workflows/ios-testflight.yml` — ✅ SHIPPED (2026-06-15)
Triggers: `workflow_dispatch` + monthly cron `0 6 1 * *` (1st of month, inside the 90-day expiry) + push to main on `native/**`. Job (`macos-15`, `concurrency: ios-testflight`, `timeout-minutes: 40`):
1. `npm ci` + `npx cap sync ios` in `native/` (CocoaPods preinstalled on runners).
2. Write `~/private_keys/AuthKey_${KEY_ID}.p8` from the secret (`printf '%s\n' … chmod 600`, house style).
3. `plutil -replace teamID -string "$APPLE_TEAM_ID" native/exportOptions.plist` (team from secret, not hard-coded).
4. `xcodebuild archive` (`-workspace native/ios/App/App.xcworkspace -scheme App -configuration Release -destination 'generic/platform=iOS'`, `CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM=$APPLE_TEAM_ID CURRENT_PROJECT_VERSION=$GITHUB_RUN_NUMBER -allowProvisioningUpdates -authenticationKeyPath/-KeyID/-KeyIssuerID`).
5. `xcodebuild -exportArchive` with `native/exportOptions.plist` (same auth flags) → glob the `.ipa`.
6. `apple-actions/upload-testflight-build@v5.2.1` (pinned — latest on the Releases page; README lags at `@v4`) with `app-path` / `issuer-id` / `api-key-id` / `api-private-key`.

**Failure signal: GitHub's built-in workflow-failure e-mail.** The 2026-06-11 "alert via coffee-alert webhook" decision was **reversed (owner, 2026-06-15)** — that webhook only writes a `coffee_alerts` DB row (no push/phone delivery; would also pollute the in-app alerts UI), so it can't serve as an urgent CI-failure alert. A real phone push stays the deferred (C)-tier APNs item in the Feature backlog.

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
- **One-time shared cost it pays down:** adding a widget-extension target to the committed Xcode project without a Mac — **primary path: one-time generation on a runner or XcodeGen; a scripted pbxproj edit is the fragile option, last resort only** (decide for real in the G2 session) — own bundle id (`com.roitsch.btts.widgets`), and cloud signing for multi-target archives (`-allowProvisioningUpdates` handles extensions automatically — verified, with known-but-solvable CI config friction). Everything G3 needs, de-risked on the simplest possible extension.

### G3 — Live Activity brew timer (3–5 days on top of G2)

- Plugin: `@ludufre/capacitor-live-activities` (v8.0.0 May 2026, iOS 16.2+) — **layouts defined from JS as JSON** (lock screen + all Dynamic Island states, incl. timer elements); no SwiftUI authoring. Reuses G2's extension target + signing.
- **Key mechanic:** `Text(timerInterval:)` is system-rendered — elapsed/countdown keeps ticking on the lock screen even when WKWebView JS is frozen. Step-text changes need explicit `updateActivity()` calls; ActivityKit cannot schedule future content locally.
- **v1 of the Live Activity:** foreground-driven updates only (during a brew the app is open + wake-locked, so JS is alive at every step boundary) + a stale-tolerant layout (whole-brew progress bar + "next: 180g at 1:30" static text). Locked-phone step progression would need APNs ActivityKit pushes from the Hetzner server (all boundaries known at brew start, so schedulable) — real backend work, defer; the lock-screen notifications from v1 already cover locked-phone step alerts.
- **Wake-lock assumption — verify in Phase 4 e2e:** "open + wake-locked" relies on the Screen Wake Lock API holding in WKWebView, which is NOT guaranteed to match Safari. The Phase 4 end-to-end checklist carries the test + the `@capacitor-community/keep-awake` fallback.
- No frequent-update entitlement needed at brew-step cadence.

### G4 — Apple Watch (tiered; the expensive tier is optional)

- **Tier 0 — free with v1:** iOS notification mirroring sends each pour-step notification to the watch with a haptic — **but only while the iPhone is locked/asleep** (Apple routing rule). Covers phone-in-pocket brewing; phone-unlocked-on-the-counter routes to the phone instead. Custom haptic patterns impossible on mirrored notifications; owner can enable watch-side "Prominent Haptic".
- **Tier 1 — free with G3:** since watchOS 11, iPhone Live Activities auto-appear in the watch Smart Stack (compact leading/trailing views + auto-launch on alerting updates; `supplementalActivityFamilies([.small])` for a watch-sized layout). Glanceable step/elapsed on the wrist with zero watch code. Per-step wrist *taps* from this path are shaky (needs alerting updates while JS may be suspended) — Tier 0 notifications provide the haptics.
- **Tier 2 — native SwiftUI watch app — ✅ BUILT 2026-06-15 (build 4, awaiting upload).** The owner pulled this forward as THE decisive feature (wrist buzz per step while the phone screen is ON, the wake-locked brew case Tiers 0/1 can't serve). **Architecture as built — DECISION: hand-rolled WatchConnectivity, NOT `@capgo/capacitor-watch`.** That plugin renders a JS-defined UI on the watch; we need the opposite — the watch runs AUTONOMOUSLY so a phone↔watch hiccup mid-brew can't drop a buzz. So:
  - **Web → phone:** `src/lib/native/brewWatch.ts` + `useBrewStepWatch` hook (mirrors the haptics hook). At brew start it converts the step boundaries to **absolute epoch-ms** fire times and hands the WHOLE schedule over once (no per-step messaging). Native-only no-op everywhere else, so it ships to the live PWA harmlessly.
  - **Phone bridge:** `native/ios/App/App/BrewWatchPlugin.swift` — a tiny custom Capacitor plugin (`CAPBridgedPlugin`, jsName `BrewWatch`) that forwards the schedule over `WCSession.sendMessage` (immediate when reachable) + `updateApplicationContext` (durable, for a watch app opened a moment late).
  - **Watch app:** `native/ios/App/BTTSWatch/` (single-target SwiftUI, `WKApplication`). `BrewWatchModel` receives the schedule, runs the timeline on its own `Timer`, plays `WKInterfaceDevice.play(.notification)` at each boundary, and holds a `WKExtendedRuntimeSession` (`self-care` background mode) so it keeps buzzing when the wrist drops / screen sleeps. Absolute epoch-ms times mean a late/duplicate delivery self-corrects (Apple devices are NTP-synced).
  - **Target surgery (no GUI):** `native/scripts/add_watch_target.rb` (Ruby `xcodeproj` gem) injects the `BTTSWatch` target + the `BrewWatchPlugin.swift` App-target ref + the `Embed Watch Content` copy-phase + the build dependency. Idempotent; run after every `cap sync`. This is the reusable answer to the "add an extension/watch target without a Mac GUI" problem G2 was meant to de-risk — solved here first.
  - **Residual / on-device TODO:** the `self-care` extended-runtime session's real-world background-haptic cadence + duration limits need on-device iteration (watchOS restricts background haptic frequency). v1 targets the STATED case (phone screen on, watch app open → foreground/active haptics, which are unrestricted). Watch icon reuses the iOS 1024 PNG (single-size watchOS appiconset).

### Suggested order

G1 (Acaia — biggest daily payoff, smallest cost, independent track) → G2 (widget — pipeline de-risk) → G3 (Live Activity, gets Tier-1 watch free) → reassess whether Tier-2 watch is still wanted.

## Feature backlog (native capabilities, tiered by cost)

Owner-brainstormed June 2026 — what the shell unlocks beyond the G1–G4 milestones. Sorted by the work each needs; pick off after the v1 shell is on the phone. None of these is committed scope yet.

**(A) v1 shell, immediate — only local plugins + data we already have:**
- **Status-bar + whole-screen styling** (`@capacitor/status-bar`). Today iOS freezes the PWA status-bar style at install time (CLAUDE.md gotcha); the shell sets it at runtime, per-screen. Chrome-less WKWebView = the full viewport is ours + native splash.
- **Real haptics** (`@capacitor/haptics`). The brew timer already calls `navigator.vibrate(80)` in `LightStepBrew.tsx` — **iOS Safari ignores the Vibration API entirely**, so it's silently dead today. The plugin gives real Taptic feedback (impact/notification styles) per step.
- **Cold-brew / long-steep timer** (NEW feature). Runs on the existing Phase-1 LocalNotifications bridge via the *schedule-one-notification* model: store the start, schedule a single "cold brew ready" notification 12–24 h out, compute elapsed on reopen. iOS does NOT run JS in the background for hours — but it doesn't need to. A "long brew" mode (no pour guide, just start → reminder → log) is a small standalone feature. *(A live 20-h lock-screen countdown is out — Live Activities are hours, not a day.)*
- **Roast-freshness nudges.** The app knows every `coffees.roastDate` + the bloom-window logic (`getBloomDuration`: 50/45/30 s). Schedule a local notification at the peak window ("Quiquira hits peak tomorrow"). Proactive, uses data already in the model.

**(B) extension work — shares the one-time Xcode-target + signing surgery (this is what G2 de-risks):**
- **Widgets:** "Coffees in Rotation"; "Brew this" → deep-link straight into the Context step via `@capacitor/app` URL handling + the existing `startBrewAgain()` flow; "Scan this Bag" → opens the camera. (G2.)
- **Share-Sheet "Add to BTTS":** share a coffee URL/photo from Safari/Instagram → routes into the EXISTING `analyze-url` / `analyze-bag` flow. Turns manual URL-pasting into one tap; leverages a feature already built.
- **Live Activity** (G3) + **Siri / App Shortcuts** ("Hey Siri, start my morning V60" → opens the brew with the rotation bag).

**(C) server work — Hetzner + APNs, more than just the shell:**
- **Real push for the DORMANT coffee-alerts feature.** The `coffee_alerts` table + `/api/webhooks/coffee-alert` endpoint already exist with no delivery path. Shell + an APNs sender on Hetzner would finally push "your wishlist coffee is back in stock." Activates half-built infrastructure; needs a server-side APNs integration (real backend work, not a plugin).
- **Acaia BT auto-advance:** the scale detects target weight → auto-advances the pour step (fuses the G1 BT track with the timer).

**Endgame:** native SwiftUI Apple Watch app (wet-hands remote: start/stop/next from the wrist, guaranteed per-step haptics regardless of iPhone lock state). G4 Tier 2.

**Best effort/payoff picks (owner's gut, June 2026):** (1) status-bar + haptics — makes it *feel* native, immediate; (2) cold-brew timer — new feature, nearly free on the Phase-1 bridge; (3) Share-Sheet import — kills the URL-paste chore.

## GitHub secrets (complete list — 4)

`APP_STORE_CONNECT_ISSUER_ID`, `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_API_KEY_P8` (paste the .p8 contents), `APPLE_TEAM_ID`.

## Owner manual checklist (only Apple-web-UI steps, all doable from an iPhone)

> **Apple ID disambiguation (decided 2026-06-10):** the owner has two Apple IDs — a work ID (signed into the MacBook's iCloud) and a private ID (signed into the iPhone). Everything in this project runs on the **private** Apple ID: Developer Program enrollment, App Store Connect, TestFlight redemption on the iPhone. The work ID must NOT be used — it may belong to the employer's developer team, which would pull app ownership and legal responsibility into a company context. **The MacBook's iCloud login does NOT need to change.** Do all Apple-side admin steps below in a **browser** (best: Safari on the iPhone, where the private ID is already active; alt: a private/incognito window on the Mac). Avoid the macOS Developer.app — it forces the iCloud-signed-in Apple ID and would put you on the wrong account. Browser logins on developer.apple.com / appstoreconnect.apple.com accept whatever Apple ID you enter, independent of any iCloud session. For the local-debug fallback (only if a CI build hits a wall), Xcode has its own account list (Xcode → Settings → Accounts) independent of the macOS login — add the private ID there, no need to re-log the Mac.

1. ✅ **DONE (2026-06-15)** — Enrolled in the Apple Developer Program with the **private** Apple ID (€99/yr). Activation hung ~92 h in a "complete your purchase" loop; cleared via the support hotline. Note the Team ID from developer.apple.com → Membership.
2. ✅ **DONE (2026-06-15)** — App Store Connect → Users and Access → **Integrations → Teamschlüssel** → Team API key (role **App Manager**); recorded Issuer ID + Key ID, downloaded the `.p8`.
3. ✅ **DONE (2026-06-15)** — All 4 GitHub secrets added (`APP_STORE_CONNECT_ISSUER_ID`, `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_API_KEY_P8` = full PEM incl. BEGIN/END lines, `APPLE_TEAM_ID`).
4. ⬅️ **VERIFY before running `ios-testflight`** — developer.apple.com → Identifiers: register App ID `com.roitsch.btts` (no extra capabilities needed).
5. ⬅️ **VERIFY before running `ios-testflight`** — App Store Connect → New App: iOS, "BTTS", that bundle ID.
6. ⬅️ **NEXT** — Run `ios-bootstrap` from the Actions tab; merge its PR; run `ios-testflight`.
7. TestFlight → Internal Testing → group with automatic distribution → add self.
8. Install the TestFlight app, accept the invite, install BTTS, log in with PIN.
9. Recurring: yearly membership renewal; occasional ASC license-agreement acceptances (CI fails loudly when one is pending); PIN re-login ~monthly.

## Risks (flagged, accepted)

- Capacitor docs label `server.url` "not intended for production" — works and is widely used; re-verify on major Capacitor upgrades; keep navigation single-origin.
- Cloud signing can be flaky on a brand-new account (pending agreements) — retry usually fixes; fastlane match is the documented fallback, only adopt if needed.
- Notification delivery is second-granular (±~1 s) — fine for humans with kettles. iOS 64-pending cap is far above any brew's step count.
- If the owner taps "Don't Allow" on the permission prompt, brews continue exactly as today; re-enable via Settings → BTTS → Notifications (noted in README).
- A silently failing monthly cron rebuild kills the app at day 90 (TestFlight build expiry); monthly cadence gives ~3 attempts but noticing depends on **GitHub's failure e-mail** (the accepted signal). *(The 2026-06-11 idea of also alerting via the coffee-alert webhook was reversed 2026-06-15 — that endpoint only writes a DB row, it can't reach the phone. A real push is the deferred C-tier APNs item.)*
- Force-quitting the shell mid-brew leaves the already-scheduled step notifications to fire orphaned — OS-level, the id-range sweep only runs on the next `scheduleBrew`. Accepted for single-user; a launch-time sweep in the shell would close it (documented Phase 1 limitation, alongside prose-only legacy recipes producing no notifications).
- No service worker in the shell → in-shell offline mode is weaker than the Safari PWA; the PWA remains installed and unaffected.

## Verification

- **Phase 1**: `npx tsc --noEmit` + existing `node --test` suite must stay green; CI screenshots artifact confirms the brew flow renders unchanged (the bridge is a runtime no-op in Chromium). Merged via the normal PR flow → auto-deploys; verify on the live PWA that a brew behaves identically.
- **Phases 2–4**: each workflow run IS the test — bootstrap must produce a mergeable `native/ios` PR; the TestFlight workflow must end with a processed build visible in App Store Connect.
- **End-to-end**: owner installs via TestFlight, logs in with PIN, starts a real brew, locks the phone — pour-step notifications must arrive on the lock screen at the right offsets; finishing/resetting a brew must leave no stray notifications.
- **Wake lock in WKWebView**: start a real brew in the shell and do not touch the phone — the display must not dim/lock for the full brew duration (`useWakeLock` uses the Screen Wake Lock API, whose WKWebView support is not guaranteed to match Safari — unverified assumption that G3 v1 also leans on). If the wake lock does not hold, adopt `@capacitor-community/keep-awake` in the shell (native plugin, trivial) and re-test.

## Stolperstein log

*Grows over time. Every trap hit once goes here so a future session reads it before starting. Entries stay short; link to the commit or PR that fixed it.*

- **The Mac "Apple Developer" app forces the iCloud-signed-in Apple ID** (2026-06-10). The owner's MacBook is signed into iCloud with the work Apple ID — the Developer.app on macOS uses that and offers no account switcher. **Workaround:** never use the Developer app for this project; do all Apple-side admin in a browser. (a) Best path: Safari on the iPhone → developer.apple.com / appstoreconnect.apple.com, where the iPhone's private Apple ID is already in use. (b) Mac path: open a private/incognito window so cached iCloud cookies don't auto-select the work ID, then log in with the private ID. Browser logins are independent of the Mac's iCloud login. The Mac's iCloud login does NOT need to be changed.
- **GitHub-Action version strings — neither a plan doc nor the action's README is authoritative** (2026-06-11). This doc carried `upload-testflight-build@v5`; an external review countered with "the README documents `@v4`"; the repo's **Releases page** (the actual source of truth) shows v5.2.1 as latest — so the plan string happened to be right and the README is what lags. Rule: pin any action to the latest tag verified on its Releases page at implementation time, never trust a transcribed version string (including this doc's).
- **Capacitor was on major 8, not 7, at Phase-2 build** (2026-06-15). The whole plan said "Capacitor 7", but `npm view @capacitor/core version` returned **8.4.0** (ios/cli 8.4.0, local-notifications 8.2.0, assets 3.0.5). Pinned to `^8` and updated the doc — reality wins. Same lesson as the action-version trap: verify the live registry at implementation, don't trust a version transcribed into a plan weeks earlier. (`presentationOptions: []` and `server.url` are unchanged across 7→8; the cap CLI parsed the config cleanly.) Note: the dev-only `@capacitor/assets` 3.0.5 pulls old transitive deps → 8 npm-audit warnings; it runs only in CI for icon generation, never ships in the app.
- **Capacitor 8 CLI requires Node ≥ 22 — `ios-bootstrap` run #1 died on it** (2026-06-15). The iOS workflows had copied the repo's house-style `node-version: 20`; `npm ci` passed but `npx cap add ios` aborted with `[fatal] The Capacitor CLI requires NodeJS >=22.0.0`. Fix: bump BOTH iOS workflows to `node-version: 22` (the repo's other workflows stay on 20 — only the Capacitor ones need 22+). One-line fix, re-run. (PR #311.)
- **GitHub Actions can't create PRs by default — `ios-bootstrap` run #2 died on the `gh pr create` step** (2026-06-15). The build itself fully succeeded (cap add ios → assets → sync → committed + PUSHED `native/ios/` to `ios/bootstrap-generated`); only `gh pr create` failed: `GitHub Actions is not permitted to create or approve pull requests`. That's the OFF-by-default repo toggle *Settings → Actions → General → Workflow permissions → "Allow GitHub Actions to create and approve pull requests"*. Fix: the branch is already pushed, so the PR was opened manually via MCP + merged (PR #312, landed Phase 3); and `gh pr create` was made **non-fatal** (`|| echo "::notice:: …compare link"`) so the job stays green regardless of the setting (PR #313). The owner can optionally flip that toggle to get the auto-PR back.
- **Capacitor 8 iOS = Swift Package Manager, NOT CocoaPods — and the build scheme isn't committed** (2026-06-15, verified by inspecting the generated `native/ios/`). Two consequences that broke `ios-testflight`: (1) there is **no top-level `App.xcworkspace`** (only `App.xcodeproj` + a `CapApp-SPM` local package) → `xcodebuild` must use `-project App.xcodeproj`, not `-workspace App.xcworkspace` (the error was literally `'App.xcworkspace' does not exist`). (2) The **`App` scheme is not in git**: cap's generated `native/ios/.gitignore` ignores `xcuserdata`, where the autocreated scheme lives, so a fresh CI checkout has no scheme and `xcodebuild -scheme App` would fail next. **Root lesson:** a Mac-only toolchain can't be hardened blind from a Linux cloud runner — the first build belongs on the owner's Mac (Xcode autocreates the scheme, resolves SPM, drives signing). After it builds there, commit the **shared** scheme (`App.xcodeproj/xcshareddata/xcschemes/App.xcscheme`) and switch the workflow to `-project` so CI can resume for the monthly rebuilds.
- **The real `APPLE_TEAM_ID` is NOT the `(…)` in the keychain signing cert** (2026-06-15). `security find-identity` shows `Apple Development: Markus Reuter (T3W4DB84YD)` — that parenthetical is the **personal/free** team. Using it for `-exportArchive` failed with `error: exportArchive No Account for Team "T3W4DB84YD"` / `No signing certificate "iOS Distribution" found`. The **Developer Program** team is a *different* 10-char ID (the `APPLE_TEAM_ID` GitHub secret). Recover it without asking the owner by decoding the build's provisioning profile: `security cms -D -i ~/Library/Developer/Xcode/UserData/Provisioning\ Profiles/<uuid>.mobileprovision | plutil -extract TeamIdentifier.0 raw -o - -` (the first build left an `iOS Team Store Provisioning Profile: com.roitsch.btts` there). Then the export + `altool` upload succeed.
- **Upload rejected `90023 Missing required icon` — two causes at once** (2026-06-15). (1) The AppIcon PNG (`AppIcon-512@2x.png`, the single 1024px universal icon) was **gitignored and absent from a clean checkout** (only `Contents.json` was tracked; the first build had it because `npm run assets` had been run locally). The archive built fine (icons are validated at *upload*, not compile), so it silently shipped an icon-less bundle. Fix: removed the `AppIcon-*.png` line from `native/.gitignore` and **committed the icon** + always run `npm run assets` in step 0 of the build recipe. (2) `TARGETED_DEVICE_FAMILY` was `"1,2"` (iPhone+iPad), so Apple demanded iPad icon sizes (152/167) the single universal icon didn't satisfy. Fix: set it to `"1"` (**iPhone-only** — correct for a single-user iPhone app), which drops the iPad requirement entirely. Re-archived as build 3 → upload succeeded.
- **`git reset --hard <other-branch>` after an aborted `checkout` silently moves the CURRENT branch** (2026-06-15). A `git checkout <feature>` aborted on untracked files (left me on `main`); the next `git reset --hard origin/<feature>` then reset **local `main`** to the feature tip (not the feature branch — I was never on it). `origin/main` was untouched (nothing pushed), so recovery was `git branch -f main origin/main` from a safe branch. Lesson: after a *failed* checkout, confirm `git branch --show-current` before any `reset --hard` — the abort means you're still on the old branch.
- **Adding a watchOS target without the Xcode GUI = the `xcodeproj` Ruby gem + a script, NOT hand-editing pbxproj** (2026-06-15). The Capacitor project is a plain `.xcodeproj` (objectVersion 60, SPM-based). `gem install xcodeproj --user-install --no-document` installs cleanly even on the Mac's ancient system ruby 2.6 (→ xcodeproj 1.27.0). `native/scripts/add_watch_target.rb` then does it all: `new_target(:application, 'BTTSWatch', :watchos, '9.0', nil, :swift)`, `add_file_references` (Swift → Sources, `.xcassets` → Resources; do NOT pass `Info.plist` — it's wired via `INFOPLIST_FILE`), per-config build settings, `add_dependency`, and a copy-files phase with `symbol_dst_subfolder_spec = :products_directory` + `dst_path = "$(CONTENTS_FOLDER_PATH)/Watch"` + the product file's `settings = {ATTRIBUTES:[RemoveHeadersOnCopy]}`. Made idempotent (drops a prior `BTTSWatch` target/group/embed-phase first) so it's safe to re-run after every `cap sync`. Unsigned `xcodebuild archive` then embeds `App.app/Watch/BTTSWatch.app` correctly — verified by `plutil -p` on the embedded Info.plist (WKApplication + companion id + matching build number).
- **The App Store Connect ISSUER ID is the one credential not on the Mac — and scanning for it is (correctly) blocked** (2026-06-15). The export (`-authenticationKeyIssuerID`) + `altool` (`--apiIssuer`) both need it; the team ID is recoverable from a provisioning profile and the `.p8` key is in `~/.appstoreconnect/private_keys`, but the issuer UUID is owner-held. GitHub secrets are write-only (can't read `APP_STORE_CONNECT_ISSUER_ID` back via the API), and a broad scan of shell history / Xcode account defaults / Transporter caches for the UUID got denied by the safety classifier (right call — it's credential exploration). Conclusion: just ask the owner to paste it each upload, or store it in a gitignored `native/.asc-issuer` if they prefer (their call — it's an identifier, not a secret key, but keep it out of git regardless). **UPDATE 2026-06-16:** the owner supplied it (`aae3f951-3c39-4c49-bbb0-f7176ecf3459`) and told me to stop re-asking — it's now in Claude memory (`asc-issuer-id`). Read it from there; don't ask again.
- **An UNSIGNED archive with an embedded watch app has NO `ApplicationProperties` → `-exportArchive` fails "exportOptionsPlist error for key method expected one {} but found app-store-connect"** (2026-06-16). The `{}` is an EMPTY allowed-methods set: `IDEDistributionMethodManager` returns "Unknown Distribution Error" (Code=2) three times because it can't compute distribution methods without the archive's `ApplicationProperties` dict (ApplicationPath/CFBundleIdentifier/version/SigningIdentity/Team). An iOS-only unsigned archive (build 3) apparently still got one; the watch-embedded unsigned archive (build 4) did NOT. Fix WITHOUT a signed archive: hand-inject it before export — `plutil -insert ApplicationProperties -json '{"ApplicationPath":"Applications/App.app","CFBundleIdentifier":"com.roitsch.btts","CFBundleShortVersionString":"1.0","CFBundleVersion":"<N>","SigningIdentity":"Apple Distribution","Team":"WTZD878P9H"}' /tmp/App.xcarchive/Info.plist`. Then `-exportArchive` enumerates methods, signs both targets via `-allowProvisioningUpdates`, and produces an IPA with `Payload/App.app/Watch/BTTSWatch.app` (both `codesign -v` valid, both with embedded.mobileprovision). **Add this inject step to the build recipe for any watch build.**
- **`altool`/Xcode upload returns the opaque `90170` right after a brand-new bundle ID is first registered** (2026-06-16). Build 4 (first build carrying the new `com.roitsch.btts.watchkitapp` watch App ID, auto-created by `-allowProvisioningUpdates` during export ~minutes earlier) was rejected by ASC with `90170` "An unexpected error was returned by the server" — same via `altool --upload-app`, `altool --validate-app`, AND Xcode's `destination=upload`. The IPA is correctly built + signed (verified), so it's server-side: the new App ID hadn't propagated on Apple's backend. Handling: a background retry loop (~6 min between tries). If it persists beyond ~1 h, the watch App ID may need a manual confirm on developer.apple.com / the app's ASC record may need the watch app recognized. (Not certain `90170` == propagation — it's undocumented — but signing/provisioning were ruled out, leaving propagation as the best explanation.)

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

- **Done:** Approved iOS shell plan ported into the repo as this doc; CLAUDE.md updated to auto-load it via `@./docs/ios-shell-roadmap.md`; Status & next entry-point section seeded. No code under `src/`, `native/`, or `.github/workflows/ios-*` was touched. Follow-up same day: Apple ID disambiguation added to the Owner checklist (work ID on the MacBook vs private ID on the iPhone — everything runs on the private ID; see the checklist callout).
- **Open / blocked:** Apple Developer enrollment not started (blocks Phases 3–4 only — Phase 1 + 2 are pure code).
- **Traps found:** —
- **Next entry-point:** create `src/lib/native/brewNotifications.ts` per the Phase 1 spec (pure-web module, zero `@capacitor/*` deps, ambient types).
- **PRs / commits this session:** #286, #287, #288

### 2026-06-10 — Phase 1 (web-side notification bridge)

- **Done:** `src/lib/native/brewNotifications.ts` (pure-web bridge module — ambient `window.Capacitor` types, zero `@capacitor/*` deps; `buildBrewBoundaries` skips bloom/setup/t=0 steps, appends a "brew finishing" boundary at target when ≥5 s after the last step; `ensurePermission` caches denial; `scheduleBrew` is cancel-then-schedule on a fixed id range 9300–9339 with a 2 s minimum lead; `cancelBrew` sweeps the full range so a mid-brew reload can't orphan notifications). `src/hooks/useBrewStepNotifications.ts` (schedule at first tick on the timer's own wall-clock anchor; reschedule on >1.5 s anchor drift = Stop→Resume; cancel on Reset/Done/unmount and via the visible-but-paused watchdog — backgrounding does NOT cancel, `visibilityState` distinguishes). `LightStepBrew.tsx` wired additively (boundaries + hook + cancel before `handleDone` on Done Brewing). Tests: `tests/dataflow/brew-notifications.test.mjs` bundles the real TS (esbuild, recipe-fidelity pattern) and locks the notification schedule to the on-screen step schedule. Owner side: Apple Developer enrollment submitted (private Apple ID, browser path), purchase processing per Apple up to 48 h.
- **Open / blocked:** checklist items 2–5 (API key, secrets, App ID, ASC app) wait on Apple's approval; Phases 3–4 gated behind them. Phase 2 is pure code, ready now.
- **Traps found:** —
- **Next entry-point:** Phase 2 — `native/` scaffold + `tsconfig.json` exclude (foldable into the Phase 3 session if preferred).
- **PRs / commits this session:** #289

### 2026-06-11 — pre-Phase-2 (external review pass on the roadmap)

- **Done:** Four review items folded in. (1) Version-skew principle added to Architecture — native plugins ship in the shell BEFORE web code that calls them; always feature-detect; first hit is G1. (2) Wake-lock-in-WKWebView flagged as an unverified assumption — G3 note + Phase 4 end-to-end test item with `@capacitor-community/keep-awake` as the fallback. (3) Upload-action version verified against the repo's Releases page (latest v5.2.1; the README lags at `@v4`) — pin at implementation time; Stolperstein entry added. (4) Cron-failure alert decided by owner: YES — `ios-testflight` alerts on failure via the coffee-alert webhook infra (Phase 4 note + Risks updated). Also: G2 extension-target path reordered (runner generation / XcodeGen primary, scripted pbxproj edit demoted to last resort); force-quit-mid-brew orphaned-notifications limitation documented in Risks.
- **Open / blocked:** Apple approval still pending (checklist items 2–5 behind it). No code touched this session — doc-only.
- **Traps found:** action-version trap (see Stolperstein log).
- **Next entry-point:** unchanged — Phase 2 `native/` scaffold + `tsconfig.json` exclude.
- **PRs / commits this session:** #290

### 2026-06-15 — Phase 2 (`native/` scaffold) + idea backlog + enrollment cleared

- **Done:** Apple Developer enrollment **ACTIVE** (cleared via hotline after a 92-h "complete your purchase" limbo). Built the `native/` Capacitor **8** scaffold: `package.json` + committed `package-lock.json` (`@capacitor/core|ios|cli` 8.4.0, `local-notifications` 8.2.0, `assets` 3.0.5), `capacitor.config.ts` (appId `com.roitsch.btts`, `server.url` = production, `LocalNotifications.presentationOptions: []`, `ios.contentInset: never`), `www/index.html` placeholder, `exportOptions.plist` (app-store-connect, automatic, teamID injected from secret), `assets/logo.svg` (copied from `public/icons/icon-source.svg`, 1024×1024), `.gitignore`, `README.md`. Root edits: `"native"` → `tsconfig.json` exclude; `native/` → `.dockerignore`. Verified: `npm install` resolved + lockfile committed, cap CLI parse-validated the config (all key values resolve), root `tsc` clean, full suite green (34 src + 32 tests). Added the **Feature backlog** section (owner brainstorm, tiered A/B/C + endgame). Confirmed `LocalNotifications.presentationOptions` is a real config key (empty array suppresses foreground banner).
- **Open / blocked:** Phase 3 needs owner checklist items 2–5 first (API key + 4 GitHub secrets + App ID + ASC app). Now that enrollment is active these are all doable.
- **Traps found:** Capacitor major was **8, not 7** (the plan's transcribed "7" was stale) — Stolperstein added; same lesson as the action-version trap.
- **Next entry-point:** Phase 3 — `.github/workflows/ios-bootstrap.yml`, once the owner has created the API key + secrets.
- **PRs / commits this session:** #309

### 2026-06-15 — Phases 3 + 4 (CI build → TestFlight workflows)

- **Done:** `.github/workflows/ios-bootstrap.yml` (macos-15, workflow_dispatch, `contents+pull-requests: write`; `cap add ios` → `npm run assets` → plutil encryption flag → `cap sync` → `gh pr create` for `native/ios/`) and `.github/workflows/ios-testflight.yml` (workflow_dispatch + monthly cron + push-on-`native/**`; write `.p8` from secret → inject teamID into exportOptions → `xcodebuild archive` → `-exportArchive` → `apple-actions/upload-testflight-build@v5.2.1`, cloud signing via `-allowProvisioningUpdates` + API key). Owner side: all **4 GitHub secrets added**, enrollment active. Doc: Phases 3+4 marked shipped, checklist items 2–3 done / 4–5 flagged to verify, cron-alert decision **reversed** (coffee-alert webhook dropped — no phone delivery; GitHub e-mail is the signal). Both YAML files parse-validated; secret names confirmed to match exactly.
- **Open / blocked:** owner button-presses only — run `ios-bootstrap` → merge its PR → run `ios-testflight`. App ID `com.roitsch.btts` + the ASC app record must exist before the upload step succeeds (flagged in the checklist). Expect a possible first-build signing/scheme tweak after reading the run log (fresh-account iteration, per Risks).
- **Traps found:** the coffee-alert webhook has **no phone-delivery path** (storage-only) — it can't serve as a CI-failure alert; reversed the 2026-06-11 decision.
- **Next entry-point:** owner runs the workflows; if the first `ios-testflight` run fails, read the log and patch `ios-testflight.yml` (likely scheme name, Info.plist, or a pending ASC agreement).
- **PRs / commits this session:** #310, #311

### 2026-06-15 — Phase 3 landed (bootstrap ran; two traps fixed)

- **Done:** ran `ios-bootstrap`. Two traps, both fixed: (1) Node 20 → 22 (Capacitor 8 CLI needs ≥22, PR #311); (2) `gh pr create` blocked by the default "Actions can't create PRs" toggle — but the build had already pushed the generated `native/ios/` to `ios/bootstrap-generated`, so the PR was opened via MCP + merged (**PR #312 — `native/ios/` now on main = Phase 3 DONE**), and `ios-bootstrap.yml`'s PR step was made non-fatal so re-runs stay green (PR #313). Merging #312 auto-triggered `ios-testflight` (push on `native/**`) — its result is the next thing to read.
- **Open / blocked:** the first `ios-testflight` run is the live test. Needs App ID `com.roitsch.btts` registered + the App Store Connect app record to exist; otherwise it fails at archive/upload and we patch from the log.
- **Traps found:** Node-22 requirement + Actions-can't-create-PRs (both in Stolperstein log).
- **Next entry-point:** read the auto-triggered `ios-testflight` run log; fix signing / App-ID / ASC-app issues, or celebrate a TestFlight build.
- **PRs / commits this session:** #312, #313

### 2026-06-15 — pivot the first build to the Mac (CI hit the SPM/scheme wall)

- **Done:** read the auto-triggered `ios-testflight` log. It got past the secrets/plist steps and died at `xcodebuild archive` with `'App.xcworkspace' does not exist`. Inspected the committed `native/ios/` and confirmed the two real causes (both now in the Stolperstein log): Capacitor 8 is **SPM** (no `App.xcworkspace`, build with `-project App.xcodeproj`) and the **`App` scheme isn't committed** (cap `.gitignore` excludes `xcuserdata`). Conclusion: hardening a Mac-only build blind from a Linux runner is the wrong approach for the FIRST build. **Decision (owner): do the first build on the MacBook** via a local Claude Code session with Xcode, then commit the shared scheme + fix the workflow `-project` flag so CI resumes for monthly rebuilds. Updated Status + Stolperstein to hand off cleanly.
- **Open / blocked:** the first build now happens on the Mac (owner installs Xcode + Claude Code there). App ID `com.roitsch.btts` + the ASC app record still need to exist for the TestFlight upload — verify.
- **Traps found:** SPM-not-CocoaPods + uncommitted scheme (Stolperstein log).
- **Next entry-point:** on the Mac — `cd native && npm install && npx cap sync ios`, open `native/ios/App/App.xcodeproj` in Xcode, set the team, Archive → Distribute → TestFlight; then commit `App.xcscheme` (shared) + change `ios-testflight.yml` to `-project App.xcodeproj`.
- **PRs / commits this session:** #312, #313, this doc update.

### 2026-06-15 — FIRST BUILD LIVE on the iPhone 🎉 (Mac local build)

- **Done:** built + shipped the first TestFlight build entirely on the Mac after the CI wall. Chain that worked: scoped `GIT_CONFIG_*` (safe.bareRepository=all) so SPM resolves → unsigned `xcodebuild archive` (`CODE_SIGNING_ALLOWED=NO`) → `-exportArchive` distribution-signed via the **Admin** ASC key `A57ZL8HND3` → `xcrun altool --upload-app`. Fixed mid-way: missing app icons (the `native/.gitignore` had excluded the generated `AppIcon-*.png`) — generated via `npm run assets`, committed, gitignore fixed (`e1a7373`). Owner installed via TestFlight; **app runs full-screen on the iPhone.** Recipe + ordered next-phase plan recorded in Status above.
- **Open / blocked:** 2 local commits unpushed (Mac git has no push auth → `gh auth login` is task #1 next session). On-device verification of lock-screen pour notifications + wake lock not yet done (task #2).
- **Traps found (all in Stolperstein log):** SPM safe.bareRepository block; automatic-signing-needs-device → unsigned-archive-then-export; App-Manager key can't cloud-sign → need **Admin** key; missing-icons from the gitignore exclusion.
- **Next entry-point (fresh session, Mac):** `gh auth login` → `git push`; then start a brew + lock the phone to verify notifications.
- **PRs / commits this session:** `e1a7373`, `77375a1` (both local, awaiting push).

### 2026-06-15 — gh auth + notification-haptic fix + step rebuild + Build 3 (Haptics) on TestFlight

- **Done:**
  - **`gh auth login`** (device flow, account `roitsch-code`) → pushed all stuck commits + the SPM `Package.resolved`. Task #1 ✅. `gh` was not installed → `brew install gh` first.
  - **Lock-screen notifications were silent** (owner test: banner shows, no sound/vibration). Cause: scheduled with no `sound` → iOS delivers them *passively*. Fix (PR #314, web, deployed): `sound: "default"` + `interruptionLevel: "timeSensitive"` on each → sound + iPhone vibration + watch haptic. No rebuild (the bridge is web on the live site).
  - **But the lock screen is the wrong use case** — the brew screen is wake-locked, so the phone is never locked; and `navigator.vibrate` is dead in WKWebView. So: **foreground Taptic haptics** via `@capacitor/haptics` — `src/lib/native/brewHaptics.ts` + `useBrewStepHaptics`: 3 MEDIUM taps at t-3/2/1, a strong ~650ms buzz AT each step. Native-only no-op elsewhere.
  - **Brew steps rebuilt (owner ask): every action is a real, timed step.** Swirl/Stir/Tap are now discrete percolation steps placed at `pourStart + pourGrams ÷ POUR_RATE_GPS` (owner-set **4 g/s**), clamped before the next pour. `agitate-bed → tap`. Notifications + haptics fire on them; each gets its own active card + dot. `pourSequence.test.mjs` converted from a drifted duplicated copy to bundling the REAL module (esbuild) + new agitation/flow-rate cases. (PR #315, web.)
  - **Native build (Mac):** added `@capacitor/haptics` to the shell, **hand-authored + committed the shared `App.xcscheme`** (no scheme existed — first build's was in `xcuserdata`), set **iPhone-only**, regenerated the AppIcon, built + uploaded **Build 3** (Delivery UUID `34c8e0b3-…`).
- **Open / blocked:** on-device verification of the foreground vibration + the screen-awake/wake-lock check (next session, after build 3 installs). `Splash.imageset` missing (cosmetic). CI fix (task #3) still deferred — but the shared scheme is now committed, de-risking it.
- **Traps found (all in Stolperstein log):** real `APPLE_TEAM_ID` ≠ the keychain cert's `(…)`; `90023` missing-icon (gitignored PNG + `TARGETED_DEVICE_FAMILY="1,2"`); `git reset --hard` after an aborted checkout moves the current branch.
- **Next entry-point:** install build 3 → start a brew (don't lock) → confirm it vibrates (3-2-1 + step buzz, incl. Swirl/Stir/Tap). Then task #3 (CI) or G1 (Acaia).
- **PRs / commits this session:** #314, #315, + this branch `feat/native-haptics-build` (native Haptics plugin + shared scheme + iPhone-only + roadmap).

### 2026-06-15 — G4 Tier 2 watch app BUILT (build 4 archived, awaiting issuer ID)

- **Done:** owner pulled the native watch app forward as THE decisive feature — wrist buzz per brew step while the iPhone screen is ON (the wake-locked brew case where iOS won't mirror notifications). Built the whole stack, App + watch compile, unsigned archive embeds `App.app/Watch/BTTSWatch.app` (build 4, verified via `plutil -p`):
  - **Web (mergeable now, native-only no-op on the PWA):** `src/lib/native/brewWatch.ts` (boundaries → absolute epoch-ms fires, plugin handoff) + `src/hooks/useBrewStepWatch.ts` (sends the whole schedule once at brew start; re-sends only on >1.5 s anchor drift; ends on reset/done/unmount) + wired into `LightStepBrew.tsx` beside the haptics hook. `tsc` clean.
  - **Phone bridge:** `native/ios/App/App/BrewWatchPlugin.swift` (`CAPBridgedPlugin` jsName `BrewWatch`; `WCSession.sendMessage` + `updateApplicationContext`).
  - **Watch app:** `native/ios/App/BTTSWatch/` — `BTTSWatchApp` (SwiftUI `@main`), `BrewWatchModel` (WCSession receiver + local timer runner + `WKInterfaceDevice.play(.notification)` + `WKExtendedRuntimeSession` self-care), `ContentView` (glance UI), `Info.plist` (`WKApplication`, companion id, `self-care`), `Assets.xcassets` (1024 icon reused).
  - **Target surgery (no GUI):** `native/scripts/add_watch_target.rb` via the `xcodeproj` gem — idempotent, run after `cap sync`. Adds the target + App-target plugin ref + Embed Watch Content phase + dependency.
  - **Architecture decision:** hand-rolled WatchConnectivity, NOT `@capgo/capacitor-watch` (the watch must run autonomously so a link hiccup can't drop a buzz). See the G4 Tier 2 entry.
- **Open / blocked:** **ISSUER ID** (owner-held) is the only thing between the ready archive and TestFlight — export + `altool` upload both need it. Then on-device verify. `self-care` extended-runtime background-haptic cadence may need on-device tuning (v1 targets phone-screen-on + watch-app-open, where foreground haptics are unrestricted).
- **Traps found (Stolperstein log):** watch-target-via-xcodeproj-gem; issuer-ID-not-on-Mac + scan-blocked-by-classifier.
- **Next entry-point:** owner pastes the ASC Issuer ID → `xcodebuild -exportArchive` (`-allowProvisioningUpdates` auto-creates `com.roitsch.btts.watchkitapp` profile) + `xcrun altool --upload-app` build 4 → install → open watch app → brew with screen on → feel the wrist.
- **PRs / commits this session:** branch `feat/watch-app-step-haptics` (web bridge + native watch app + roadmap).

### 2026-06-16 — build 4 signed + upload retrying (90170) + URGENT Done-button hotfix

- **Done:**
  - **URGENT bug fixed + shipped:** "Done Brewing" did nothing → couldn't log brews. Cause: #320 rewired `onNext={() => handleDone()}` to `onNext={handleDone}`, so the CTA's click event reached `handleDone(actualSec)` → `actualTimeSec` became a SyntheticEvent → the localStorage-persisted store threw on `JSON.stringify` → `setStep("log")` never ran. Fixed (restore the wrap + coerce `actualSec` to a number), **PR #322 squash-merged to main, deploy SUCCEEDED** — PWA can log brews again. (Lesson the owner rightly flagged: a "trivial one-liner" in #320 wasn't traced through the shared CTA's event-forwarding.)
  - **Issuer ID** supplied by owner → saved to Claude memory (`asc-issuer-id`); stop re-asking.
  - **Build 4 exported + signed.** Two traps cleared (both in Stolperstein): the unsigned watch archive lacked `ApplicationProperties` (injected via `plutil`); export then signed both targets, IPA verified (`Payload/App.app/Watch/BTTSWatch.app`, both codesign-valid).
  - **Upload blocked by `90170`** (best read: the just-registered watch App ID propagating). Background retry loop running (~6 min × 6).
  - Watch branch rebased onto the hotfixed main (PR #321 now carries both).
- **Open / blocked:** build 4 upload (90170 retry loop); if it persists >~1 h, check the watch App ID on developer.apple.com / the ASC app record. Then on-device wrist verify. `self-care` background-haptic cadence still needs on-device tuning.
- **Next entry-point:** check `/tmp/retry_upload.log` for upload success → owner installs build 4 → open BTTS watch app → brew with phone screen ON → feel the wrist per step.
- **PRs / commits:** #322 (merged, Done-button hotfix), branch `feat/watch-app-step-haptics` (#321, watch app — merge held until wrist verified).
