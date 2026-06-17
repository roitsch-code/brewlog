import Foundation
import Capacitor
import WatchConnectivity

/**
 BrewWatch — phone-side bridge from the WKWebView (JS) to the Apple Watch app.

 The web layer (`src/lib/native/brewWatch.ts`) calls `startBrew` once when a
 brew's timer hits zero, handing over the WHOLE step schedule as absolute
 epoch-ms fire times. We forward it to the watch over WatchConnectivity; the
 watch app runs the timeline itself and buzzes the wrist at each step via a
 physical-therapy extended-runtime session (the only thing that buzzes the wrist
 while the iPhone screen is ON).

 Delivery: `sendMessage` for immediacy when the watch app is reachable
 (foreground — it is, the user opened it at brew start), plus
 `updateApplicationContext` as a durable fallback.
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
    }

    @objc func startBrew(_ call: CAPPluginCall) {
        guard WCSession.isSupported() else { call.resolve(); return }
        let recipeName = call.getString("recipeName") ?? "Brew"
        let firesIn = call.getArray("fires", JSObject.self) ?? []
        var fires: [[String: Any]] = []
        for f in firesIn {
            guard let atMs = f["atMs"] as? Double ?? (f["atMs"] as? NSNumber)?.doubleValue else { continue }
            let label = f["label"] as? String ?? "Next step"
            fires.append(["atMs": atMs, "label": label])
        }
        send(["type": "start", "recipeName": recipeName, "fires": fires])
        call.resolve()
    }

    @objc func endBrew(_ call: CAPPluginCall) {
        send(["type": "end"])
        call.resolve()
    }

    private func send(_ payload: [String: Any]) {
        guard let s = session, s.activationState == .activated else { return }
        if s.isReachable {
            s.sendMessage(payload, replyHandler: nil, errorHandler: nil)
        }
        try? s.updateApplicationContext(payload)
    }
}

/**
 Minimal WCSessionDelegate — the phone only SENDS for this feature, so the
 callbacks are no-ops, but a delegate is mandatory for the session to activate.
 */
final class WatchSessionForwarder: NSObject, WCSessionDelegate {
    static let shared = WatchSessionForwarder()
    func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {}
    func sessionDidBecomeInactive(_ session: WCSession) {}
    func sessionDidDeactivate(_ session: WCSession) { session.activate() }
}
