import UIKit
import Capacitor

/**
 Custom Capacitor bridge view controller.

 Its ONE job: register the app-defined `BrewWatchPlugin`. A plugin written
 inside the app target (rather than shipped as an npm package) is NOT
 auto-discovered by Capacitor — npm plugins land in the generated
 `packageClassList`, app-local ones do not. Per the Capacitor docs
 ("Custom Native iOS Code" + "Subclassing CAPBridgeViewController") the
 supported registration hook is `capacitorDidLoad()` →
 `bridge?.registerPluginInstance(...)`. Without this the JS side sees
 `window.Capacitor.Plugins.BrewWatch` as undefined and every call is a silent
 no-op — which is exactly why the watch never received the brew schedule.

 The storyboard's bridge view controller points at this class
 (customClass="MainViewController", customModuleProvider="target").
 */
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(BrewWatchPlugin())
    }
}
