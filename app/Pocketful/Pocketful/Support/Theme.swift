// Axis — the Abdeen Labs design system (v3.5), ported from the retired
// Expo app's src/theme.ts. The app ships dark, Axis's canonical mode.

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

enum Palette {
    // Pitch — the dark field
    static let pitch960 = Color(hex: "#000000")
    static let pitch950 = Color(hex: "#06080D")
    static let pitch900 = Color(hex: "#0C1017")
    static let pitch850 = Color(hex: "#131822")
    static let pitch800 = Color(hex: "#1A212C")
    static let pitch700 = Color(hex: "#212936")
    static let pitch600 = Color(hex: "#293344")
    static let pitch500 = Color(hex: "#323E50")
    // Graphite — structure and dim text
    static let graphite600 = Color(hex: "#576274")
    static let graphite500 = Color(hex: "#748092")
    static let graphite400 = Color(hex: "#8E97A8")
    static let graphite300 = Color(hex: "#A9B2C0")
    // Chalk — text, never a surface
    static let chalk100 = Color(hex: "#FFFFFF")
    static let chalk300 = Color(hex: "#E0E5EE")
    // Lacquer — identity red
    static let lacquer400 = Color(hex: "#E13B3B")
    static let lacquer500 = Color(hex: "#CE2020")
    static let lacquer600 = Color(hex: "#A31818")
    // State
    static let jade400 = Color(hex: "#16B37D")
    static let amber400 = Color(hex: "#E2A81E")
}

/// Role tokens — components consume these, never a ramp step.
enum Axis {
    // Surfaces
    static let bg = Palette.pitch950            // surface-page
    static let surface = Palette.pitch900       // surface-sunken — wells, inputs
    static let card = Palette.pitch850          // surface-card — the default plate
    static let band = Palette.pitch800          // surface-band — strips, chips, bubbles
    static let cardElevated = Palette.pitch700  // surface-raised — the loudest surface
    static let border = Palette.pitch600        // hairline
    static let borderStrong = Palette.pitch500  // hairline-strong
    // Ink
    static let text = Palette.chalk100          // ink-primary
    static let textSoft = Palette.chalk300      // ink-secondary
    static let dim = Palette.graphite400        // ink-dim
    static let faint = Palette.graphite500      // ink-faint
    // Signals
    static let accent = Palette.lacquer500      // signal-identity
    static let link = Palette.lacquer400        // signal-link
    static let press = Palette.lacquer600       // signal-press
    static let success = Palette.jade400        // signal-verified
    static let warning = Palette.amber400       // signal-warning
    static let danger = Palette.lacquer400
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
enum AxisFont {
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
