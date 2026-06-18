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
            // DYNAMIC ISLAND ("action bar") — the NEXT step + countdown, no cup.
            DynamicIsland {
                // Expanded (long-press): one clean row — "Next: <step>"  …  0:13.
                DynamicIslandExpandedRegion(.center) {
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text("Next: \(context.state.nextStep)")
                            .font(.system(size: 16, weight: .semibold))
                            .lineLimit(1)
                        Spacer(minLength: 8)
                        countdown(context.state)
                            .font(.system(size: 16, weight: .bold, design: .rounded))
                            .layoutPriority(1)
                    }
                    .padding(.horizontal, 6)
                    .frame(maxWidth: .infinity)
                }
            } compactLeading: {
                // Step name, capped so the pill stays small; a gap off the notch.
                Text(context.state.nextStep)
                    .font(.system(size: 13, weight: .medium))
                    .lineLimit(1)
                    .frame(maxWidth: 72)
                    .padding(.leading, 4)
            } compactTrailing: {
                countdown(context.state)
                    .font(.system(size: 13, weight: .semibold))
                    .frame(minWidth: 38)
                    .padding(.trailing, 2)
            } minimal: {
                countdown(context.state).font(.system(size: 12, weight: .semibold))
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

/// Watch Smart Stack — "BTTS" header, then the NEXT step + countdown on one
/// full-width row (system dark card → light text).
@available(iOS 18.0, *)
struct BrewWatchSmartStackView: View {
    let context: ActivityViewContext<BrewAttributes>

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("BTTS")
                .font(.system(size: 16, weight: .bold, design: .serif))

            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("Next: \(context.state.nextStep)")
                    .font(.system(size: 15, weight: .medium))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Spacer(minLength: 6)
                countdown(context.state)
                    .font(.system(size: 18, weight: .bold, design: .rounded))
                    .layoutPriority(1)
            }
            .frame(maxWidth: .infinity)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// iOS lock screen — the step happening NOW (with cumulative total) + a countdown
/// to the next step on the same row, then a progress bar over the current step.
@available(iOS 18.0, *)
struct BrewLockScreenView: View {
    let context: ActivityViewContext<BrewAttributes>

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(context.attributes.recipeName.uppercased())
                .font(.system(size: 11, weight: .bold))
                .tracking(0.8)
                .foregroundColor(laInk.opacity(0.6))
                .lineLimit(1)

            Text("NOW")
                .font(.system(size: 10, weight: .semibold))
                .tracking(1.2)
                .foregroundColor(laInk.opacity(0.5))

            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text(context.state.currentStep)
                    .font(.system(size: 22, weight: .semibold, design: .serif))
                    .foregroundColor(laInk)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                Spacer(minLength: 8)
                countdown(context.state)
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .foregroundColor(laInk)
                    .layoutPriority(1)
            }
            .frame(maxWidth: .infinity)

            ProgressView(timerInterval: stepRange(context.state), countsDown: false)
                .tint(laInk)
                .labelsHidden()
        }
        .padding(16)
    }
}
