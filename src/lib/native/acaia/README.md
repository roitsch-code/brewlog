# Acaia scale (BLE) — G1

Live weight + flow from an Acaia Lunar / Pearl on the brew screen, over Bluetooth
in the native iOS shell. Invisible everywhere else.

## Provenance — do not "clean up" the protocol

`decoder.ts`, `common.ts`, `constants.ts`, `util.ts` and the protocol half of
`acaia.ts` are ported from **Beanconqueror** (MIT, `src/classes/devices/acaia/`),
itself ported from **pyacaia** (lucapinello). The byte math — magic-header
framing, length/checksum, weight unit-divisor + sign bit, the ident handshake,
the 1 s heartbeat, the command encoders — is the reverse-engineered protocol.
**Never rewrite a shift, divisor, or payload from memory** (CLAUDE.md Hard Rule).
`tests/dataflow/acaia-protocol.test.mjs` locks the decode/encode math.

## What we changed vs Beanconqueror

- **Transport injected.** Beanconqueror calls the Cordova `window.ble.*` plugin
  directly. We pass an `AcaiaTransport` (`transport.ts`) so `acaia.ts` has zero
  `@capacitor/*` import and the protocol is unit-testable. `manager.ts` builds
  the transport around `@capacitor-community/bluetooth-le`.
- **Angular bits removed.** `Logger`/`UISettingsStorage` → a local no-op logger +
  constant defaults (`HEARTBEAT_INTERVAL` 1000, `CONNECTION_MODE` 'V2' = the iOS
  fast path). `lodash.memoize` → a local memoize.
- **Strict TS.** Nullable `msg`, `ArrayBufferLike` on the decoder, no `any`.
- **Heartbeat monitor (`startHeartbeatMonitor`) does three things per tick.**
  (1) **Drives the handshake** — re-`ident()`s until the scale is both subscribed
  and has been sent the `encodeNotificationRequest` that starts the weight stream.
  On the iOS V2 path `ident()` is a two-step handshake: it sends `encodeId` while
  `recievesNotifications` is false, then sends the notification request on the
  *next* call once that flips true. The monitor MUST keep calling it until both
  steps are done or the scale connects but never streams weight. (2) **Independent
  keepalive** — drives a real `heartbeat()` every second so the scale stays awake
  even when no notifications arrive. (3) **Stall revival** — re-subscribes when a
  running stream has genuinely gone silent (`NOTIFICATION_STALL_MS`).
  History: the upstream monitor re-`ident()`s every tick (which does (1) for
  free), but relies on incoming notifications to drive the heartbeat, so a stall
  freezes the weight with no recovery. PR #408 added (2)+(3) but dropped the
  per-tick re-`ident()` — over-reading "no-op once subscribed" as "no-op always"
  — which broke PAIRING (the notification request stopped being sent on connect).
  This monitor keeps all three. Uses only the existing ported packets — do NOT
  collapse (1) back into the stall path to "restore upstream parity".

## Files

| File | Role |
|---|---|
| `constants.ts` / `common.ts` / `util.ts` | verbatim protocol constants, enums, UUID helpers |
| `decoder.ts` | frame decoder (verbatim math; local logger) |
| `acaia.ts` | `AcaiaScale` — handshake, heartbeat, command encoders (transport-injected) |
| `transport.ts` | the BLE seam (`AcaiaTransport`) |
| `manager.ts` | scan / connect / discover / lifecycle around `@capacitor-community/bluetooth-le` (dynamic import; the ONLY file that touches the plugin) |
| `../../../hooks/useAcaiaScale.ts` | React wrapper (capability + status + live weight) |
| `../../../components/flow/ScalePanel.tsx` | the brew-screen UI |

## Version-skew & safety

The BLE plugin ships in the **shell first** (build 9), then this web code. The
plugin is loaded only via a runtime dynamic import inside `manager.ts`, so it
never enters the PWA's main chunk and never loads off the shell. `acaiaCapable()`
(= `Capacitor.isNativePlatform()`) gates the whole feature, so the Safari PWA
renders nothing and calls no BLE. Everything is try/caught — a BLE failure can
never disturb the brew timer.

## Device matching

A scan result is an Acaia iff the first 5 chars of its advertised name are
`ACAIA` / `LUNAR` / `PYXIS` / `PROCH` / `PEARL` / `CINCO` (mirrors Beanconqueror's
`LunarScale.test`; `PROCH` = old Pearls advertising as `PROCHBT001`). The owner's
Lunar 2017 + original Pearl are old-protocol (single characteristic `00002a80-…`);
`findBLEUUIDs` also handles the Pyxis layout.

## On-device TODO (next session, after build 9 is installed)

1. **Spike:** open a brew, tap Connect, confirm grams stream from the Lunar. iOS
   BLE connection timing can be finicky (Beanconqueror keeps two iOS modes + a
   150 ms sleep — both preserved); if connect is flaky, that's the first place to
   look.
2. Tell the owner **not to pair the scale in iOS Settings** — it's a plain GATT
   connect, OS pairing interferes.
3. Later: tare-from-app already wired; pour auto-advance from weight rate-of-change
   is the follow-up (fuses BLE with the timer).
