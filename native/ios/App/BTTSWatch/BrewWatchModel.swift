import Foundation
import WatchConnectivity
import WatchKit

/**
 The brain of the BTTS watch app.

 The iPhone hands us the whole brew schedule once at brew start (absolute
 epoch-ms fire times). We run the timeline locally and play a wrist haptic at
 each step — so the wrist buzzes regardless of what the iPhone screen is doing
 (the decisive case: phone on the counter, screen on, where iOS will not mirror
 notifications to the watch).

 Running the schedule on the watch (rather than having the phone message us per
 step) makes it resilient: a phone↔watch link hiccup mid-brew can't drop a buzz,
 because we already hold every fire time. A WKExtendedRuntimeSession (self-care
 category) keeps us alive to buzz when the wrist drops and the screen sleeps.
 */
final class BrewWatchModel: NSObject, ObservableObject {
    static let shared = BrewWatchModel()

    struct Fire: Identifiable {
        let id = UUID()
        let at: Date
        let label: String
        var fired = false
    }

    @Published var isBrewing = false
    @Published var recipeName = "BTTS"
    @Published var currentLabel = ""
    @Published var nextLabel: String?
    @Published var nextFireAt: Date?

    private var fires: [Fire] = []
    private var ticker: Timer?
    private var runtimeSession: WKExtendedRuntimeSession?

    // MARK: - Lifecycle

    func activateSession() {
        guard WCSession.isSupported() else { return }
        let s = WCSession.default
        s.delegate = self
        s.activate()
    }

    // MARK: - Schedule control (always called on the main thread)

    private func startBrew(recipeName: String, fires incoming: [Fire]) {
        let now = Date()
        // Keep the whole schedule for display, but only future fires can buzz.
        let sorted = incoming.sorted { $0.at < $1.at }
        self.fires = sorted.map { var f = $0; if $0.at <= now { f.fired = true }; return f }
        self.recipeName = recipeName
        self.isBrewing = true
        self.currentLabel = "Brewing"
        startRuntimeSession()
        startTicker()
        refreshLabels(now: now)
        WKInterfaceDevice.current().play(.start) // brew handed over to the wrist
    }

    private func endBrew() {
        isBrewing = false
        currentLabel = ""
        nextLabel = nil
        nextFireAt = nil
        fires = []
        ticker?.invalidate()
        ticker = nil
        runtimeSession?.invalidate()
        runtimeSession = nil
    }

    private func startTicker() {
        ticker?.invalidate()
        let t = Timer(timeInterval: 0.2, repeats: true) { [weak self] _ in
            self?.tick()
        }
        RunLoop.main.add(t, forMode: .common)
        ticker = t
    }

    private func tick() {
        guard isBrewing else { return }
        let now = Date()
        var didFire = false
        for i in fires.indices where !fires[i].fired && fires[i].at <= now {
            fires[i].fired = true
            currentLabel = fires[i].label
            buzz()
            didFire = true
        }
        if didFire { refreshLabels(now: now) }
        // Auto-wind-down a few seconds after the last step, so a forgotten
        // brew doesn't hold the runtime session open indefinitely.
        if let last = fires.last?.at, now.timeIntervalSince(last) > 8 {
            endBrew()
        }
    }

    private func refreshLabels(now: Date) {
        if let next = fires.first(where: { !$0.fired }) {
            nextLabel = next.label
            nextFireAt = next.at
        } else {
            nextLabel = nil
            nextFireAt = nil
        }
    }

    /// The wrist cue at a step boundary. Strong + clearly felt.
    private func buzz() {
        WKInterfaceDevice.current().play(.notification)
    }

    // MARK: - Extended runtime (buzz with the screen off / wrist down)

    private func startRuntimeSession() {
        guard runtimeSession == nil else { return }
        let s = WKExtendedRuntimeSession()
        s.delegate = self
        s.start()
        runtimeSession = s
    }

    // MARK: - Payload parsing

    fileprivate func handle(_ payload: [String: Any]) {
        DispatchQueue.main.async {
            let type = payload["type"] as? String ?? ""
            switch type {
            case "start":
                let name = payload["recipeName"] as? String ?? "Brew"
                let raw = payload["fires"] as? [[String: Any]] ?? []
                let parsed: [Fire] = raw.compactMap { dict in
                    guard let atMs = dict["atMs"] as? Double ?? (dict["atMs"] as? NSNumber)?.doubleValue
                    else { return nil }
                    let label = dict["label"] as? String ?? "Next step"
                    return Fire(at: Date(timeIntervalSince1970: atMs / 1000.0), label: label)
                }
                guard !parsed.isEmpty else { return }
                self.startBrew(recipeName: name, fires: parsed)
            case "end":
                self.endBrew()
            default:
                break
            }
        }
    }
}

// MARK: - WCSessionDelegate

extension BrewWatchModel: WCSessionDelegate {
    func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {}

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        handle(message)
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        handle(applicationContext)
    }
}

// MARK: - WKExtendedRuntimeSessionDelegate

extension BrewWatchModel: WKExtendedRuntimeSessionDelegate {
    func extendedRuntimeSessionDidStart(_ extendedRuntimeSession: WKExtendedRuntimeSession) {}
    func extendedRuntimeSessionWillExpire(_ extendedRuntimeSession: WKExtendedRuntimeSession) {}
    func extendedRuntimeSession(
        _ extendedRuntimeSession: WKExtendedRuntimeSession,
        didInvalidateWith reason: WKExtendedRuntimeSessionInvalidationReason,
        error: Error?
    ) {
        if runtimeSession === extendedRuntimeSession { runtimeSession = nil }
    }
}
