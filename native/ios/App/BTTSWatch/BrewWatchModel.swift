import Foundation
import WatchConnectivity
import WatchKit

/**
 BTTS watch app — runs the brew timeline locally and buzzes the wrist at each
 step, even with the screen off / wrist down, while the iPhone is active.

 WHY THIS WORKS (after several wrong turns):
 - watchOS will NOT play `WKInterfaceDevice.play()` haptics for a backgrounded
   app (that was build 8-11's bug), and it DELAYS notifications to the watch
   while the phone is active (that was build 12-16, ~15 s late).
 - The fix is a `WKExtendedRuntimeSession` of type **physical-therapy** (declared
   in Info.plist `WKBackgroundModes`). Physical-therapy sessions RUN IN THE
   BACKGROUND and keep the app alive, and the session's own
   `notifyUser(hapticType:)` plays a haptic that fires wrist-down / screen-off —
   directly on the watch, with no notification routing and no delay.

 The iPhone hands over the whole step schedule (absolute epoch-ms fire times)
 over WatchConnectivity when the brew starts (the user opens this app once at
 brew start, so the session can be started while foreground — required). The
 watch then runs the timeline itself: a phone↔watch hiccup can't drop a buzz.
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

    func activateSession() {
        guard WCSession.isSupported() else { return }
        let s = WCSession.default
        s.delegate = self
        s.activate()
    }

    // MARK: - Brew lifecycle

    private func startBrew(recipeName: String, fires incoming: [Fire]) {
        let now = Date()
        let sorted = incoming.sorted { $0.at < $1.at }
        self.fires = sorted.map { var f = $0; if $0.at <= now { f.fired = true }; return f }
        self.recipeName = recipeName
        self.isBrewing = true
        self.currentLabel = "Brewing"
        startRuntimeSession() // keeps the app alive in the background for the brew
        startTicker()
        refreshLabels(now: now)
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

    // MARK: - Extended runtime session (physical-therapy → background-running)

    private func startRuntimeSession() {
        runtimeSession?.invalidate()
        let session = WKExtendedRuntimeSession()
        session.delegate = self
        // Must be started while the app is foreground — it is, the user just
        // opened the watch app at brew start.
        session.start()
        runtimeSession = session
    }

    // MARK: - Timeline ticker + haptics

    private func startTicker() {
        ticker?.invalidate()
        let t = Timer(timeInterval: 0.2, repeats: true) { [weak self] _ in self?.tick() }
        RunLoop.main.add(t, forMode: .common)
        ticker = t
    }

    private func tick() {
        guard isBrewing else { return }
        let now = Date()
        var advanced = false
        for i in fires.indices where !fires[i].fired && fires[i].at <= now {
            let late = now.timeIntervalSince(fires[i].at)
            fires[i].fired = true
            currentLabel = fires[i].label
            advanced = true
            // Late-skip guard: if we somehow caught up after a stall, don't dump
            // a backlog of buzzes — only fire if this step is essentially on time.
            if late <= 3 { buzz() }
        }
        if advanced { refreshLabels(now: now) }
        // Wind down a few seconds after the last step so the session doesn't
        // hold longer than needed.
        if let last = fires.last?.at, now.timeIntervalSince(last) > 8 {
            endBrew()
        }
    }

    /// The wrist cue — the SESSION's haptic, which fires in the background /
    /// wrist-down (unlike WKInterfaceDevice.play()).
    private func buzz() {
        guard let s = runtimeSession, s.state == .running else { return }
        s.notifyUser(hapticType: .notification, repeatHandler: nil)
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
    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) { handle(message) }
    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) { handle(applicationContext) }
}

// MARK: - WKExtendedRuntimeSessionDelegate

extension BrewWatchModel: WKExtendedRuntimeSessionDelegate {
    func extendedRuntimeSessionDidStart(_ extendedRuntimeSession: WKExtendedRuntimeSession) {
        // A confirmation tap that the wrist took over the brew.
        extendedRuntimeSession.notifyUser(hapticType: .start, repeatHandler: nil)
    }

    func extendedRuntimeSessionWillExpire(_ extendedRuntimeSession: WKExtendedRuntimeSession) {}

    func extendedRuntimeSession(
        _ extendedRuntimeSession: WKExtendedRuntimeSession,
        didInvalidateWith reason: WKExtendedRuntimeSessionInvalidationReason,
        error: Error?
    ) {
        if runtimeSession === extendedRuntimeSession { runtimeSession = nil }
    }
}
