import SwiftUI

/**
 Glance UI for the watch app. The wrist haptic is the product; this screen shows
 what's brewing + what's next when you raise your wrist. BTTS voice: pragmatic,
 no hype, no emoji.
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
                Text("Open this at brew start — each step buzzes your wrist, screen off.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                // Diagnostic line (build 18) — read this off the watch if a brew
                // doesn't show up here. Remove once the handoff is confirmed.
                Text("WC \(model.wcState) · reach \(model.reachable ? "Y" : "N") · rx \(model.msgCount) · fires \(model.lastFires) · \(model.lastEvent)")
                    .font(.system(size: 11).monospaced())
                    .foregroundStyle(.tertiary)
                    .padding(.top, 4)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 4)
    }
}
