import Foundation
import Capacitor
import WatchConnectivity

/**
 BrewWatch — phone-side bridge from the WKWebView (JS) to the Apple Watch app.

 The web layer (`src/lib/native/brewWatch.ts`) calls `startBrew` once when a
 brew's timer hits zero, handing over the WHOLE step schedule as absolute
 epoch-ms fire times. We forward it to the watch over WatchConnectivity. The
 watch app then runs the timeline itself and buzzes the wrist at each step —
 which is the only way to alert the wrist while the iPhone screen is ON (during
 a wake-locked brew iOS will not mirror notifications to the watch).

 Delivery strategy: `sendMessage` for immediacy when the watch app is reachable
 (foreground), AND `updateApplicationContext` always, so a watch app opened a
 moment later still picks up the in-progress brew. We never message per step —
 the watch owns the timeline, so no single buzz can be dropped by a flaky link.
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
            // atMs arrives as a JS number → NSNumber; keep it as a plist-safe Double.
            guard let atMs = f["atMs"] as? Double ?? (f["atMs"] as? NSNumber)?.doubleValue else { continue }
            let label = f["label"] as? String ?? "Next step"
            fires.append(["atMs": atMs, "label": label])
        }

        let payload: [String: Any] = [
            "type": "start",
            "recipeName": recipeName,
            "fires": fires,
        ]
        send(payload)
        call.resolve()
    }

    @objc func endBrew(_ call: CAPPluginCall) {
        send(["type": "end"])
        call.resolve()
    }

    private func send(_ payload: [String: Any]) {
        guard let s = session, s.activationState == .activated else { return }
        // Immediate path when the watch app is in the foreground.
        if s.isReachable {
            s.sendMessage(payload, replyHandler: nil, errorHandler: nil)
        }
        // Durable "latest brew state" path — delivered whenever the watch app
        // next becomes active, so a slightly-late open still gets the brew.
        try? s.updateApplicationContext(payload)
    }
}

/**
 A minimal WCSessionDelegate. The phone only SENDS to the watch for this
 feature, so the callbacks are no-ops — but a delegate is mandatory for the
 session to activate, and iOS requires the multi-device reactivation stubs.
 */
final class WatchSessionForwarder: NSObject, WCSessionDelegate {
    static let shared = WatchSessionForwarder()

    func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {}
    func sessionDidBecomeInactive(_ session: WCSession) {}
    func sessionDidDeactivate(_ session: WCSession) {
        // Re-activate for a newly-paired watch.
        session.activate()
    }
}
