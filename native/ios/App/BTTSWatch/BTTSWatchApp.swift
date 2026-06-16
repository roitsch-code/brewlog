import SwiftUI
import UserNotifications
import WatchKit

/**
 BTTS Apple Watch companion — APNs push receiver.

 The app delegate registers for remote notifications on launch and forwards the
 device token to the phone (BrewWatchModel). From then on the wrist buzzes from
 push alerts the server sends per brew step — this app does not need to be open.
 */
class WatchAppDelegate: NSObject, WKApplicationDelegate, UNUserNotificationCenterDelegate {
    func applicationDidFinishLaunching() {
        UNUserNotificationCenter.current().delegate = self
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
        WKApplication.shared().registerForRemoteNotifications()
    }

    func didRegisterForRemoteNotifications(withDeviceToken deviceToken: Data) {
        let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
        BrewWatchModel.shared.sendToken(hex)
    }

    func didFailToRegisterForRemoteNotificationsWithError(_ error: Error) {}

    // Show the cue (with its haptic) even if the watch app happens to be foreground.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound, .list])
    }
}

@main
struct BTTSWatchApp: App {
    @WKApplicationDelegateAdaptor(WatchAppDelegate.self) private var appDelegate
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
