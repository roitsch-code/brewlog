import ActivityKit
import WidgetKit
import SwiftUI

// Fruity Live Activity palette (matches the widgets — no beige).
private let laInk = Color(red: 0.227, green: 0.133, blue: 0.188)   // deep plum
private let laTint = Color(red: 0.969, green: 0.706, blue: 0.580)  // peach background tint

// Step times arrive as epoch seconds; build the timer/progress range from them.
@available(iOS 16.2, *)
private func stepRange(_ s: BrewAttributes.ContentState) -> ClosedRange<Date> {
    let start = Date(timeIntervalSince1970: s.stepStartEpoch)
    var end = Date(timeIntervalSince1970: s.nextStepEpoch)
    if end <= start { end = start.addingTimeInterval(1) }
    return start...end
}

@available(iOS 16.2, *)
private func countdown(_ s: BrewAttributes.ContentState) -> some View {
    // System-rendered countdown to the NEXT step (never the total brew).
    Text(timerInterval: stepRange(s), countsDown: true).monospacedDigit()
}

@available(iOS 18.0, *)
struct BrewLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: BrewAttributes.self) { context in
            BrewActivityContent(context: context)
        } dynamicIsland: { context in
            // DYNAMIC ISLAND — "Next: <step>  0:26", tight (no edge-spreading gap).
            DynamicIsland {
                DynamicIslandExpandedRegion(.center) {
                    HStack(spacing: 10) {
                        Text("Next: \(context.state.nextStep)")
                            .font(.headline)
                            .lineLimit(1)
                        countdown(context.state)
                            .font(.system(.headline, design: .rounded).weight(.bold))
                            .layoutPriority(1)
                    }
                    .padding(.horizontal, 4)
                }
            } compactLeading: {
                Text("Next: \(context.state.nextStep)")
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .frame(maxWidth: 100)
            } compactTrailing: {
                countdown(context.state).frame(minWidth: 36)
            } minimal: {
                countdown(context.state)
            }
        }
        .supplementalActivityFamilies([.small]) // watch Smart Stack
    }
}

/// Picks the layout per family: `.small` = watch Smart Stack (NEXT step),
/// `.medium` = iOS lock screen (NOW step).
@available(iOS 18.0, *)
struct BrewActivityContent: View {
    @Environment(\.activityFamily) private var family
    let context: ActivityViewContext<BrewAttributes>

    var body: some View {
        switch family {
        case .small:
            BrewWatchSmartStackView(context: context)
        default:
            BrewLockScreenView(context: context)
                .activityBackgroundTint(laTint)
                .activitySystemActionForegroundColor(laInk)
        }
    }
}

/// Watch Smart Stack — three stacked lines so the step can NEVER be squeezed out
/// by the countdown's reserved width: "BTTS", then "Next: <step>", then the timer.
@available(iOS 18.0, *)
struct BrewWatchSmartStackView: View {
    let context: ActivityViewContext<BrewAttributes>

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text("BTTS")
                .font(.system(size: 14, weight: .bold, design: .serif))
                .opacity(0.85)
            Text("Next: \(context.state.nextStep)")
                .font(.system(size: 15, weight: .semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            countdown(context.state)
                .font(.system(size: 22, weight: .bold, design: .rounded))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// iOS lock screen — the step happening NOW on its OWN line (so it always shows),
/// then a progress bar + countdown row underneath.
@available(iOS 18.0, *)
struct BrewLockScreenView: View {
    let context: ActivityViewContext<BrewAttributes>

    private var nowStep: String {
        context.state.currentStep.isEmpty ? "Brewing" : context.state.currentStep
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(context.attributes.recipeName.uppercased())
                .font(.system(size: 11, weight: .bold))
                .tracking(0.8)
                .foregroundColor(laInk.opacity(0.6))
                .lineLimit(1)

            Text("NOW")
                .font(.system(size: 10, weight: .semibold))
                .tracking(1.2)
                .foregroundColor(laInk.opacity(0.5))

            // The step — its own full-width line, big serif, can't be clipped.
            Text(nowStep)
                .font(.system(size: 24, weight: .semibold, design: .serif))
                .foregroundColor(laInk)
                .lineLimit(1)
                .minimumScaleFactor(0.5)
                .frame(maxWidth: .infinity, alignment: .leading)

            HStack(spacing: 12) {
                ProgressView(timerInterval: stepRange(context.state), countsDown: false)
                    .tint(laInk)
                    .labelsHidden()
                    .frame(maxWidth: .infinity)
                countdown(context.state)
                    .font(.system(size: 22, weight: .bold, design: .rounded))
                    .foregroundColor(laInk)
                    .frame(minWidth: 54, alignment: .trailing)
            }
        }
        .padding(16)
    }
}
