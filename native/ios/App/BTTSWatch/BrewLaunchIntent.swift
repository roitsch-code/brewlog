import AppIntents

/**
 Launches the BTTS watch app from Siri on the wrist.

 The physical-layer flow (owner, July 2026): a physical rig sits over the watch,
 so there's NO display interaction — the watch app has to be OPENED hands-free.
 Apple does NOT allow the iPhone to remote-launch a watch app without silent
 push or a watchOS background task (both deliberately out of scope here), so the
 sanctioned hands-free launcher is Siri on the watch driving an App Shortcut.

 This intent is compiled INTO the watch app target (in-app handling), NOT into a
 separate AppIntents extension — that distinction matters: `openAppWhenRun` is
 the documented in-app "just foreground my app" switch and works reliably here,
 whereas it misbehaves inside an AppIntents extension. Same pattern as the
 iPhone's `OpenVoiceChatIntent`, minus the URL step (there's no WKWebView on the
 watch — foregrounding the app is the whole job).

 Once open, `BTTSWatchApp.init()` → `activateSession()` drains the phone's
 latest `applicationContext`, so if a brew is already running the wrist starts
 buzzing immediately; otherwise the app simply waits for the phone to hand over
 the schedule at brew start.

 The watch target's deployment floor is watchOS 9.0 and App Intents ships in 9.0,
 so no availability guard is needed.
 */
struct StartBrewWatchIntent: AppIntent {
    static var title: LocalizedStringResource = "Start BTTS Brew"
    static var description = IntentDescription("Open the BTTS watch app so each brew step buzzes your wrist.")

    /// Foreground the watch app when the intent runs. Nothing else to do — the
    /// app reacts to the phone's schedule on its own.
    static var openAppWhenRun: Bool = true

    @MainActor
    func perform() async throws -> some IntentResult {
        .result()
    }
}

/**
 Registers the spoken phrase with Siri on the watch and surfaces the shortcut in
 the Shortcuts app (so it can also be bound to a watch face complication or, on
 an Apple Watch Ultra, the Action Button). Apple requires the app name in every
 App Shortcut phrase — `\(.applicationName)` resolves to "BTTS", so the primary
 phrase is "BTTS Brew". For a shorter custom phrase ("Brew") the owner makes a
 user Shortcut in the Shortcuts app that runs this intent and names it whatever
 they like — Siri then answers to that name with no app-name prefix.
 */
struct BTTSWatchAppShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: StartBrewWatchIntent(),
            phrases: [
                "\(.applicationName) Brew",
                "Start \(.applicationName)",
                "Start \(.applicationName) Brew",
                "\(.applicationName) Timer",
            ],
            shortTitle: "Start Brew",
            systemImageName: "timer"
        )
    }
}
