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

// MARK: - Palette & murmuration field

// Anthracite — matches the app-icon letters. Reads on the saturated field.
private let ink = Color(red: 0.122, green: 0.106, blue: 0.102)

private func hx(_ r: Double, _ g: Double, _ b: Double) -> Color {
    Color(red: r, green: g, blue: b)
}

/// One large soft colour mass (a murmuration blob) that fades to clear.
private struct FieldMass {
    let color: Color
    let center: UnitPoint
    let radius: CGFloat // fraction of the tile's longest side
}

/// A "murmuration" field — a soft diagonal base with large soft colour masses
/// that pool in the corners and flow into each other. NO striped linear
/// gradient. Mirrors the new app icon / the live Field's composeGradient.ts.
private struct MurmurField: View {
    let base: [Color]
    let masses: [FieldMass]

    var body: some View {
        GeometryReader { geo in
            let d = max(geo.size.width, geo.size.height)
            ZStack {
                LinearGradient(colors: base, startPoint: .topLeading, endPoint: .bottomTrailing)
                ForEach(0..<masses.count, id: \.self) { i in
                    let m = masses[i]
                    RadialGradient(
                        stops: [
                            .init(color: m.color, location: 0),
                            .init(color: m.color.opacity(0.55), location: 0.62),
                            .init(color: m.color.opacity(0), location: 1),
                        ],
                        center: m.center, startRadius: 0, endRadius: d * m.radius
                    )
                }
            }
        }
    }
}

// Rotation widget — "bigsur" (magenta / orange-red / blue): ties to the app icon.
private let rotationField = MurmurField(
    base: [hx(0.706, 0, 0.431), hx(0.169, 0.204, 0.784)], // #B4006E -> #2B34C8
    masses: [
        FieldMass(color: hx(0.878, 0.039, 0.561), center: UnitPoint(x: 0.18, y: 0.84), radius: 0.90), // #E00A8F LL
        FieldMass(color: hx(1.0, 0.302, 0.110),   center: UnitPoint(x: 0.86, y: 0.22), radius: 0.84), // #FF4D1C UR
        FieldMass(color: hx(0.227, 0.275, 0.902), center: UnitPoint(x: 0.84, y: 0.86), radius: 0.74), // #3A46E6 LR
    ]
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
        .containerBackground(for: .widget) { rotationField }
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

// Scan widget — "berry" (hot pink / orange / gold): deliberately a DIFFERENT
// combo from the rotation tile (the app's Field is always a different flavour).
private let scanField = MurmurField(
    base: [hx(0.820, 0.086, 0.451), hx(0.780, 0.478, 0)], // #D11673 -> #C77A00
    masses: [
        FieldMass(color: hx(1.0, 0.118, 0.541), center: UnitPoint(x: 0.22, y: 0.82), radius: 0.95), // #FF1E8A LL
        FieldMass(color: hx(1.0, 0.353, 0.122), center: UnitPoint(x: 0.80, y: 0.24), radius: 0.85), // #FF5A1F UR
        FieldMass(color: hx(1.0, 0.690, 0),     center: UnitPoint(x: 0.84, y: 0.86), radius: 0.72), // #FFB000 LR
    ]
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
        .containerBackground(for: .widget) { scanField }
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
