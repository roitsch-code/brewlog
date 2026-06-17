import Foundation
import Capacitor
import WatchConnectivity
import os

private let plog = Logger(subsystem: "com.roitsch.btts", category: "brewwatch")

/**
 BrewWatch — phone-side bridge from the WKWebView (JS) to the Apple Watch app.

 The web layer (`src/lib/native/brewWatch.ts`) calls `startBrew` repeatedly
 (every ~3 s) during a brew, handing over the WHOLE step schedule as absolute
 epoch-ms fire times plus a stable `brewId`. We forward it to the watch over
 WatchConnectivity; the watch app runs the timeline itself and buzzes the wrist
 at each step via a physical-therapy extended-runtime session (the only thing
 that buzzes the wrist while the iPhone screen is ON).

 Delivery (build 18): `sendMessage` for immediacy when the watch app is
 reachable, PLUS `transferUserInfo` (a durable FIFO queue that delivers even
 when the watch app is backgrounded) AND `updateApplicationContext` (latest
 state on next launch). The watch dedupes on `brewId`, so the periodic re-send
 is free — whenever the watch next becomes reachable it picks the brew up.
 */
@objc(BrewWatchPlugin)
public class BrewWatchPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BrewWatchPlugin"
    public let jsName = "BrewWatch"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startBrew", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endBrew", returnType: CAPPluginReturnPromise),
    ]

    private var session: WCSession?

    override public func load() {
        guard WCSession.isSupported() else { return }
        let s = WCSession.default
        s.delegate = WatchSessionForwarder.shared
        s.activate()
        session = s
        plog.log("plugin load() — WCSession activate()")
    }

    @objc func startBrew(_ call: CAPPluginCall) {
        guard WCSession.isSupported() else { call.resolve(); return }
        let recipeName = call.getString("recipeName") ?? "Brew"
        let brewId = call.getDouble("brewId") ?? 0
        let firesIn = call.getArray("fires", JSObject.self) ?? []
        var fires: [[String: Any]] = []
        for f in firesIn {
            guard let atMs = f["atMs"] as? Double ?? (f["atMs"] as? NSNumber)?.doubleValue else { continue }
            let label = f["label"] as? String ?? "Next step"
            fires.append(["atMs": atMs, "label": label])
        }
        send(["type": "start", "recipeName": recipeName, "brewId": brewId, "fires": fires])
        call.resolve()
    }

    @objc func endBrew(_ call: CAPPluginCall) {
        send(["type": "end"])
        call.resolve()
    }

    private func send(_ payload: [String: Any]) {
        guard let s = session, s.activationState == .activated else {
            plog.error("send skipped — session not activated")
            return
        }
        let reach = s.isReachable
        let paired = s.isPaired
        let installed = s.isWatchAppInstalled
        plog.log("send type=\(payload["type"] as? String ?? "?", privacy: .public) reachable=\(reach) paired=\(paired) installed=\(installed)")
        if reach {
            s.sendMessage(payload, replyHandler: nil) { err in
                plog.error("sendMessage failed: \(err.localizedDescription, privacy: .public)")
            }
        }
        // Durable queue — delivers even when the watch app is backgrounded.
        s.transferUserInfo(payload)
        try? s.updateApplicationContext(payload)
    }
}

/**
 Minimal WCSessionDelegate — the phone only SENDS for this feature, so the
 callbacks are no-ops, but a delegate is mandatory for the session to activate.
 */
final class WatchSessionForwarder: NSObject, WCSessionDelegate {
    static let shared = WatchSessionForwarder()
    func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
        plog.log("phone activationDidComplete state=\(state.rawValue) paired=\(session.isPaired) installed=\(session.isWatchAppInstalled)")
    }
    func sessionDidBecomeInactive(_ session: WCSession) {}
    func sessionDidDeactivate(_ session: WCSession) { session.activate() }
}
