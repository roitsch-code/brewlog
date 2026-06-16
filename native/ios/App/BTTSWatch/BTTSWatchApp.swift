import SwiftUI

/**
 BTTS Apple Watch companion — single-target SwiftUI watch app.

 Purpose: buzz the wrist at each brew step. It carries no brew UI of its own
 beyond a status glance; the iPhone drives everything and hands the schedule
 over at brew start (see BrewWatchModel). Open it before you brew and the wrist
 takes over the step cues, even with the phone screen on.
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
