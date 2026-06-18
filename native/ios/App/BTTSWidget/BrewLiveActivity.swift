import ActivityKit
import WidgetKit
import SwiftUI

// Fruity Live Activity palette (matches the widgets — no beige).
private let laInk = Color(red: 0.227, green: 0.133, blue: 0.188)   // deep plum
private let laTint = Color(red: 0.969, green: 0.706, blue: 0.580)  // peach background tint

// Gated to iOS 18: the watch Smart Stack family (supplementalActivityFamilies /
// @Environment(\.activityFamily)) is iOS 18 / watchOS 11+. Single-user app on the
// latest OS. The step strings arrive pre-formatted from the web: the "now"
// surfaces get "<step> → <total>g", the "next" surfaces get just the step name.
@available(iOS 18.0, *)
struct BrewLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: BrewAttributes.self) { context in
            BrewActivityContent(context: context)
        } dynamicIsland: { context in
            // DYNAMIC ISLAND ("action bar") — the NEXT step + countdown, no cup.
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text("NEXT")
                        .font(.system(size: 11, weight: .bold)).tracking(1)
                        .foregroundStyle(.secondary)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    countdown(context).frame(width: 56)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.state.nextStep)
                        .font(.headline)
                        .lineLimit(1)
                }
            } compactLeading: {
                // Show the step (the owner's fix — it used to say only "Next").
                Text(context.state.nextStep)
                    .lineLimit(1)
            } compactTrailing: {
                countdown(context).frame(minWidth: 40)
            } minimal: {
                countdown(context)
            }
        }
        .supplementalActivityFamilies([.small]) // watch Smart Stack
    }

    // System-rendered countdown to the NEXT step (never total brew time).
    private func countdown(_ context: ActivityViewContext<BrewAttributes>) -> some View {
        Text(timerInterval: context.state.stepStartDate...context.state.nextStepDate, countsDown: true)
            .monospacedDigit()
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

/// Watch Smart Stack ("activity widget") — BTTS + the NEXT step name + countdown,
/// on one aligned row. Rendered on the system dark card, so light text.
@available(iOS 18.0, *)
struct BrewWatchSmartStackView: View {
    let context: ActivityViewContext<BrewAttributes>

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("BTTS")
                .font(.system(size: 16, weight: .bold, design: .serif))
            HStack(alignment: .firstTextBaseline) {
                Text("Next: \(context.state.nextStep)")
                    .font(.system(size: 15, weight: .medium))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Spacer(minLength: 6)
                Text(timerInterval: context.state.stepStartDate...context.state.nextStepDate, countsDown: true)
                    .font(.system(size: 18, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .layoutPriority(1)
            }
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

            HStack(alignment: .firstTextBaseline) {
                Text(context.state.currentStep)
                    .font(.system(size: 20, weight: .semibold, design: .serif))
                    .foregroundColor(laInk)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                Spacer(minLength: 10)
                Text(timerInterval: context.state.stepStartDate...context.state.nextStepDate, countsDown: true)
                    .font(.system(size: 26, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundColor(laInk)
                    .layoutPriority(1)
            }

            ProgressView(timerInterval: context.state.stepStartDate...context.state.nextStepDate, countsDown: false)
                .tint(laInk)
                .labelsHidden()
        }
        .padding(16)
    }
}
