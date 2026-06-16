import Foundation
import HealthKit
import UserNotifications
import WatchConnectivity
import WatchKit

/**
 The brain of the BTTS watch app.

 The iPhone hands us the whole brew schedule once at brew start (absolute
 epoch-ms STEP fire times). We hold it locally so a phone↔watch hiccup mid-brew
 can't drop a cue.

 HOW THE WRIST CUES FIRE — the load-bearing decision.
 watchOS aggressively suspends a backgrounded app when the wrist drops. The
 earlier approach (a repeating `Timer` that called `WKInterfaceDevice.play()`)
 fought that and lost: wrist-down the timer stalled, then on wrist-raise it
 "caught up" and dumped every missed buzz at once — useless. So cues are now
 delivered as **scheduled local notifications** (`UNUserNotificationCenter`),
 which the OS fires at the exact time with a haptic regardless of app state —
 the same mechanism alarm/timer apps rely on. For each step we schedule a
 "Get ready" pre-cue a few seconds before, plus a cue AT the step.

 The `HKWorkoutSession` is kept only to keep the app alive so the on-screen
 current/next labels stay live when you raise your wrist mid-brew — it no longer
 carries the haptics. The ticker updates labels only; it never buzzes, so it
 can't dump a backlog.
 */
final class BrewWatchModel: NSObject, ObservableObject {
    static let shared = BrewWatchModel()

    /// Seconds before a step to fire the "get ready" pre-cue.
    private static let readyLead: TimeInterval = 5

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
        UNUserNotificationCenter.current().delegate = self
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
        requestWorkoutAuthorization()
    }

    /// Ask once for permission to record a workout. We only need this to keep
    /// the app alive (live labels) — no health data is recorded beyond the bare
    /// session. Prompt appears the first time the watch app launches.
    private func requestWorkoutAuthorization() {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        healthStore.requestAuthorization(toShare: [HKObjectType.workoutType()], read: []) { _, _ in }
    }

    // MARK: - Schedule control (always called on the main thread)

    private func startBrew(recipeName: String, fires incoming: [Fire]) {
        let now = Date()
        let sorted = incoming.sorted { $0.at < $1.at }
        // Keep the whole schedule for the on-screen labels; past fires can't alert.
        self.fires = sorted.map { var f = $0; if $0.at <= now { f.fired = true }; return f }
        self.recipeName = recipeName
        self.isBrewing = true
        self.currentLabel = "Brewing"
        scheduleNotifications(for: sorted, now: now) // the reliable wrist-down cues
        startWorkoutSession() // keeps the live screen alive on wrist-raise
        startTicker() // on-screen labels only — NO haptics
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
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
        endWorkoutSession()
    }

    // MARK: - Local notifications (the actual wrist cues)

    /// Schedule a "Get ready" pre-cue (`readyLead` s before) + a cue AT each
    /// step. The OS fires these with a haptic at the exact time even when the
    /// app is suspended / the wrist is down — no catch-up, no backlog.
    private func scheduleNotifications(for steps: [Fire], now: Date) {
        let center = UNUserNotificationCenter.current()
        center.removeAllPendingNotificationRequests()
        var requests: [UNNotificationRequest] = []
        for (i, step) in steps.enumerated() {
            let readyAt = step.at.addingTimeInterval(-Self.readyLead)
            if readyAt.timeIntervalSince(now) > 1.5 {
                requests.append(
                    makeNotification(
                        id: "btts-ready-\(i)", title: "Get ready", body: step.label, fireAt: readyAt,
                        now: now))
            }
            if step.at.timeIntervalSince(now) > 1.0 {
                requests.append(
                    makeNotification(
                        id: "btts-now-\(i)", title: step.label, body: "Now", fireAt: step.at, now: now))
            }
        }
        for r in requests { center.add(r) }
    }

    private func makeNotification(
        id: String, title: String, body: String, fireAt: Date, now: Date
    ) -> UNNotificationRequest {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        if #available(watchOS 9.0, *) { content.interruptionLevel = .timeSensitive }
        let interval = max(1, fireAt.timeIntervalSince(now))
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: interval, repeats: false)
        return UNNotificationRequest(identifier: id, content: content, trigger: trigger)
    }

    // MARK: - On-screen label ticker (no haptics)

    private func startTicker() {
        ticker?.invalidate()
        let t = Timer(timeInterval: 0.5, repeats: true) { [weak self] _ in
            self?.tick()
        }
        RunLoop.main.add(t, forMode: .common)
        ticker = t
    }

    private func tick() {
        guard isBrewing else { return }
        let now = Date()
        var advanced = false
        for i in fires.indices where !fires[i].fired && fires[i].at <= now {
            fires[i].fired = true
            currentLabel = fires[i].label
            advanced = true
        }
        if advanced { refreshLabels(now: now) }
        // Auto-wind-down a few seconds after the last step, so a forgotten brew
        // doesn't hold the workout session open indefinitely.
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

    // MARK: - Workout session (keeps the app alive for the live labels)

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
            workoutSession = nil // labels just won't update in the background; cues still fire
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

// MARK: - UNUserNotificationCenterDelegate (so cues alert + haptic in the foreground too)

extension BrewWatchModel: UNUserNotificationCenterDelegate {
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        if #available(watchOS 9.0, *) {
            completionHandler([.banner, .sound, .list])
        } else {
            completionHandler([.alert, .sound])
        }
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
