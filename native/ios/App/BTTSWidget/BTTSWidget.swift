import WidgetKit
import SwiftUI
import AppIntents

// MARK: - Data

/// One rotation tile. Matches the JSON written by WidgetBridgePlugin.setRotation
/// (an array of {id, roaster, name}) and the web side
/// (src/lib/native/widgetBridge.ts WidgetRotationCoffee).
struct RotationCoffee: Decodable, Identifiable {
    let id: String
    let roaster: String
    let name: String
}

private let appGroup = "group.com.roitsch.btts"
private let storeKey = "rotation"
private let indexKey = "widgetIndex"

/// Reads the rotation list from the shared App Group. Returns a short reason
/// code alongside an empty result so the widget can SHOW why it's empty.
private func loadRotation() -> (coffees: [RotationCoffee], reason: String) {
    guard let defaults = UserDefaults(suiteName: appGroup) else { return ([], "no group") }
    guard let raw = defaults.string(forKey: storeKey), !raw.isEmpty else { return ([], "no data") }
    guard let data = raw.data(using: .utf8) else { return ([], "bad utf8") }
    do {
        let list = try JSONDecoder().decode([RotationCoffee].self, from: data)
        return (list, list.isEmpty ? "empty list" : "")
    } catch {
        return ([], "decode err")
    }
}

// MARK: - Interactive paging (iOS 17+)

/// Advances the featured bag by `delta`, wrapping around. Stored in the App
/// Group so the timeline reads it. iOS reloads the widget after the intent runs
/// — the manual "carousel" navigation, since iOS can't swipe inside a widget.
struct AdvanceCarouselIntent: AppIntent {
    static var title: LocalizedStringResource = "Show another rotation bag"

    @Parameter(title: "Delta") var delta: Int

    init() { self.delta = 1 }
    init(delta: Int) { self.delta = delta }

    func perform() async throws -> some IntentResult {
        let (coffees, _) = loadRotation()
        if !coffees.isEmpty, let defaults = UserDefaults(suiteName: appGroup) {
            let cur = defaults.integer(forKey: indexKey)
            var next = (cur + delta) % coffees.count
            if next < 0 { next += coffees.count }
            defaults.set(next, forKey: indexKey)
        }
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}

// MARK: - Palette (fruity Field tones — deliberately no beige/brown)

private let ink = Color(red: 0.227, green: 0.133, blue: 0.188) // deep plum ink
private let fieldGradient = LinearGradient(
    colors: [
        Color(red: 0.969, green: 0.773, blue: 0.827), // rose
        Color(red: 0.961, green: 0.620, blue: 0.525), // peach
        Color(red: 0.933, green: 0.494, blue: 0.400), // coral
    ],
    startPoint: .topLeading,
    endPoint: .bottomTrailing
)

// MARK: - Timeline

struct BTTSEntry: TimelineEntry {
    let date: Date
    let coffee: RotationCoffee?
    let index: Int
    let total: Int
    let reason: String
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> BTTSEntry {
        BTTSEntry(date: Date(), coffee: nil, index: 0, total: 0, reason: "")
    }

    func getSnapshot(in context: Context, completion: @escaping (BTTSEntry) -> Void) {
        completion(currentEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<BTTSEntry>) -> Void) {
        // Manual carousel: the featured bag is whatever index the arrow buttons
        // last set. No time-based rotation — the user pages with ‹ ›.
        completion(Timeline(entries: [currentEntry()], policy: .never))
    }

    private func currentEntry() -> BTTSEntry {
        let (coffees, reason) = loadRotation()
        guard !coffees.isEmpty else {
            return BTTSEntry(date: Date(), coffee: nil, index: 0, total: 0, reason: reason)
        }
        let stored = UserDefaults(suiteName: appGroup)?.integer(forKey: indexKey) ?? 0
        let idx = ((stored % coffees.count) + coffees.count) % coffees.count
        return BTTSEntry(date: Date(), coffee: coffees[idx], index: idx, total: coffees.count, reason: "")
    }
}

// MARK: - View

struct BTTSWidgetEntryView: View {
    var entry: Provider.Entry

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header — centered eyebrow (Scan lives in its own widget now)
            Text("IN ROTATION")
                .font(.system(size: 11, weight: .bold))
                .tracking(1.4)
                .foregroundColor(ink.opacity(0.6))
                .frame(maxWidth: .infinity, alignment: .center)

            Spacer(minLength: 6)

