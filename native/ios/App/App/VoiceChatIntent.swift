import AppIntents
import UIKit

/// Opens the BTTS Home voice chat and starts listening.
///
/// Fired by Siri ("Hey Siri, BTTS Voice") AND by the iPhone Action Button (the
/// owner assigns this shortcut once in Settings → Action Button → Shortcut).
/// It foregrounds the app and routes through the existing `btts://voice` custom
/// URL scheme, which the web layer (`src/lib/native/widgetDeepLinks.ts`) turns
/// into "open the Home chat + arm the mic" — the mic start sounds the listening
/// earcon so the user knows to speak.
///
/// A custom URL scheme is opened via `UIApplication.shared.open` (the documented
/// path for non-universal links — `OpenURLIntent` only accepts universal links).
/// AppIntents requires iOS 16, so the whole surface is availability-gated; the
/// app's deployment target is 15 and the owner's device is far newer.
@available(iOS 16.0, *)
struct OpenVoiceChatIntent: AppIntent {
    static var title: LocalizedStringResource = "Open BTTS Voice Chat"
    static var description = IntentDescription("Open the BTTS voice chat and start listening.")

    // Bring the app to the foreground when the intent runs.
    static var openAppWhenRun: Bool = true

    @MainActor
    func perform() async throws -> some IntentResult {
        if let url = URL(string: "btts://voice") {
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
        }
        return .result()
    }
}

/// Registers the App Shortcut so Siri recognises the spoken phrase and the
/// shortcut appears in the Shortcuts app (which is how it's bound to the Action
/// Button). Apple requires the app name in every phrase — `\(.applicationName)`
/// resolves to "BTTS", so the primary phrase is "BTTS Voice".
@available(iOS 16.0, *)
struct BTTSAppShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: OpenVoiceChatIntent(),
            phrases: [
                "\(.applicationName) Voice",
                "Open \(.applicationName) Voice",
                "Talk to \(.applicationName)",
            ],
            shortTitle: "Voice Chat",
            systemImageName: "mic.fill"
        )
    }
}
