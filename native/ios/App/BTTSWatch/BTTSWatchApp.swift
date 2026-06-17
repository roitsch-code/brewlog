import SwiftUI

/**
 BTTS Apple Watch companion — single-target SwiftUI watch app.

 Open it at brew start: the phone hands over the step schedule, the app starts a
 physical-therapy extended-runtime session (so it stays alive in the background)
 and buzzes the wrist at each step — screen off, wrist down. See BrewWatchModel.
 */
@main
struct BTTSWatchApp: App {
    @StateObject private var model = BrewWatchModel.shared

    init() {
        BrewWatchModel.shared.activateSession()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(model)
        }
    }
}
