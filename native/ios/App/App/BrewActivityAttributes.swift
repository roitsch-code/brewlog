import Foundation
import ActivityKit

/// Shared between the App target (starts/updates/ends the activity) and the
/// BTTSWidget target (renders it). ActivityKit is iOS 16.1+, so the type is
/// availability-gated; the App target (min iOS 15) only touches it behind the
/// same `#available` guards in LiveActivityPlugin.
///
/// The countdown is always to the NEXT step (`nextStepDate`), never the total
/// brew. The "now" surfaces (lock screen, watch app) show `currentStep`; the
/// "next" surfaces (Dynamic Island, watch Smart Stack) show `nextStep`. The
/// progress bar fills over the current step (`stepStartDate`…`nextStepDate`).
@available(iOS 16.1, *)
struct BrewAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var currentStep: String
        var nextStep: String
        /// When the next step fires — the countdown target.
        var nextStepDate: Date
        /// When the current step started — lower bound of the progress bar.
        var stepStartDate: Date
        var stepIndex: Int
        var stepCount: Int
    }

    var recipeName: String
    var coffeeName: String
}
