import SwiftUI

// BTTS design system, watch edition — the saturated "murmuration" Field the
// app icon and the home-screen widgets carry since July 2026. The web app
// can't reach this separate watchOS target, so the palette is mirrored here
// the same way BTTSWidget.swift mirrors it. Colours + mass positions are the
// SHIPPED icon's ("orchid" in scripts/generate-app-icon.py: pink / magenta /
// lilac / blue, no orange). Text is the app's on-dark cream token
// (text-light-text-on-dark, hsl(36 55% 96%)) — this field is a dark,
// saturated surface, and cream is what the design system puts on those.

private func hx(_ r: Double, _ g: Double, _ b: Double) -> Color {
    Color(red: r, green: g, blue: b)
}

/// The app's `text-light-text-on-dark` cream.
private let cream = hx(0.982, 0.964, 0.938)

/// One large soft colour mass (a murmuration blob) that fades to clear.
private struct FieldMass {
    let color: Color
    let center: UnitPoint
    let radius: CGFloat // fraction of the screen's longest side
}

/// A "murmuration" field — a soft diagonal base with large soft colour masses
/// that pool in the corners and flow into each other. NO striped linear
/// gradient. Same construction as the widgets' MurmurField.
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
        .ignoresSafeArea()
    }
}

// "orchid" — the shipped app-icon field (generate-app-icon.py MURMUR + MASSES):
// pink pools lower-left, lilac upper-right, blue lower-right, plus the deep
// magenta accent top-left so the eyebrow always sits on a deep ground.
private let orchidField = MurmurField(
    base: [hx(0.706, 0, 0.431), hx(0.169, 0.204, 0.784)], // #B4006E -> #2B34C8
    masses: [
        FieldMass(color: hx(0.902, 0.039, 0.576), center: UnitPoint(x: 0.18, y: 0.84), radius: 0.90), // #E60A93 LL
        FieldMass(color: hx(0.694, 0.294, 1.0),   center: UnitPoint(x: 0.86, y: 0.22), radius: 0.84), // #B14BFF UR
        FieldMass(color: hx(0.227, 0.275, 0.902), center: UnitPoint(x: 0.84, y: 0.86), radius: 0.74), // #3A46E6 LR
        FieldMass(color: hx(0.706, 0, 0.431).opacity(0.55), center: UnitPoint(x: 0.30, y: 0.20), radius: 0.50), // deep accent UL
    ]
)

/**
 Glance UI for the watch app. The wrist haptic is the product; this screen shows
 what's next + when, at a glance. BTTS voice: pragmatic, no hype, no emoji.
 */
struct ContentView: View {
    @EnvironmentObject var model: BrewWatchModel

    var body: some View {
        ZStack {
            orchidField
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
                .padding(.horizontal, 4)
        }
    }

    @ViewBuilder
    private var content: some View {
        if model.isBrewing {
            // Brewstep screen — the step happening NOW + a countdown to the next.
            VStack(alignment: .leading, spacing: 5) {
                Text(model.recipeName.uppercased())
                    .font(.system(size: 11, weight: .bold))
                    .tracking(0.8)
                    .foregroundStyle(cream.opacity(0.7))
                    .lineLimit(1)

                Spacer(minLength: 0)

                Text("NOW")
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(1.2)
                    .foregroundStyle(cream.opacity(0.65))
                Text(model.currentLabel.isEmpty ? "Brewing" : model.currentLabel)
                    .font(.system(size: 20, weight: .semibold, design: .serif))
                    .foregroundStyle(cream)
                    .lineLimit(2)
                    .minimumScaleFactor(0.7)

                Spacer(minLength: 0)

                // The hero: how long until the next step.
                if let at = model.nextFireAt {
                    Text(at, style: .timer)
                        .font(.system(size: 40, weight: .bold, design: .rounded).monospacedDigit())
                        .foregroundStyle(cream)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                }

                Spacer(minLength: 0)
            }
        } else {
            VStack(alignment: .leading, spacing: 6) {
                Spacer(minLength: 0)
                Text("BTTS")
                    .font(.system(size: 30, weight: .bold, design: .serif))
                    .foregroundStyle(cream)
                Text("Open at brew start — each step buzzes your wrist.")
                    .font(.system(size: 13))
                    .foregroundStyle(cream.opacity(0.8))
                Spacer(minLength: 0)
            }
        }
    }
}
