import Foundation
import Capacitor
import WidgetKit

/**
 WidgetBridge — phone-side bridge from the WKWebView (JS) to the home-screen
 widget (a separate process).

 The web layer (`src/lib/native/widgetBridge.ts`) calls `setRotation` on app
 open with the user's in-rotation coffees. We write that list as JSON into the
 shared App Group container (`group.com.roitsch.btts`) and ask WidgetKit to
 reload, so the BTTSWidget extension reads the tiles with no network and no
 auth/token surface. The widget renders each as a `btts://brew?coffeeId=…`
 deep-link tile (+ a `btts://scan` tile), handled back in
 `src/lib/native/widgetDeepLinks.ts`.

 App-local plugin (NOT an npm package), so it is registered manually in
 MainViewController.capacitorDidLoad — same mechanism as BrewWatchPlugin.
 */
@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setRotation", returnType: CAPPluginReturnPromise),
    ]

    private let suiteName = "group.com.roitsch.btts"
    private let storeKey = "rotation"

    @objc func setRotation(_ call: CAPPluginCall) {
        let incoming = call.getArray("coffees", JSObject.self) ?? []
        // Project to the exact shape the widget decodes ([{id,roaster,name}]).
        var out: [[String: String]] = []
        for c in incoming {
            guard let id = c["id"] as? String,
                  let name = c["name"] as? String else { continue }
            let roaster = c["roaster"] as? String ?? ""
            out.append(["id": id, "roaster": roaster, "name": name])
        }

        if let defaults = UserDefaults(suiteName: suiteName),
           let data = try? JSONSerialization.data(withJSONObject: out, options: []),
           let json = String(data: data, encoding: .utf8) {
            defaults.set(json, forKey: storeKey)
        }

        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        call.resolve()
    }
}
