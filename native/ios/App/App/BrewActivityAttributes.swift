import Foundation
import ActivityKit

/// Shared between the App target (starts/updates/ends the activity) and the
/// BTTSWidget target (renders it). ActivityKit is iOS 16.1+, so the type is
/// availability-gated; the App target (min iOS 15) only touches it behind the
/// same `#available` guards in LiveActivityPlugin.
@available(iOS 16.1, *)
struct BrewAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        /// What to do right now — "Pour to 180g", "Steep", "Drawdown", …
        var stepLabel: String
        var stepIndex: Int
        var stepCount: Int
        /// Target finish — drives the system-rendered countdown + progress bar.
        var endDate: Date
        var paused: Bool
    }

    var recipeName: String
    var coffeeName: String
    /// Brew start — the lower bound of the timer/progress interval.
    var startDate: Date
}
