import Foundation
import ActivityKit

/// Shared between the App target (starts/updates/ends the activity) and the
/// BTTSWidget target (renders it). ActivityKit is iOS 16.1+.
///
/// Times are epoch SECONDS (Double), not Date — so APNs push payloads carry plain
/// numbers and decode unambiguously into the ContentState (Date's Codable
/// encoding over push is fiddly). The views convert with
/// `Date(timeIntervalSince1970:)`.
///
/// The countdown is always to the NEXT step (`nextStepEpoch`), never the total
/// brew. "Now" surfaces show `currentStep` (formatted "<step> → <total>g"); "next"
/// surfaces show `nextStep` (just the name). Progress fills over the current step
/// (`stepStartEpoch`…`nextStepEpoch`).
@available(iOS 16.1, *)
struct BrewAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var currentStep: String
        var nextStep: String
        var nextStepEpoch: Double
        var stepStartEpoch: Double
        var stepIndex: Int
        var stepCount: Int
    }

    var recipeName: String
    var coffeeName: String
}
