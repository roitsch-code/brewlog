import Foundation
import WatchConnectivity
import WatchKit
import HealthKit
import os

private let wlog = Logger(subsystem: "com.roitsch.btts.watchkitapp", category: "brewwatch")

/**
 BTTS watch app — runs the brew timeline locally and buzzes the wrist at each
 step, even with the screen off / wrist down, while the iPhone is active.

 HAPTIC MECHANISM (build 19 — back to the one that was CONFIRMED working in
 build 8): watchOS will NOT fire `WKInterfaceDevice` haptics for a backgrounded
 app — the documented EXCEPTION is an app with an active `HKWorkoutSession`
 (exactly how interval/HIIT timers buzz the wrist with the screen off). So at
 brew start we begin a lightweight workout session; while it runs the app stays
 alive in the background and every step buzzes even with the wrist down. We end
 it the moment the brew finishes. (The app must still be OPENED at brew start —
 Apple won't let a closed watch app start a session or buzz on its own.)

 NOTE: build 17/18 tried a physical-therapy `WKExtendedRuntimeSession` +
 `notifyUser` instead, to dodge the HealthKit signing hassle — that mechanism
 did NOT buzz (rx reached the watch, but no haptic). HKWorkoutSession is the
 one that works; reverted to it.

 DELIVERY (kept from build 18): the iPhone re-sends the whole schedule every ~3 s
 over sendMessage + transferUserInfo + updateApplicationContext, with a stable
 `brewId` the watch dedupes on — so a missed reachability window can't drop the
 brew. The on-screen diagnostic line + os.Logger stay until this is signed off.
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
    @Published var workout = "none"

    private var fires: [Fire] = []
    private var ticker: Timer?
    private let healthStore = HKHealthStore()
    private var workoutSession: HKWorkoutSession?
    private var currentBrewId: Double = 0

    // MARK: - Lifecycle

    func activateSession() {
        if WCSession.isSupported() {
            let s = WCSession.default
            s.delegate = self
            s.activate()
            wlog.log("WCSession activate() called")
        }
        requestWorkoutAuthorization()
    }

    /// Ask once for permission to record a workout. We only need this to keep
    /// the app alive for background haptics — no health data is recorded beyond
    /// the bare session. Prompt appears the first time the watch app launches.
    private func requestWorkoutAuthorization() {
        guard HKHealthStore.isHealthDataAvailable() else { wlog.error("health data unavailable"); return }
        healthStore.requestAuthorization(toShare: [HKObjectType.workoutType()], read: []) { ok, err in
            wlog.log("workout auth ok=\(ok) err=\(String(describing: err), privacy: .public)")
        }
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
        // If steps have already started when the schedule arrives (mid-brew
        // hand-over), show the most recent one — not a stale "Brewing".
        self.currentLabel = self.fires.last(where: { $0.fired })?.label ?? "Brewing"
        self.lastEvent = "start \(self.fires.count)"
        wlog.log("startBrew name=\(recipeName, privacy: .public) fires=\(self.fires.count) brewId=\(brewId, privacy: .public)")
        startWorkoutSession()
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
        currentBrewId = 0
        lastEvent = "end"
        ticker?.invalidate()
        ticker = nil
        endWorkoutSession()
        wlog.log("endBrew")
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
        var didFire = false
        for i in fires.indices where !fires[i].fired && fires[i].at <= now {
            fires[i].fired = true
            currentLabel = fires[i].label
            buzz()
            didFire = true
        }
        if didFire { refreshLabels(now: now) }
        // Auto-wind-down a few seconds after the last step, so a forgotten brew
        // doesn't hold the workout session open indefinitely.
        if let last = fires.last?.at, now.timeIntervalSince(last) > 8 {
            endBrew()
        }
    }

    /// The wrist cue at a step boundary — a long, unmissable "act now" pattern.
    /// `.notification` is itself a ~0.5 s double-tap; we space repeats ≥0.55 s so
    /// each is felt as a distinct pulse and fire FIVE for a ~2.2 s buzz train.
    private func buzz() {
        let device = WKInterfaceDevice.current()
        let offsets: [Double] = [0, 0.55, 1.1, 1.65, 2.2]
        for t in offsets {
            DispatchQueue.main.asyncAfter(deadline: .now() + t) { device.play(.notification) }
        }
        wlog.log("BUZZ")
    }

    /// Manual isolation test (a button on the idle screen): play one device
    /// haptic right now. If THIS doesn't buzz, watch haptics are off/silenced.
    func testBuzz() {
        WKInterfaceDevice.current().play(.notification)
        lastEvent = "test-buzz"
        wlog.log("test buzz")
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

    // MARK: - Workout session (keeps haptics alive with the screen off / wrist down)

    private func startWorkoutSession() {
        guard workoutSession == nil, HKHealthStore.isHealthDataAvailable() else {
            workout = "unavailable"; wlog.error("workout unavailable / already running"); return
        }
        let config = HKWorkoutConfiguration()
        config.activityType = .other
        config.locationType = .indoor
        do {
            let session = try HKWorkoutSession(healthStore: healthStore, configuration: config)
            session.delegate = self
            session.startActivity(with: Date())
            workoutSession = session
            workout = "running"
            wlog.log("workout session started")
        } catch {
            workoutSession = nil
            workout = "failed"
            wlog.error("workout session start failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    private func endWorkoutSession() {
        workoutSession?.end()
        workoutSession = nil
        workout = "none"
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
            let ctx = session.receivedApplicationContext
            if !ctx.isEmpty { self.handle(ctx, via: "ctx@launch") }
        }
    }
    func sessionReachabilityDidChange(_ session: WCSession) {
        DispatchQueue.main.async { self.reachable = session.isReachable }
    }
    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) { handle(message, via: "msg") }
    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) { handle(applicationContext, via: "ctx") }
    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) { handle(userInfo, via: "userInfo") }
}

// MARK: - HKWorkoutSessionDelegate

extension BrewWatchModel: HKWorkoutSessionDelegate {
    func workoutSession(
        _ workoutSession: HKWorkoutSession,
        didChangeTo toState: HKWorkoutSessionState,
        from fromState: HKWorkoutSessionState,
        date: Date
    ) {
        wlog.log("workout state \(fromState.rawValue)->\(toState.rawValue)")
    }

    func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        DispatchQueue.main.async { [weak self] in
            self?.workout = "failed"
            if self?.workoutSession === workoutSession { self?.workoutSession = nil }
        }
        wlog.error("workout failed: \(error.localizedDescription, privacy: .public)")
    }
}
