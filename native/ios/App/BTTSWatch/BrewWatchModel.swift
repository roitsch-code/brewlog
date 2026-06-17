import Foundation
import WatchConnectivity
import WatchKit
import os

private let wlog = Logger(subsystem: "com.roitsch.btts.watchkitapp", category: "brewwatch")

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

 DELIVERY (build 18 hardening): the iPhone re-sends the whole schedule every ~3 s
 while the brew runs, over BOTH `sendMessage` (when reachable) and
 `transferUserInfo`/`updateApplicationContext` (durable). The schedule carries a
 stable `brewId` so a re-send while already running is ignored (no session
 restart). On launch we also drain any context that arrived before activation.
 So a single missed reachability window can no longer drop the brew — whenever
 the watch app next becomes reachable it picks the schedule up and starts.
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

    // Visible diagnostics (read off the watch face when idle).
    @Published var wcState = "—"
    @Published var reachable = false
    @Published var msgCount = 0
    @Published var lastFires = 0
    @Published var lastEvent = "none"

    private var fires: [Fire] = []
    private var ticker: Timer?
    private var runtimeSession: WKExtendedRuntimeSession?
    private var currentBrewId: Double = 0

    func activateSession() {
        guard WCSession.isSupported() else { wlog.error("WCSession unsupported"); return }
        let s = WCSession.default
        s.delegate = self
        s.activate()
        wlog.log("activate() called")
    }

    // MARK: - Brew lifecycle

    private func startBrew(brewId: Double, recipeName: String, fires incoming: [Fire]) {
        // Idempotent re-send guard: same brew already running → ignore.
        if isBrewing && brewId == currentBrewId {
            wlog.log("duplicate start ignored brewId=\(brewId, privacy: .public)")
            return
        }
        let now = Date()
        currentBrewId = brewId
        let sorted = incoming.sorted { $0.at < $1.at }
        self.fires = sorted.map { var f = $0; if $0.at <= now { f.fired = true }; return f }
        self.recipeName = recipeName
        self.isBrewing = true
        self.currentLabel = "Brewing"
        self.lastEvent = "start \(self.fires.count)"
        wlog.log("startBrew name=\(recipeName, privacy: .public) fires=\(self.fires.count) brewId=\(brewId, privacy: .public)")
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
        currentBrewId = 0
        lastEvent = "end"
        ticker?.invalidate()
        ticker = nil
        runtimeSession?.invalidate()
        runtimeSession = nil
        wlog.log("endBrew")
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
        wlog.log("runtime session start() requested")
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
        guard let s = runtimeSession, s.state == .running else {
            wlog.error("buzz skipped — session not running")
            return
        }
        s.notifyUser(hapticType: .notification, repeatHandler: nil)
        wlog.log("BUZZ")
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

    fileprivate func handle(_ payload: [String: Any], via source: String) {
        DispatchQueue.main.async {
            self.msgCount += 1
            self.lastEvent = "rx:\(source)"
            let type = payload["type"] as? String ?? ""
            wlog.log("rx \(source, privacy: .public) type=\(type, privacy: .public)")
            switch type {
            case "start":
                let name = payload["recipeName"] as? String ?? "Brew"
                let brewId = (payload["brewId"] as? Double) ?? (payload["brewId"] as? NSNumber)?.doubleValue ?? 0
                let raw = payload["fires"] as? [[String: Any]] ?? []
                let parsed: [Fire] = raw.compactMap { dict in
                    guard let atMs = dict["atMs"] as? Double ?? (dict["atMs"] as? NSNumber)?.doubleValue
                    else { return nil }
                    let label = dict["label"] as? String ?? "Next step"
                    return Fire(at: Date(timeIntervalSince1970: atMs / 1000.0), label: label)
                }
                self.lastFires = parsed.count
                guard !parsed.isEmpty else { wlog.error("start with 0 fires"); return }
                self.startBrew(brewId: brewId, recipeName: name, fires: parsed)
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
    func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
        DispatchQueue.main.async {
            self.wcState = state == .activated ? "active" : "inactive(\(state.rawValue))"
            self.reachable = session.isReachable
            wlog.log("activationDidComplete state=\(state.rawValue) reachable=\(session.isReachable)")
            // Drain any application context that arrived before we activated.
            let ctx = session.receivedApplicationContext
            if !ctx.isEmpty { self.handle(ctx, via: "ctx@launch") }
        }
    }
    func sessionReachabilityDidChange(_ session: WCSession) {
        DispatchQueue.main.async { self.reachable = session.isReachable }
        wlog.log("reachability=\(session.isReachable)")
    }
    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) { handle(message, via: "msg") }
    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) { handle(applicationContext, via: "ctx") }
    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) { handle(userInfo, via: "userInfo") }
}

// MARK: - WKExtendedRuntimeSessionDelegate

extension BrewWatchModel: WKExtendedRuntimeSessionDelegate {
    func extendedRuntimeSessionDidStart(_ extendedRuntimeSession: WKExtendedRuntimeSession) {
        // A confirmation tap that the wrist took over the brew.
        wlog.log("runtime session DID START")
        extendedRuntimeSession.notifyUser(hapticType: .start, repeatHandler: nil)
    }

    func extendedRuntimeSessionWillExpire(_ extendedRuntimeSession: WKExtendedRuntimeSession) {
        wlog.log("runtime session WILL EXPIRE")
    }

    func extendedRuntimeSession(
        _ extendedRuntimeSession: WKExtendedRuntimeSession,
        didInvalidateWith reason: WKExtendedRuntimeSessionInvalidationReason,
        error: Error?
    ) {
        wlog.error("runtime session invalidated reason=\(reason.rawValue) err=\(String(describing: error), privacy: .public)")
        if runtimeSession === extendedRuntimeSession { runtimeSession = nil }
    }
}
