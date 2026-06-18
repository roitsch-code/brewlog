import UIKit
import UniformTypeIdentifiers
import UserNotifications

/**
 Share Extension — "Add to BTTS". Appears in the iOS Share Sheet for URLs and
 text (a coffee product page shared from Safari / Instagram). It extracts the
 URL and posts a local notification carrying it; tapping that notification opens
 BTTS, which reads the URL (`btts_url`) and auto-analyzes it (/api/analyze-url).

 Why a notification and not a direct open: since iOS 18, Apple BLOCKS app
 extensions from opening their host app (UIApplication is unavailable in an
 extension; the old responder-chain `openURL:` hack force-fails with "BUG IN
 CLIENT OF UIKIT"). A local notification is Apple's documented, sanctioned way to
 bring the host app forward from an extension. No App Group needed — the URL
 rides in the notification's userInfo.
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

        if let p = providers.first(where: { $0.hasItemConformingToTypeIdentifier(urlType) }) {
            p.loadItem(forTypeIdentifier: urlType, options: nil) { data, _ in
                completion((data as? URL)?.absoluteString)
            }
            return
        }
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

    private func finish(_ urlString: String?) {
        guard let s = urlString else {
            complete()
            return
        }
        postNotification(s) { [weak self] in self?.complete() }
    }

    /// Post a local notification carrying the shared URL. Tapping it opens BTTS,
    /// where the LocalNotifications listener reads `btts_url` and runs the scan.
    private func postNotification(_ urlString: String, then done: @escaping () -> Void) {
        let center = UNUserNotificationCenter.current()
        let post = {
            let content = UNMutableNotificationContent()
            content.title = "Add to BTTS"
            content.body = "Tap to read this coffee into BTTS."
            content.userInfo = ["btts_url": urlString]
            content.sound = .default
            let req = UNNotificationRequest(
                identifier: "btts-share",
                content: content,
                trigger: nil // deliver immediately
            )
            center.add(req) { _ in DispatchQueue.main.async { done() } }
        }
        center.getNotificationSettings { settings in
            switch settings.authorizationStatus {
            case .authorized, .provisional:
                post()
            case .notDetermined:
                center.requestAuthorization(options: [.alert, .sound]) { granted, _ in
                    if granted { post() } else { DispatchQueue.main.async { done() } }
                }
            default:
                // Notifications denied — nothing we can do from an extension.
                DispatchQueue.main.async { done() }
            }
        }
    }

    private func complete() {
        extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }
}
