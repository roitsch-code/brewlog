import ActivityKit
import WidgetKit
import SwiftUI

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

@available(iOS 18.0, *)
struct BrewLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: BrewAttributes.self) { context in
            BrewActivityContent(context: context)
        } dynamicIsland: { context in
            // "Action bar": the NEXT step + countdown, no cup. Compact stays small.
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text("NEXT").font(.system(size: 11, weight: .bold)).tracking(1)
                        .foregroundStyle(.secondary)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(timerInterval: stepRange(context.state), countsDown: true)
                        .monospacedDigit().multilineTextAlignment(.trailing).frame(width: 52)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.state.nextStep).font(.headline).lineLimit(1)
                }
            } compactLeading: {
                Text(context.state.nextStep)
                    .lineLimit(1)
                    .frame(maxWidth: 64)
                    .padding(.trailing, 2)
            } compactTrailing: {
                Text(timerInterval: stepRange(context.state), countsDown: true)
                    .monospacedDigit().frame(width: 38)
            } minimal: {
                Text(timerInterval: stepRange(context.state), countsDown: true).monospacedDigit()
            }
        }
        .supplementalActivityFamilies([.small])
    }
}

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

/// Watch Smart Stack — BTTS + NEXT step + countdown, on the system dark card.
@available(iOS 18.0, *)
struct BrewWatchSmartStackView: View {
    let context: ActivityViewContext<BrewAttributes>

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text("BTTS").font(.system(size: 15, weight: .bold, design: .serif))
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                VStack(alignment: .leading, spacing: 1) {
                    Text("NEXT").font(.system(size: 9, weight: .semibold)).tracking(0.8)
                        .foregroundStyle(.secondary)
                    Text(context.state.nextStep)
                        .font(.system(size: 15, weight: .medium)).lineLimit(1).minimumScaleFactor(0.7)
                }
                Spacer(minLength: 4)
                Text(timerInterval: stepRange(context.state), countsDown: true)
                    .font(.system(size: 17, weight: .bold, design: .rounded))
                    .monospacedDigit().layoutPriority(1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// iOS lock screen — the step happening NOW (with cumulative total) + countdown
/// to the next step, then a progress bar over the current step.
@available(iOS 18.0, *)
struct BrewLockScreenView: View {
    let context: ActivityViewContext<BrewAttributes>

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(context.attributes.recipeName.uppercased())
                .font(.system(size: 11, weight: .bold)).tracking(0.8)
                .foregroundColor(laInk.opacity(0.6)).lineLimit(1)

            Text("NOW")
                .font(.system(size: 10, weight: .semibold)).tracking(1.2)
                .foregroundColor(laInk.opacity(0.5))

            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text(context.state.currentStep)
                    .font(.system(size: 22, weight: .semibold, design: .serif))
                    .foregroundColor(laInk).lineLimit(1).minimumScaleFactor(0.6)
                Spacer(minLength: 8)
                Text(timerInterval: stepRange(context.state), countsDown: true)
                    .font(.system(size: 26, weight: .bold, design: .rounded))
                    .monospacedDigit().foregroundColor(laInk).layoutPriority(1)
            }

            ProgressView(timerInterval: stepRange(context.state), countsDown: false)
                .tint(laInk).labelsHidden()
        }
        .padding(16)
    }
}
