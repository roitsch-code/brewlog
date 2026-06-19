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
        // Photo first (a shared album image), then fall back to URL/text.
        extractImage { [weak self] ok in
            if ok {
                DispatchQueue.main.async { self?.finishImage() }
            } else {
                self?.extractURL { urlString in
                    DispatchQueue.main.async { self?.finish(urlString) }
                }
            }
        }
    }

    private let appGroup = "group.com.roitsch.btts"
    private let sharedImageName = "shared-image.jpg"

    /// Load a shared image, re-encode to JPEG, and write it into the App Group
    /// container so the host app's WidgetBridge can read it. The write MUST
    /// finish inside the async completion handler before we post the
    /// notification, or a large photo arrives blank (documented race).
    private func extractImage(_ completion: @escaping (Bool) -> Void) {
        guard let item = extensionContext?.inputItems.first as? NSExtensionItem,
              let providers = item.attachments else { completion(false); return }
        let imageType = UTType.image.identifier
        guard let p = providers.first(where: { $0.hasItemConformingToTypeIdentifier(imageType) }) else {
            completion(false); return
        }
        p.loadDataRepresentation(forTypeIdentifier: imageType) { [weak self] data, _ in
            guard let self = self,
                  let data = data,
                  let img = UIImage(data: data),
                  let jpeg = img.jpegData(compressionQuality: 0.85),
                  let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: self.appGroup)
            else { completion(false); return }
            do {
                try jpeg.write(to: container.appendingPathComponent(self.sharedImageName), options: .atomic)
                completion(true)
            } catch {
                completion(false)
            }
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
        postNotification(userInfo: ["btts_url": s],
                         body: "Tap to read this coffee into BTTS.") { [weak self] in self?.complete() }
    }

    /// A photo was written to the App Group — bring the app forward to attach it
    /// to the Home chat. The bytes ride in the App Group, not the notification.
    private func finishImage() {
        postNotification(userInfo: ["btts_image": sharedImageName],
                         body: "Tap to add this photo to the BTTS chat.") { [weak self] in self?.complete() }
    }

    /// Post a local notification that brings BTTS forward. Tapping it fires
    /// `localNotificationActionPerformed`, where the web reads `btts_url` /
    /// `btts_image` from `extra` and routes into the chat.
    private func postNotification(userInfo: [String: Any], body: String, then done: @escaping () -> Void) {
        let center = UNUserNotificationCenter.current()
        let post = {
            let content = UNMutableNotificationContent()
            content.title = "Add to BTTS"
            content.body = body
            content.userInfo = userInfo
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
