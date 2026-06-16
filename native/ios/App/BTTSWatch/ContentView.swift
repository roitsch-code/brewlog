import SwiftUI

/**
 Glance UI for the watch app. The wrist haptic (delivered by push) is the
 product — this screen is just a one-line reassurance. BTTS voice: pragmatic,
 no hype, no emoji.
 */
struct ContentView: View {
    @EnvironmentObject var model: BrewWatchModel

    var body: some View {
        VStack(spacing: 8) {
            Text("BTTS")
                .font(.headline)
            Text("Brew on your phone. Each step buzzes your wrist — you don't need to keep this open.")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, 6)
    }
}
