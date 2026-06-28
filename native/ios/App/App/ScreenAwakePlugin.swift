import Foundation
import Capacitor
import UIKit

/**
 ScreenAwake — keep the iPhone screen on during a brew.

 An APP-LOCAL Capacitor plugin (registered explicitly in
 `MainViewController.capacitorDidLoad`), NOT the npm `@capacitor-community/keep-awake`
 plugin. The npm plugin is in package.json but was NEVER linked into the binary —
 it's absent from `CapApp-SPM/Package.swift` — so its `keepAwake()` had no native
 implementation, `useWakeLock` silently fell back to the Web Wake Lock API (which
 WKWebView doesn't support), and the brew screen slept. A sleeping screen suspends
 the WKWebView JS, which pauses the Acaia's 1 s heartbeat timer → the scale drops.

 This sidesteps all of that: an app-local plugin is compiled in and registered for
 certain, so flipping `isIdleTimerDisabled` can't be a no-op. The web side calls
 `ScreenAwake.keep()` while a brew screen is open and `ScreenAwake.allow()` when it
 closes (`src/hooks/useWakeLock.ts`). iOS resets `isIdleTimerDisabled` to false when
 the app backgrounds, so the web layer re-asserts `keep()` on every foreground.
 */
@objc(ScreenAwakePlugin)
public class ScreenAwakePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ScreenAwakePlugin"
    public let jsName = "ScreenAwake"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "keep", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "allow", returnType: CAPPluginReturnPromise),
    ]

    @objc func keep(_ call: CAPPluginCall) {
        // UIApplication state must be touched on the main thread.
        DispatchQueue.main.async {
            UIApplication.shared.isIdleTimerDisabled = true
            call.resolve()
        }
    }

    @objc func allow(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            UIApplication.shared.isIdleTimerDisabled = false
            call.resolve()
        }
    }
}