            if let c = entry.coffee {
                // Featured bag — name/roaster on the left, dedicated Brew pill
                // on the right (mirrors the coffee-library row).
                HStack(alignment: .center, spacing: 10) {
                    VStack(alignment: .leading, spacing: 3) {
                        if !c.roaster.isEmpty {
                            // Same size/treatment as the "IN ROTATION" eyebrow.
                            Text(c.roaster.uppercased())
                                .font(.system(size: 11, weight: .bold))
                                .tracking(1.4)
                                .foregroundColor(ink.opacity(0.55))
                                .lineLimit(1)
                        }
                        Text(c.name)
                            .font(.system(size: 22, weight: .semibold, design: .serif))
                            .foregroundColor(ink)
                            .lineLimit(2)
                            .minimumScaleFactor(0.7)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 0)
                    Link(destination: URL(string: "btts://brew?coffeeId=\(c.id)")!) {
                        Text("Brew")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(.white)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                            .background(Capsule().fill(ink))
                    }
                }
            } else {
                VStack(alignment: .leading, spacing: 4) {
                    Text("No bags in rotation")
                        .font(.system(size: 17, weight: .semibold, design: .serif))
                        .foregroundColor(ink)
                    Text("Star a coffee as in-rotation, then open BTTS.")
                        .font(.system(size: 12))
                        .foregroundColor(ink.opacity(0.7))
                    if !entry.reason.isEmpty {
                        Text(entry.reason)
                            .font(.system(size: 9, weight: .medium))
                            .foregroundColor(ink.opacity(0.4))
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            Spacer(minLength: 6)

            // Manual carousel controls: ‹ prev · dots · next ›
            if entry.total > 1 {
                HStack(spacing: 0) {
                    Button(intent: AdvanceCarouselIntent(delta: -1)) {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(ink.opacity(0.7))
                            .frame(width: 26, height: 22)
                            .background(Capsule().fill(Color.white.opacity(0.35)))
                    }
                    .buttonStyle(.plain)

                    Spacer(minLength: 0)
                    HStack(spacing: 5) {
                        ForEach(0..<entry.total, id: \.self) { i in
                            Circle()
                                .fill(ink.opacity(i == entry.index ? 0.85 : 0.28))
                                .frame(width: 6, height: 6)
                        }
                    }
                    Spacer(minLength: 0)

                    Button(intent: AdvanceCarouselIntent(delta: 1)) {
                        Image(systemName: "chevron.right")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(ink.opacity(0.7))
                            .frame(width: 26, height: 22)
                            .background(Capsule().fill(Color.white.opacity(0.35)))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .containerBackground(for: .widget) { fieldGradient }
    }
}

// MARK: - Widget

struct BTTSWidget: Widget {
    let kind = "BTTSWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            BTTSWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("BTTS Rotation")
        .description("Brew a bag in rotation.")
        .supportedFamilies([.systemMedium])
    }
}

// MARK: - Scan widget (small, static — opens the bag scanner)

private let raspberryPeachGradient = LinearGradient(
    colors: [
        Color(red: 0.886, green: 0.384, blue: 0.549), // raspberry
        Color(red: 0.945, green: 0.553, blue: 0.514), // coral
        Color(red: 0.969, green: 0.690, blue: 0.486), // peach
    ],
    startPoint: .top,
    endPoint: .bottom
)

struct ScanEntry: TimelineEntry {
    let date: Date
}

struct ScanProvider: TimelineProvider {
    func placeholder(in context: Context) -> ScanEntry { ScanEntry(date: Date()) }
    func getSnapshot(in context: Context, completion: @escaping (ScanEntry) -> Void) {
        completion(ScanEntry(date: Date()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<ScanEntry>) -> Void) {
        completion(Timeline(entries: [ScanEntry(date: Date())], policy: .never))
    }
}

struct ScanWidgetEntryView: View {
    var entry: ScanProvider.Entry

    var body: some View {
        VStack(spacing: 6) {
            Text("NEW SESSION")
                .font(.system(size: 11, weight: .bold))
                .tracking(1.4)
                .foregroundColor(ink.opacity(0.6))

            Spacer(minLength: 2)

            Image(systemName: "camera")
                .font(.system(size: 26, weight: .regular))
                .foregroundColor(ink.opacity(0.85))

            Spacer(minLength: 2)

            Text("Scan\na bag")
                .font(.system(size: 25, weight: .semibold, design: .serif))
                .multilineTextAlignment(.center)
                .foregroundColor(ink)
                .lineLimit(2)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .containerBackground(for: .widget) { raspberryPeachGradient }
        .widgetURL(URL(string: "btts://scan"))
    }
}

struct ScanWidget: Widget {
    let kind = "BTTSScanWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ScanProvider()) { entry in
            ScanWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Scan a bag")
        .description("Open the bag scanner.")
        .supportedFamilies([.systemSmall])
    }
}

@main
struct BTTSWidgetBundle: WidgetBundle {
    var body: some Widget {
        BTTSWidget()
        ScanWidget()
        if #available(iOS 18.0, *) {
            BrewLiveActivity()
        }
    }
}
