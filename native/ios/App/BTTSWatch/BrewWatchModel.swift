import Foundation
import WatchConnectivity

/**
 BTTS watch app — APNs push receiver.

 New model (build 13): the watch no longer runs the brew timeline. It registers
 for remote notifications, gets an APNs device token, and hands it to the phone
 over WatchConnectivity. The phone then fires one APNs push per brew step (via
 the server), and the OS buzzes the wrist — at the exact step, synced to the
 phone, with this app CLOSED. No Timer, no schedule, no HealthKit, no workout
 session: the OS owns delivery, so nothing can stall or dump a backlog.

 This object's only job is to ship the device token to the phone (immediately
 when reachable, durably via application-context otherwise) and re-ship it if
 the session reactivates.
 */
final class BrewWatchModel: NSObject, ObservableObject {
    static let shared = BrewWatchModel()

    @Published var tokenReady = false

    private var session: WCSession?
    private var pendingToken: String?

    func activateSession() {
        guard WCSession.isSupported() else { return }
        let s = WCSession.default
        s.delegate = self
        s.activate()
        session = s
    }

    /// Called by the app delegate when APNs hands us a device token (hex string).
    func sendToken(_ hex: String) {
        pendingToken = hex
        DispatchQueue.main.async { self.tokenReady = true }
        flushToken()
    }

    private func flushToken() {
        guard let token = pendingToken, let s = session, s.activationState == .activated else { return }
        let payload: [String: Any] = ["type": "watchToken", "token": token]
        if s.isReachable {
            s.sendMessage(payload, replyHandler: nil, errorHandler: nil)
        }
        // Durable path: delivered to the phone whenever it next processes context.
        try? s.updateApplicationContext(payload)
    }
}

extension BrewWatchModel: WCSessionDelegate {
    func session(
        _ session: WCSession,
        activationDidCompleteWith state: WCSessionActivationState,
        error: Error?
    ) {
        // If the token arrived before the session activated, send it now.
        flushToken()
    }
}
