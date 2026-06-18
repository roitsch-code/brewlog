import UIKit
import UniformTypeIdentifiers

/**
 Share Extension — "Add to BTTS". Appears in the iOS Share Sheet for URLs and
 text (e.g. a coffee product page shared from Safari / Instagram). It extracts
 the URL, opens the host app via the `btts://share?url=…` deep link, and
 dismisses. The app's deep-link handler (src/lib/native/widgetDeepLinks.ts) then
 lands in the scan flow and auto-analyzes the URL (/api/analyze-url).

 No App Group needed: the URL is small enough to pass inline in the deep link.
 Opening the host app from an extension uses the documented responder-chain
 `openURL:` walk (UIApplication isn't directly reachable from an extension).
 */
@objc(ShareViewController)
class ShareViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        extractURL { [weak self] urlString in
            DispatchQueue.main.async { self?.finish(urlString) }
        }
    }

    private func extractURL(_ completion: @escaping (String?) -> Void) {
        guard let item = extensionContext?.inputItems.first as? NSExtensionItem,
              let providers = item.attachments else { completion(nil); return }

        let urlType = UTType.url.identifier
        let textType = UTType.plainText.identifier

        // Prefer an explicit URL attachment.
        if let p = providers.first(where: { $0.hasItemConformingToTypeIdentifier(urlType) }) {
            p.loadItem(forTypeIdentifier: urlType, options: nil) { data, _ in
                completion((data as? URL)?.absoluteString)
            }
            return
        }
        // Otherwise pull the first URL out of shared plain text.
        if let p = providers.first(where: { $0.hasItemConformingToTypeIdentifier(textType) }) {
            p.loadItem(forTypeIdentifier: textType, options: nil) { data, _ in
                completion(Self.firstURL(in: data as? String))
            }
            return
        }
        completion(nil)
    }

    private static func firstURL(in text: String?) -> String? {
        guard let text = text,
              let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue) else { return nil }
        let range = NSRange(text.startIndex..., in: text)
        return detector.firstMatch(in: text, range: range)?.url?.absoluteString
    }

    // Selector stub so `#selector(openURL(_:))` resolves; the host app's
    // responder provides the real implementation. We walk from `self.next` so
    // this stub is skipped.
    @objc func openURL(_ url: URL) {}

    private func finish(_ urlString: String?) {
        guard let s = urlString,
              let encoded = s.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let deep = URL(string: "btts://share?url=\(encoded)") else {
            extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
            return
        }
        openHostApp(deep)
        // Tear the extension down AFTER the host-app launch has a beat to take —
        // completing too early (0.15 s) cancels the pending open, which is why
        // nothing happened. 0.8 s is comfortably enough.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { [weak self] in
            self?.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
        }
    }

    /// Open the host app with our custom-scheme deep link. NSExtensionContext.open
    /// is tried first (harmless if unsupported), then the documented responder-
    /// chain `openURL:` walk — the standard way a share extension opens its host.
    private func openHostApp(_ url: URL) {
        extensionContext?.open(url, completionHandler: nil)
        let selector = #selector(openURL(_:))
        var responder: UIResponder? = self.next
        while let r = responder {
            if r.responds(to: selector) {
                r.perform(selector, with: url)
                return
            }
            responder = r.next
        }
    }
}
