// Pocketful UI roles grounded in the Abdeen Labs Redline palette.
// Pocketful owns its product typography and layout.

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

enum RedlinePalette {
    // Canonical anchors
    static let void = Color(hex: "#0A0F1C")
    static let surface = Color(hex: "#192133")
    static let border = Color(hex: "#3A4769")
    static let mist = Color(hex: "#F0F3FA")
    static let accent = Color(hex: "#FE002A")

    // Pitch — the dark ladder
    static let pitch960 = Color(hex: "#000000")
    static let pitch900 = Color(hex: "#121827")
    static let pitch800 = Color(hex: "#212A40")
    static let pitch700 = Color(hex: "#29334D")
    static let pitch600 = Color(hex: "#313C5A")

    // Graphite — structure and dim text
    static let graphite500 = Color(hex: "#747D90")
    static let graphite400 = Color(hex: "#939FBD")

    // Chalk — dark-ground text
    static let chalk100 = Color(hex: "#F3F7FF")
    static let chalk300 = Color(hex: "#DBE2F4")

    // Carbon — ink on a filled scarlet or alarm field
    static let carbon900 = Color(hex: "#0A0F1C")

    // Accent and signals
    static let accentDeep = Color(hex: "#D4212C")
    static let cobalt400 = Color(hex: "#5AA7FF")
    static let warn400 = Color(hex: "#F5FF00")
    static let alarm500 = Color(hex: "#FF2BD6")
}

/// Role tokens — components consume these, never a ramp step.
enum PocketfulTheme {
    // Surfaces
    static let bg = RedlinePalette.void
    static let surface = RedlinePalette.pitch900
    static let card = RedlinePalette.surface
    static let band = RedlinePalette.pitch800
    static let cardElevated = RedlinePalette.pitch700
    static let border = RedlinePalette.pitch600
    static let borderStrong = RedlinePalette.border
    /// Removed content.
    static let removed = RedlinePalette.pitch960

    // Ink
    static let text = RedlinePalette.chalk100
    static let textSoft = RedlinePalette.chalk300
    static let dim = RedlinePalette.graphite400
    /// Holds AA on `bg` only; ink on any surface above the ground uses `dim`.
    static let faint = RedlinePalette.graphite500
    /// Ink on a filled accent or alarm field.
    static let fillInk = RedlinePalette.carbon900

    // Signals — identity is a solid line; a warning is a dashed frame, a dashed
    // leading edge, corner ticks, a legend frame, or a highlighter chip, one form
    // per surface; an alarm is hatched, struck, pulsed, or a filled field.
    // The signal colour carries the label; the message stays on `text`.
    static let accent = RedlinePalette.accent
    static let link = RedlinePalette.accent
    static let press = RedlinePalette.accentDeep
    static let success = RedlinePalette.cobalt400
    static let warning = RedlinePalette.warn400
    static let alarm = RedlinePalette.alarm500

    // Pass previews need literal product artwork colors.
    static let white = Color.white
    static let black = Color.black
}

/// Brand motion cadence on cubic-bezier(0.2, 0, 0, 1): 120ms for state
/// feedback, 170ms for a small shift, 0.96 for a press. Reduced motion keeps
/// the static cue and drops the travel.
enum PocketfulMotion {
    static let state = Animation.timingCurve(0.2, 0, 0, 1, duration: 0.12)
    static let shift = Animation.timingCurve(0.2, 0, 0, 1, duration: 0.17)
    static let pressScale: CGFloat = 0.96
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

/// Micro-labels are uppercase mono at 0.11em tracking; the wordmark is fixed at 0.22em.
enum Tracking {
    static let micro: CGFloat = 1.2       // 0.11em at 11pt
    static let display: CGFloat = -0.055  // multiply by font size
    static let wordmark: CGFloat = 0.22   // multiply by font size
}
