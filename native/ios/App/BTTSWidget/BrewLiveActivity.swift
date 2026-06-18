import ActivityKit
import WidgetKit
import SwiftUI

// Fruity Live Activity palette (matches the widgets — no beige).
private let laInk = Color(red: 0.227, green: 0.133, blue: 0.188)   // deep plum
private let laTint = Color(red: 0.969, green: 0.706, blue: 0.580)  // peach background tint

@available(iOS 16.2, *)
struct BrewLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: BrewAttributes.self) { context in
            // LOCK SCREEN — shows the step happening NOW + a countdown to the next.
            BrewLockScreenView(context: context)
                .activityBackgroundTint(laTint)
                .activitySystemActionForegroundColor(laInk)
        } dynamicIsland: { context in
            // DYNAMIC ISLAND ("action bar") — shows the NEXT step + countdown.
            // Rendered on black, so text is light. No coffee-cup glyph.
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
    }
}

@available(iOS 16.2, *)
struct BrewLockScreenView: View {
    let context: ActivityViewContext<BrewAttributes>

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Eyebrow — which recipe (context).
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
