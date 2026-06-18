import SwiftUI

// BTTS design system, watch edition. The web app can't reach this separate
// watchOS target, so we mirror the tokens the widgets/Live Activity use: the
// fruity Field gradient + editorial serif (New York ≈ Fraunces), dark plum ink.
// Tiny screen → strict hierarchy, only what's needed at a glance.
private let ink = Color(red: 0.227, green: 0.133, blue: 0.188)   // deep plum
private let fieldGradient = LinearGradient(
    colors: [
        Color(red: 0.969, green: 0.773, blue: 0.827), // rose
        Color(red: 0.961, green: 0.620, blue: 0.525), // peach
        Color(red: 0.933, green: 0.494, blue: 0.400), // coral
    ],
    startPoint: .topLeading,
    endPoint: .bottomTrailing
)

/**
 Glance UI for the watch app. The wrist haptic is the product; this screen shows
 what's next + when, at a glance. BTTS voice: pragmatic, no hype, no emoji.
 */
struct ContentView: View {
    @EnvironmentObject var model: BrewWatchModel

    var body: some View {
        ZStack {
            fieldGradient.ignoresSafeArea()
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
                .padding(.horizontal, 4)
        }
    }

    @ViewBuilder
    private var content: some View {
        if model.isBrewing {
            VStack(alignment: .leading, spacing: 4) {
                // Eyebrow — which recipe (context, not the focus).
                Text(model.recipeName.uppercased())
                    .font(.system(size: 11, weight: .bold))
                    .tracking(0.8)
                    .foregroundStyle(ink.opacity(0.6))
                    .lineLimit(1)

                Spacer(minLength: 0)

                if let next = model.nextLabel, let at = model.nextFireAt {
                    Text("NEXT")
                        .font(.system(size: 10, weight: .semibold))
                        .tracking(1.2)
                        .foregroundStyle(ink.opacity(0.5))
                    Text(next)
                        .font(.system(size: 17, weight: .semibold, design: .serif))
                        .foregroundStyle(ink)
                        .lineLimit(2)
                        .minimumScaleFactor(0.8)
                    // The hero: how long until the next step.
                    Text(at, style: .timer)
                        .font(.system(size: 30, weight: .bold, design: .rounded).monospacedDigit())
                        .foregroundStyle(ink)
                } else {
                    Text(model.currentLabel.isEmpty ? "Brewing" : model.currentLabel)
                        .font(.system(size: 20, weight: .semibold, design: .serif))
                        .foregroundStyle(ink)
                        .lineLimit(2)
                        .minimumScaleFactor(0.8)
                }

                Spacer(minLength: 0)
            }
        } else {
            VStack(alignment: .leading, spacing: 6) {
                Spacer(minLength: 0)
                Text("BTTS")
                    .font(.system(size: 30, weight: .bold, design: .serif))
                    .foregroundStyle(ink)
                Text("Open at brew start — each step buzzes your wrist.")
                    .font(.system(size: 13))
                    .foregroundStyle(ink.opacity(0.72))
                Spacer(minLength: 0)
            }
        }
    }
}
