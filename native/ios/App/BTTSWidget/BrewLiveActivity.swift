import ActivityKit
import WidgetKit
import SwiftUI

// Fruity Live Activity palette (matches the widgets — no beige).
private let laInk = Color(red: 0.227, green: 0.133, blue: 0.188)   // deep plum
private let laTint = Color(red: 0.969, green: 0.706, blue: 0.580)  // peach background tint

// Gated to iOS 18: the watch Smart Stack family (supplementalActivityFamilies /
// @Environment(\.activityFamily)) is iOS 18 / watchOS 11+. Single-user app on the
// latest OS, so requiring 18 for the Live Activity is fine.
@available(iOS 18.0, *)
struct BrewLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: BrewAttributes.self) { context in
            BrewActivityContent(context: context)
        } dynamicIsland: { context in
            // DYNAMIC ISLAND ("action bar") — the NEXT step + countdown. On black,
            // so light text. No coffee-cup glyph.
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text("NEXT")
                        .font(.system(size: 11, weight: .bold)).tracking(1)
                        .foregroundStyle(.secondary)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(timerInterval: context.state.stepStartDate...context.state.nextStepDate, countsDown: true)
                        .monospacedDigit()
                        .multilineTextAlignment(.trailing)
                        .frame(width: 56)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.state.nextStep)
                        .font(.headline)
                        .lineLimit(1)
                }
            } compactLeading: {
                Text("Next").font(.caption2)
            } compactTrailing: {
                Text(timerInterval: context.state.stepStartDate...context.state.nextStepDate, countsDown: true)
                    .monospacedDigit()
                    .frame(width: 44)
            } minimal: {
                Text(timerInterval: context.state.stepStartDate...context.state.nextStepDate, countsDown: true)
                    .monospacedDigit()
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

/// Watch Smart Stack ("activity widget") — the NEXT step + countdown. Rendered on
/// the system's dark Smart Stack card, so light text; BTTS wordmark on top.
@available(iOS 18.0, *)
struct BrewWatchSmartStackView: View {
    let context: ActivityViewContext<BrewAttributes>

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("BTTS")
                .font(.system(size: 16, weight: .bold, design: .serif))
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 1) {
                    Text("NEXT")
                        .font(.system(size: 9, weight: .semibold)).tracking(0.8)
                        .foregroundStyle(.secondary)
                    Text(context.state.nextStep)
                        .font(.system(size: 15, weight: .medium))
                        .lineLimit(1).minimumScaleFactor(0.7)
                }
                Spacer(minLength: 6)
                Text(timerInterval: context.state.stepStartDate...context.state.nextStepDate, countsDown: true)
                    .font(.system(size: 18, weight: .bold, design: .rounded))
                    .monospacedDigit()
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// iOS lock screen — the step happening NOW + a countdown to the next.
@available(iOS 18.0, *)
struct BrewLockScreenView: View {
    let context: ActivityViewContext<BrewAttributes>

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(context.attributes.recipeName.uppercased())
                .font(.system(size: 11, weight: .bold))
                .tracking(0.8)
                .foregroundColor(laInk.opacity(0.6))
                .lineLimit(1)

            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("NOW")
                        .font(.system(size: 10, weight: .semibold))
                        .tracking(1.2)
                        .foregroundColor(laInk.opacity(0.5))
                    Text(context.state.currentStep)
                        .font(.system(size: 20, weight: .semibold, design: .serif))
                        .foregroundColor(laInk)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                }
                Spacer(minLength: 8)
                Text(timerInterval: context.state.stepStartDate...context.state.nextStepDate, countsDown: true)
                    .font(.system(size: 24, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundColor(laInk)
            }

            ProgressView(timerInterval: context.state.stepStartDate...context.state.nextStepDate, countsDown: false)
                .tint(laInk)
                .labelsHidden()
        }
        .padding(16)
    }
}
