import Foundation
import Capacitor
import ActivityKit

/**
 LiveActivity — phone-side bridge to a brew Live Activity (lock screen + Dynamic
 Island + watch Smart Stack). Started with a PUSH TOKEN so the Hetzner server can
 push each step's update over APNs — that's what makes it advance + re-count-down
 while the phone is LOCKED (an app extension/suspended app can't update it itself).

 The token arrives asynchronously via `pushTokenUpdates`; we forward it to JS
 (`liveActivityToken` event), which registers it + the step schedule with the
 server. `update` stays for a foreground instant-update; `end` tears it down.

 App-local plugin → registered in MainViewController. ActivityKit gated to 16.2+.
 */
@objc(LiveActivityPlugin)
public class LiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiveActivityPlugin"
    public let jsName = "LiveActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise),
    ]

    @objc func start(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(["started": false]); return }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            call.resolve(["started": false, "reason": "disabled"]); return
        }
        for activity in Activity<BrewAttributes>.activities {
            Task { await activity.end(nil, dismissalPolicy: .immediate) }
        }
        let attributes = BrewAttributes(
            recipeName: call.getString("recipeName") ?? "Brew",
            coffeeName: call.getString("coffeeName") ?? ""
        )
        do {
            let activity = try Activity.request(
                attributes: attributes,
                content: .init(state: contentState(call), staleDate: nil),
                pushType: .token
            )
            observeToken(activity)
            call.resolve(["started": true])
        } catch {
            call.resolve(["started": false, "error": error.localizedDescription])
        }
    }

    @available(iOS 16.2, *)
    private func observeToken(_ activity: Activity<BrewAttributes>) {
        Task {
            for await tokenData in activity.pushTokenUpdates {
                let hex = tokenData.map { String(format: "%02x", $0) }.joined()
                self.notifyListeners("liveActivityToken", data: ["token": hex])
            }
        }
    }

    @objc func update(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        let state = contentState(call)
        Task {
            for activity in Activity<BrewAttributes>.activities {
                await activity.update(.init(state: state, staleDate: nil))
            }
            call.resolve()
        }
    }

    @objc func end(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        Task {
            for activity in Activity<BrewAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            call.resolve()
        }
    }

    @available(iOS 16.1, *)
    private func contentState(_ call: CAPPluginCall) -> BrewAttributes.ContentState {
        let now = Date().timeIntervalSince1970
        return BrewAttributes.ContentState(
            currentStep: call.getString("currentStep") ?? "Brewing",
            nextStep: call.getString("nextStep") ?? "",
            nextStepEpoch: call.getDouble("nextStepEpoch") ?? (now + 60),
            stepStartEpoch: call.getDouble("stepStartEpoch") ?? now,
            stepIndex: call.getInt("stepIndex") ?? 0,
            stepCount: call.getInt("stepCount") ?? 0
        )
    }
}
