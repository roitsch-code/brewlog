import Foundation
import WatchConnectivity
import WatchKit
import HealthKit

/**
 The brain of the BTTS watch app.

 The iPhone hands us the whole brew schedule once at brew start (absolute
 epoch-ms fire times). We run the timeline locally and play a wrist haptic at
 each step — so the wrist buzzes regardless of what the iPhone screen is doing
 (the decisive case: phone on the counter, screen on, where iOS will not mirror
 notifications to the watch).

 Running the schedule on the watch (rather than having the phone message us per
 step) makes it resilient: a phone↔watch link hiccup mid-brew can't drop a buzz,
 because we already hold every fire time.

 Buzzing with the WRIST DOWN / screen off: watchOS will NOT fire
 `WKInterfaceDevice` haptics for a backgrounded app — the documented EXCEPTION
 is an app with an active `HKWorkoutSession` (this is exactly how interval/HIIT
 timers buzz the wrist with the screen off). So at brew start we begin a
 lightweight workout session; while it runs the app stays alive in the
 background and every step buzzes even with the wrist down. We end it the moment
 the brew finishes. (The app must still be OPENED at brew start — Apple won't
 let a closed watch app start a session or buzz on its own.)
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

    // MARK: - Lifecycle

    func activateSession() {
        if WCSession.isSupported() {
            let s = WCSession.default
            s.delegate = self
            s.activate()
        }
        requestWorkoutAuthorization()
    }

    /// Ask once for permission to record a workout. We only need this to keep
    /// the app alive for background haptics — no health data is recorded beyond
    /// the bare session. Prompt appears the first time the watch app launches.
    private func requestWorkoutAuthorization() {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        healthStore.requestAuthorization(toShare: [HKObjectType.workoutType()], read: []) { _, _ in }
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
        ticker?.invalidate()
        ticker = nil
        endWorkoutSession()
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
        // brew doesn't hold the workout session open indefinitely.
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

    /// The wrist cue at a step boundary — a long, unmissable "act now" pattern.
    /// Earlier the taps were 0.3 s apart and watchOS COALESCED them, so only the
    /// first ("big buzz") landed. `.notification` is itself a ~0.5 s double-tap,
    /// so we space the repeats ≥0.55 s — far enough that each is felt as a
    /// distinct pulse — and fire FIVE for a sustained ~2.2 s buzz train.
    /// (Built-in haptics have a fixed amplitude; the user's "Prominent Haptic" +
    /// Haptic Strength settings are the raw-strength lever.)
    private func buzz() {
        let device = WKInterfaceDevice.current()
        let offsets: [Double] = [0, 0.55, 1.1, 1.65, 2.2]
        for t in offsets {
            DispatchQueue.main.asyncAfter(deadline: .now() + t) { device.play(.notification) }
        }
    }

    // MARK: - Workout session (keeps haptics alive with the screen off / wrist down)

    private func startWorkoutSession() {
        guard workoutSession == nil, HKHealthStore.isHealthDataAvailable() else { return }
        let config = HKWorkoutConfiguration()
        config.activityType = .other
        config.locationType = .indoor
        do {
            let session = try HKWorkoutSession(healthStore: healthStore, configuration: config)
            session.delegate = self
            session.startActivity(with: Date())
            workoutSession = session
        } catch {
            // No workout session → still buzzes while the app is in the
            // foreground (the ticker keeps running); just not with the wrist down.
            workoutSession = nil
        }
    }

    private func endWorkoutSession() {
        workoutSession?.end()
        workoutSession = nil
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

// MARK: - HKWorkoutSessionDelegate

extension BrewWatchModel: HKWorkoutSessionDelegate {
    func workoutSession(
        _ workoutSession: HKWorkoutSession,
        didChangeTo toState: HKWorkoutSessionState,
        from fromState: HKWorkoutSessionState,
        date: Date
    ) {}

    func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        DispatchQueue.main.async { [weak self] in
            if self?.workoutSession === workoutSession { self?.workoutSession = nil }
        }
    }
}
