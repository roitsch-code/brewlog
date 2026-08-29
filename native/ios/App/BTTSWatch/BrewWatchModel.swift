import Foundation
import WatchConnectivity
import WatchKit
import HealthKit
import os

private let wlog = Logger(subsystem: "com.roitsch.btts.watchkitapp", category: "brewwatch")

/**
 BTTS watch app — runs the brew timeline locally and buzzes the wrist at each
 step, even with the screen off / wrist down, while the iPhone is active.

 HAPTIC MECHANISM: watchOS will NOT fire `WKInterfaceDevice` haptics for a
 backgrounded app — the documented EXCEPTION is an app with an active
 `HKWorkoutSession` (exactly how interval/HIIT timers buzz the wrist with the
 screen off). So at brew start we begin a workout session; while it runs the app
 stays alive in the background and every step buzzes even with the wrist down. We
 end it the moment the brew finishes. (The app must still be OPENED at brew start
 — Apple won't let a closed watch app start a session or buzz on its own.)

 THE FIX (build 20): builds 8–19 started a BARE session (`startActivity` only, no
 builder). It buzzed at first but the owner reported the wrist going quiet after
 the 2nd pour — a bare session without an actively-collecting builder gets
 suspended by watchOS a minute or two into the background. The documented pattern
 that survives a whole workout is a session PLUS an `HKLiveWorkoutBuilder` with
 `beginCollection` (see startWorkoutSession). We collect heart rate / active
 energy only to keep the session "live"; we never finish the workout, so nothing
 is saved to Health.

 NOTE: build 17/18 tried a physical-therapy `WKExtendedRuntimeSession` +
 `notifyUser` instead, to dodge the HealthKit signing hassle — that mechanism
 did NOT buzz (rx reached the watch, but no haptic). HKWorkoutSession is the
 one that works; the live builder makes it last.

 DELIVERY (kept from build 18): the iPhone re-sends the whole schedule every ~3 s
 over sendMessage + transferUserInfo + updateApplicationContext, with a stable
 `brewId` the watch dedupes on — so a missed reachability window can't drop the
 brew. (Signed off build 19; the on-screen diagnostics + test-buzz button were
 removed afterwards — os.Logger lines stay, they're invisible and useful.)
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
    private let healthStore = HKHealthStore()
    private var workoutSession: HKWorkoutSession?
    /// The LIVE data-collecting builder attached to the session. A bare
    /// `startActivity` session (builds 8–19) starts, but without a builder
    /// actively collecting samples watchOS suspends the app after a minute or two
    /// in the background — the "no buzz after the 2nd pour" the owner reported.
    /// Apple's documented pattern for staying alive through a whole workout is a
    /// session PLUS an HKLiveWorkoutBuilder with beginCollection — the strong
    /// signal that this is a genuinely active workout. We never save it (no
    /// finishWorkout), so nothing lands in the Health app.
    private var workoutBuilder: HKLiveWorkoutBuilder?
    private var currentBrewId: Double = 0
    /// The last brewId we finished (auto-wind-down or explicit end). A stray late
    /// re-send from the phone with this id must NOT spin the workout session back
    /// up — that start/end churn is the battery drain we're guarding against.
    private var lastCompletedBrewId: Double = 0

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

    /// Ask once for permission to run a workout. We share the workout type and
    /// READ heart rate + active energy so the live builder actually collects
    /// samples — the collection is what keeps watchOS treating this as an active
    /// workout (and thus keeps the app alive for background haptics). Nothing is
    /// stored: we never finish the workout. Prompt appears on first launch.
    private func requestWorkoutAuthorization() {
        guard HKHealthStore.isHealthDataAvailable() else { wlog.error("health data unavailable"); return }
        var read = Set<HKObjectType>()
        if let hr = HKQuantityType.quantityType(forIdentifier: .heartRate) { read.insert(hr) }
        if let ae = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned) { read.insert(ae) }
        healthStore.requestAuthorization(toShare: [HKObjectType.workoutType()], read: read) { ok, err in
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
        // Already-finished brew: a late re-send (the phone's 3-s loop) must not
        // restart the workout session after our wind-down. Without this, the watch
        // start/end-thrashes the HKWorkoutSession every 3 s and drains the battery.
        if brewId != 0 && brewId == lastCompletedBrewId {
            wlog.log("completed brew re-send ignored brewId=\(brewId, privacy: .public)")
            return
        }
        let now = Date()
        let sorted = incoming.sorted { $0.at < $1.at }
        // If EVERY step is already in the past (a late hand-over / a re-send after
        // the brew is effectively over), don't open a workout session at all —
        // there's nothing left to buzz. Matches the tick() 8 s wind-down threshold.
        if let last = sorted.last?.at, now.timeIntervalSince(last) > 8 {
            wlog.log("start ignored — all steps already past brewId=\(brewId, privacy: .public)")
            lastCompletedBrewId = brewId
            return
        }
        currentBrewId = brewId
        self.fires = sorted.map { var f = $0; if $0.at <= now { f.fired = true }; return f }
        self.recipeName = recipeName
        self.isBrewing = true
        // If steps have already started when the schedule arrives (mid-brew
        // hand-over), show the most recent one — not a stale "Brewing".
        self.currentLabel = self.fires.last(where: { $0.fired })?.label ?? "Brewing"
        wlog.log("startBrew name=\(recipeName, privacy: .public) fires=\(self.fires.count) brewId=\(brewId, privacy: .public)")
        startWorkoutSession()
        startTicker()
        refreshLabels(now: now)
        WKInterfaceDevice.current().play(.start) // brew handed over to the wrist
    }

    private func endBrew() {
        // Remember the brew we just finished so a stray re-send can't restart it.
        if currentBrewId != 0 { lastCompletedBrewId = currentBrewId }
        isBrewing = false
        currentLabel = ""
        nextLabel = nil
        nextFireAt = nil
        fires = []
        currentBrewId = 0
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
        // A session may still be running when a NEW brew replaces a winding-down
        // one — that's fine, keep using it (not an error).
        guard workoutSession == nil else { return }
        guard HKHealthStore.isHealthDataAvailable() else {
            wlog.error("workout unavailable — health data")
            return
        }
        let config = HKWorkoutConfiguration()
        config.activityType = .other
        config.locationType = .indoor
        do {
            let session = try HKWorkoutSession(healthStore: healthStore, configuration: config)
            // Attach a LIVE builder + data source and begin collecting. The bare
            // startActivity of builds 8–19 kept haptics alive only briefly in the
            // background; an actively-collecting builder is what makes watchOS
            // sustain the session for the whole brew.
            let builder = session.associatedWorkoutBuilder()
            builder.dataSource = HKLiveWorkoutDataSource(healthStore: healthStore, workoutConfiguration: config)
            session.delegate = self
            builder.delegate = self
            let start = Date()
            session.startActivity(with: start)
            builder.beginCollection(withStart: start) { ok, err in
                wlog.log("workout beginCollection ok=\(ok) err=\(String(describing: err), privacy: .public)")
            }
            workoutSession = session
            workoutBuilder = builder
            wlog.log("workout session started (live builder)")
        } catch {
            workoutSession = nil
            workoutBuilder = nil
            wlog.error("workout session start failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    private func endWorkoutSession() {
        // Stop collecting and end the session. We deliberately do NOT finish the
        // workout, so nothing is written to the Health app — the builder's data
        // is discarded when it deallocates.
        workoutBuilder?.endCollection(withEnd: Date()) { _, _ in }
        workoutBuilder = nil
        workoutSession?.end()
        workoutSession = nil
    }

    // MARK: - Payload parsing

    fileprivate func handle(_ payload: [String: Any], via source: String) {
        DispatchQueue.main.async {
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
            wlog.log("activationDidComplete state=\(state.rawValue) reachable=\(session.isReachable)")
            let ctx = session.receivedApplicationContext
            if !ctx.isEmpty { self.handle(ctx, via: "ctx@launch") }
        }
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
            if self?.workoutSession === workoutSession { self?.workoutSession = nil }
        }
        wlog.error("workout failed: \(error.localizedDescription, privacy: .public)")
    }
}

// MARK: - HKLiveWorkoutBuilderDelegate

// We don't use the collected samples — they exist only so watchOS treats the
// session as an active workout and keeps the app alive for background haptics.
extension BrewWatchModel: HKLiveWorkoutBuilderDelegate {
    func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>) {}
    func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}
}
