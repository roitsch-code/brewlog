import SwiftUI

/**
 Glance UI for the watch app. Deliberately minimal — the wrist haptic is the
 product; this screen just confirms a brew is mirrored and shows what's next.
 Copy follows the BTTS voice: knowledgeable, pragmatic, no hype, no emoji.
 */
struct ContentView: View {
    @EnvironmentObject var model: BrewWatchModel

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if model.isBrewing {
                Text(model.recipeName)
                    .font(.headline)
                    .lineLimit(1)

                if let next = model.nextLabel, let at = model.nextFireAt {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Next")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                        Text(next)
                            .font(.body)
                            .lineLimit(2)
                        Text(at, style: .timer)
                            .font(.system(.title3, design: .rounded).monospacedDigit())
                    }
                } else {
                    Text(model.currentLabel.isEmpty ? "Brewing" : model.currentLabel)
                        .font(.body)
                        .foregroundStyle(.secondary)
                }
            } else {
                Text("BTTS")
                    .font(.headline)
                Text("Start a brew on your phone — each step buzzes here.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 4)
    }
}
