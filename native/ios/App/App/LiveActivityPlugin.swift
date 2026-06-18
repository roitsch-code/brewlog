import Foundation
import Capacitor
import ActivityKit

/**
 LiveActivity — phone-side bridge from the WKWebView (JS) to a brew Live Activity
 (lock screen + Dynamic Island). The web layer (src/lib/native/liveActivity.ts)
 calls start at brew start, update when the step changes, end on reset/finish.

 App-local plugin → registered manually in MainViewController.capacitorDidLoad
 (same mechanism as BrewWatch / WidgetBridge). All ActivityKit calls are gated
 to iOS 16.2+ so the iOS-15-min App target still builds; on older iOS every
 method is a graceful no-op.
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
        // Never stack — end any leftovers first.
        for activity in Activity<BrewAttributes>.activities {
            Task { await activity.end(nil, dismissalPolicy: .immediate) }
        }
        let attributes = BrewAttributes(
            recipeName: call.getString("recipeName") ?? "Brew",
            coffeeName: call.getString("coffeeName") ?? ""
        )
        do {
            _ = try Activity.request(
                attributes: attributes,
                content: .init(state: contentState(call), staleDate: nil)
            )
            call.resolve(["started": true])
        } catch {
            call.resolve(["started": false, "error": error.localizedDescription])
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
        BrewAttributes.ContentState(
            currentStep: call.getString("currentStep") ?? "Brewing",
            nextStep: call.getString("nextStep") ?? "",
            nextStepDate: date(call, "nextStepMs") ?? Date().addingTimeInterval(60),
            stepStartDate: date(call, "stepStartMs") ?? Date(),
            stepIndex: call.getInt("stepIndex") ?? 0,
            stepCount: call.getInt("stepCount") ?? 0
        )
    }

    private func date(_ call: CAPPluginCall, _ key: String) -> Date? {
        guard let ms = call.getDouble(key) else { return nil }
        return Date(timeIntervalSince1970: ms / 1000)
    }
}
