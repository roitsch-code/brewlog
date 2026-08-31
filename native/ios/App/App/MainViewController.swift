import UIKit
import Capacitor

/**
 Custom Capacitor bridge view controller.

 Its ONE job: register the app-defined plugins. A plugin written inside the app
 target (rather than shipped as an npm package) is NOT auto-discovered by
 Capacitor — npm plugins land in the generated `packageClassList`, app-local
 ones do not. Per the Capacitor docs ("Custom Native iOS Code" + "Subclassing
 CAPBridgeViewController") the supported registration hook is
 `capacitorDidLoad()` → `bridge?.registerPluginInstance(...)`. Without this the
 JS side sees the plugin as undefined and every call is a silent no-op.

 (The BrewWatch plugin was removed 2026-08-29 — the Apple Watch step-haptics
 were retired after they never worked in the background and drained the battery.)

 The storyboard's bridge view controller points at this class
 (customClass="MainViewController", customModuleProvider="target").
 */
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(WidgetBridgePlugin())
        bridge?.registerPluginInstance(LiveActivityPlugin())
        bridge?.registerPluginInstance(ScreenAwakePlugin())
    }
}
