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

private func loadRotation() -> [RotationCoffee] {
    guard let defaults = UserDefaults(suiteName: appGroup),
          let raw = defaults.string(forKey: storeKey),
          let data = raw.data(using: .utf8),
          let list = try? JSONDecoder().decode([RotationCoffee].self, from: data)
    else { return [] }
    return list
}

// MARK: - Palette (BTTS Light tokens)

private let cream = Color(red: 0.953, green: 0.898, blue: 0.863)        // #F3E5DC
private let anthracite = Color(red: 0.165, green: 0.141, blue: 0.110)   // #2A241C

// MARK: - Timeline

struct BTTSEntry: TimelineEntry {
    let date: Date
    let coffees: [RotationCoffee]
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> BTTSEntry {
        BTTSEntry(date: Date(), coffees: [])
    }

    func getSnapshot(in context: Context, completion: @escaping (BTTSEntry) -> Void) {
        completion(BTTSEntry(date: Date(), coffees: loadRotation()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<BTTSEntry>) -> Void) {
        // The app pushes fresh data + calls reloadAllTimelines() on open, so we
        // don't need a refresh cadence — `.never` until the next explicit reload.
        let entry = BTTSEntry(date: Date(), coffees: loadRotation())
        completion(Timeline(entries: [entry], policy: .never))
    }
}

// MARK: - View

struct BTTSWidgetEntryView: View {
    var entry: Provider.Entry

    private var tiles: [RotationCoffee] { Array(entry.coffees.prefix(3)) }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .center) {
                Text("In rotation")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(anthracite.opacity(0.55))
                Spacer()
                Link(destination: URL(string: "btts://scan")!) {
                    HStack(spacing: 4) {
                        Image(systemName: "camera").font(.system(size: 11, weight: .semibold))
                        Text("Scan").font(.system(size: 12, weight: .semibold))
                    }
                    .foregroundColor(cream)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(Capsule().fill(anthracite))
                }
            }

            if tiles.isEmpty {
                Spacer(minLength: 0)
                Text("Open BTTS to pick today's bag.")
                    .font(.system(size: 13))
                    .foregroundColor(anthracite.opacity(0.6))
                Spacer(minLength: 0)
            } else {
                ForEach(tiles) { coffee in
                    Link(destination: URL(string: "btts://brew?coffeeId=\(coffee.id)")!) {
                        HStack(spacing: 8) {
                            VStack(alignment: .leading, spacing: 1) {
                                if !coffee.roaster.isEmpty {
                                    Text(coffee.roaster)
                                        .font(.system(size: 10))
                                        .foregroundColor(anthracite.opacity(0.5))
                                        .lineLimit(1)
                                }
                                Text(coffee.name)
                                    .font(.system(size: 14, weight: .medium))
                                    .foregroundColor(anthracite)
                                    .lineLimit(1)
                            }
                            Spacer(minLength: 4)
                            Text("Brew")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundColor(cream)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 4)
                                .background(Capsule().fill(anthracite))
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 7)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .fill(Color.white.opacity(0.35))
                        )
                    }
                }
                Spacer(minLength: 0)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .containerBackground(cream, for: .widget)
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
