// Pocketful UI roles grounded in Abdeen Labs Nightfield v3.11.
// Pocketful continues to own its product typography, layout, and motion.

import Foundation
import SwiftUI

extension Color {
    /// Parses #RRGGBB or #RGB (leading # optional).
    init(hex: String) {
        var value = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if value.hasPrefix("#") { value.removeFirst() }
        if value.count == 3 {
            value = value.map { "\($0)\($0)" }.joined()
        }
        var rgb: UInt64 = 0
        Scanner(string: value).scanHexInt64(&rgb)
        self.init(
            red: Double((rgb >> 16) & 0xFF) / 255.0,
            green: Double((rgb >> 8) & 0xFF) / 255.0,
            blue: Double(rgb & 0xFF) / 255.0
        )
    }
}

enum NightfieldPalette {
    // Canonical anchors
    static let void = Color(hex: "#000704")
    static let surface = Color(hex: "#001A0F")
    static let border = Color(hex: "#07452D")
    static let mist = Color(hex: "#EEF5F0")
    static let accent = Color(hex: "#1FB977")

    // Pitch — dark-green depth
    static let pitch900 = Color(hex: "#00100A")
    static let pitch800 = Color(hex: "#012416")
    static let pitch700 = Color(hex: "#022E1D")
    static let pitch600 = Color(hex: "#043923")

    // Graphite — structure and dim text
    static let graphite500 = Color(hex: "#6B837A")
    static let graphite400 = Color(hex: "#86A998")

    // Chalk — supporting light ink
    static let chalk300 = Color(hex: "#D4E8DE")

    // Accent and state signals
    static let accentBright = Color(hex: "#43D995")
    static let accentDeep = Color(hex: "#0D8F5B")
    static let accentInk = Color(hex: "#06150D")
    static let cobalt400 = Color(hex: "#5AA7FF")
    static let amber400 = Color(hex: "#E2A81E")
    static let hazard500 = Color(hex: "#FF2A2A")
}

/// Role tokens — components consume these, never a ramp step.
enum PocketfulTheme {
    // Surfaces
    static let bg = NightfieldPalette.void
    static let surface = NightfieldPalette.pitch900
    static let card = NightfieldPalette.surface
    static let band = NightfieldPalette.pitch800
    static let cardElevated = NightfieldPalette.pitch700
    static let border = NightfieldPalette.pitch600
    static let borderStrong = NightfieldPalette.border

    // Ink
    static let text = NightfieldPalette.mist
    static let textSoft = NightfieldPalette.chalk300
    static let dim = NightfieldPalette.graphite400
    static let faint = NightfieldPalette.graphite500

    // Signals
    static let accent = NightfieldPalette.accent
    static let link = NightfieldPalette.accentBright
    static let press = NightfieldPalette.accentDeep
    static let accentInk = NightfieldPalette.accentInk
    static let success = NightfieldPalette.cobalt400
    static let warning = NightfieldPalette.amber400
    static let danger = NightfieldPalette.hazard500

    // Pass previews need literal product artwork colors.
    static let white = Color.white
    static let black = Color.black
}

/// Radius is concentric: each step 4px tighter than the frame around it.
enum Radii {
    static let control: CGFloat = 6   // buttons, inputs, fields, chips
    static let plate: CGFloat = 10    // plates, cards, wells, bands
    static let shell: CGFloat = 14    // shells, modals, rails
    static let round: CGFloat = 999   // dots and avatars only
}

/// Type — Geist Mono for chrome, data, and labels; Geist for prose;
/// Schibsted Grotesk for uppercase display at 24pt or larger.
/// The bundled TTFs carry these exact PostScript names.
enum PocketfulFont {
    static func text(_ size: CGFloat) -> Font { .custom("Geist-Regular", size: size) }
    static func textMedium(_ size: CGFloat) -> Font { .custom("Geist-Medium", size: size) }
    static func textSemiBold(_ size: CGFloat) -> Font { .custom("Geist-SemiBold", size: size) }
    static func mono(_ size: CGFloat) -> Font { .custom("GeistMono-Regular", size: size) }
    static func monoMedium(_ size: CGFloat) -> Font { .custom("GeistMono-Medium", size: size) }
    static func monoSemiBold(_ size: CGFloat) -> Font { .custom("GeistMono-SemiBold", size: size) }
    static func display(_ size: CGFloat) -> Font { .custom("SchibstedGrotesk-Bold", size: size) }
    static func displayHeavy(_ size: CGFloat) -> Font { .custom("SchibstedGrotesk-ExtraBold", size: size) }
}

/// Micro-labels are uppercase mono at 0.11em tracking.
enum Tracking {
    static let micro: CGFloat = 1.2       // 0.11em at 11pt
    static let display: CGFloat = -0.055  // multiply by font size
}
