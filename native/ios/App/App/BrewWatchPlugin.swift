import Foundation
import Capacitor
import WatchConnectivity

/**
 BrewWatch — phone-side bridge between the watch and the WKWebView (JS).

 New model (build 13): the watch is a push receiver. It registers for remote
 notifications and sends its APNs device token to the phone over
 WatchConnectivity. This plugin receives that token and surfaces it to JS — the
 web layer (`src/lib/native/watchPush.ts`) registers it with the server, which
 then pushes one alert to the watch per brew step. The phone no longer sends a
 schedule to the watch; per-step pushes go web → server → APNs.
 */
@objc(BrewWatchPlugin)
public class BrewWatchPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BrewWatchPlugin"
    public let jsName = "BrewWatch"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getWatchToken", returnType: CAPPluginReturnPromise),
    ]

    private var session: WCSession?
    private var lastToken: String?

    override public func load() {
        guard WCSession.isSupported() else { return }
        WatchSessionForwarder.shared.onToken = { [weak self] token in
            self?.lastToken = token
            self?.notifyListeners("watchToken", data: ["token": token])
        }
        let s = WCSession.default
        s.delegate = WatchSessionForwarder.shared
        s.activate()
        session = s
    }

    /// Return the latest watch APNs token the phone has received (or "").
    @objc func getWatchToken(_ call: CAPPluginCall) {
        call.resolve(["token": lastToken ?? ""])
    }
}

/**
 WCSession delegate that forwards the watch's APNs token to the plugin. A
 delegate is mandatory for the session to activate; the multi-device
 reactivation stubs are required by iOS.
 */
final class WatchSessionForwarder: NSObject, WCSessionDelegate {
    static let shared = WatchSessionForwarder()
    var onToken: ((String) -> Void)?

    private func handle(_ message: [String: Any]) {
        guard (message["type"] as? String) == "watchToken",
              let token = message["token"] as? String, !token.isEmpty
        else { return }
        DispatchQueue.main.async { self.onToken?(token) }
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        handle(message)
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        handle(applicationContext)
    }

    func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {}
    func sessionDidBecomeInactive(_ session: WCSession) {}
    func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }
}
