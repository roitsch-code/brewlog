import WidgetKit
import SwiftUI

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

/// Reads the rotation list from the shared App Group. Returns a short reason
/// code alongside an empty result so the widget can SHOW why it's empty (App
/// Group missing vs. no data written vs. decode failure) — on-widget diagnosis
/// of the app→widget handoff.
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
        let (coffees, reason) = loadRotation()
        completion(BTTSEntry(date: Date(), coffee: coffees.first, index: 0, total: coffees.count, reason: reason))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<BTTSEntry>) -> Void) {
        let (coffees, reason) = loadRotation()
        var entries: [BTTSEntry] = []
        let now = Date()
        if coffees.isEmpty {
            entries.append(BTTSEntry(date: now, coffee: nil, index: 0, total: 0, reason: reason))
        } else {
            // Carousel: feature one bag per hour, cycling through the rotation.
            // The app calls reloadAllTimelines() on open, so a fresh rotation
            // list resets this immediately; between opens it rotates on its own.
            let steps = max(coffees.count, 6)
            for h in 0..<steps {
                let idx = h % coffees.count
                let date = Calendar.current.date(byAdding: .hour, value: h, to: now) ?? now
                entries.append(BTTSEntry(date: date, coffee: coffees[idx], index: idx, total: coffees.count, reason: ""))
            }
        }
        completion(Timeline(entries: entries, policy: .atEnd))
    }
}

// MARK: - View

struct BTTSWidgetEntryView: View {
    var entry: Provider.Entry

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header — eyebrow + Scan
            HStack(alignment: .center) {
                Text("IN ROTATION")
                    .font(.system(size: 11, weight: .bold))
                    .tracking(1.4)
                    .foregroundColor(ink.opacity(0.6))
                Spacer()
                Link(destination: URL(string: "btts://scan")!) {
                    HStack(spacing: 4) {
                        Image(systemName: "viewfinder").font(.system(size: 11, weight: .bold))
                        Text("Scan").font(.system(size: 12, weight: .semibold))
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 11)
                    .padding(.vertical, 6)
                    .background(Capsule().fill(ink.opacity(0.92)))
                }
            }

            Spacer(minLength: 6)

            // Featured bag (the carousel slot) or the empty state
            if let c = entry.coffee {
                Link(destination: URL(string: "btts://brew?coffeeId=\(c.id)")!) {
                    VStack(alignment: .leading, spacing: 4) {
                        if !c.roaster.isEmpty {
                            Text(c.roaster.uppercased())
                                .font(.system(size: 10, weight: .bold))
                                .tracking(0.8)
                                .foregroundColor(ink.opacity(0.55))
                                .lineLimit(1)
                        }
                        Text(c.name)
                            .font(.system(size: 24, weight: .semibold, design: .serif))
                            .foregroundColor(ink)
                            .lineLimit(2)
                            .minimumScaleFactor(0.7)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
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

            // Carousel position dots
            if entry.total > 1 {
                HStack(spacing: 5) {
                    ForEach(0..<entry.total, id: \.self) { i in
                        Circle()
                            .fill(ink.opacity(i == entry.index ? 0.85 : 0.28))
                            .frame(width: 6, height: 6)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .center)
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
        .description("Brew a bag in rotation, or scan a new one.")
        .supportedFamilies([.systemMedium])
    }
}

@main
struct BTTSWidgetBundle: WidgetBundle {
    var body: some Widget {
        BTTSWidget()
    }
}
