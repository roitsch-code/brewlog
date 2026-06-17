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
            // Lock screen / banner
            BrewLockScreenView(context: context)
                .activityBackgroundTint(laTint)
                .activitySystemActionForegroundColor(laInk)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: "cup.and.saucer.fill").foregroundColor(laInk)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(timerInterval: context.attributes.startDate...context.state.endDate, countsDown: true)
                        .monospacedDigit()
                        .multilineTextAlignment(.trailing)
                        .frame(width: 56)
                        .foregroundColor(laInk)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.state.stepLabel)
                        .font(.headline)
                        .lineLimit(1)
                        .foregroundColor(laInk)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    ProgressView(timerInterval: context.attributes.startDate...context.state.endDate, countsDown: false)
                        .tint(laInk)
                        .labelsHidden()
                }
            } compactLeading: {
                Image(systemName: "cup.and.saucer.fill")
            } compactTrailing: {
                Text(timerInterval: context.attributes.startDate...context.state.endDate, countsDown: true)
                    .monospacedDigit()
                    .frame(width: 44)
            } minimal: {
                Image(systemName: "cup.and.saucer.fill")
            }
        }
    }
}

@available(iOS 16.2, *)
struct BrewLockScreenView: View {
    let context: ActivityViewContext<BrewAttributes>

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 1) {
                    Text(context.attributes.recipeName.uppercased())
                        .font(.system(size: 10, weight: .bold))
                        .tracking(0.8)
                        .foregroundColor(laInk.opacity(0.6))
                        .lineLimit(1)
                    if !context.attributes.coffeeName.isEmpty {
                        Text(context.attributes.coffeeName)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(laInk.opacity(0.8))
                            .lineLimit(1)
                    }
                }
                Spacer()
                Text(timerInterval: context.attributes.startDate...context.state.endDate, countsDown: true)
                    .font(.system(size: 24, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .foregroundColor(laInk)
            }

            Text(context.state.stepLabel)
                .font(.system(size: 20, weight: .semibold, design: .serif))
                .foregroundColor(laInk)
                .lineLimit(1)
                .minimumScaleFactor(0.7)

            ProgressView(timerInterval: context.attributes.startDate...context.state.endDate, countsDown: false)
                .tint(laInk)
                .labelsHidden()
        }
        .padding(16)
    }
}
