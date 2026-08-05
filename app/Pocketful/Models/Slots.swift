// Wallet artwork slots in points at 1x. The app exports 1x/2x/3x PNGs.
// Ported from src/lib/slots.ts.

import Foundation

struct ImageSlot: Identifiable, Hashable {
    let name: String
    let label: String
    let width: CGFloat
    let height: CGFloat
    let required: Bool
    let recommended: Bool
    let hint: String

    var id: String { name }
    var aspect: CGFloat { width / height }
}

enum Slots {
    static func standard(for style: PassStyle, posterEvent: Bool) -> [ImageSlot] {
        let stripHeight: CGFloat = style == .eventTicket ? 98 : 144
        let hasStrip = style == .storeCard || style == .coupon || style == .eventTicket

        let posterEventSlots: [ImageSlot] = (style == .eventTicket && posterEvent) ? [
            ImageSlot(
                name: "primaryLogo", label: "Poster primary logo",
                width: 126, height: 30, required: false, recommended: true,
                hint: "iOS 18+ poster-event identity · up to 126×30 pt"
            ),
            ImageSlot(
                name: "secondaryLogo", label: "Poster secondary logo",
                width: 135, height: 12, required: false, recommended: false,
                hint: "Ticket issuer or venue logo · up to 135×12 pt"
            ),
            ImageSlot(
                name: "artwork", label: "Poster artwork",
                width: 358, height: 448, required: false, recommended: true,
                hint: "Full-art iOS 18+ poster background · 358×448 pt"
            ),
        ] : []

        return [
            ImageSlot(
                name: "icon", label: "Icon",
                width: 29, height: 29, required: true, recommended: true,
                hint: "Lock Screen and pass list icon · 29×29 pt"
            ),
            ImageSlot(
                name: "logo", label: "Logo",
                width: 160, height: 50, required: false, recommended: true,
                hint: "Top-left artwork · 160×50 pt"
            ),
        ] + posterEventSlots + [
            ImageSlot(
                name: "strip", label: "Strip",
                width: 375, height: stripHeight, required: false, recommended: hasStrip,
                hint: "Wide artwork behind fields · 375×\(Int(stripHeight)) pt"
            ),
            ImageSlot(
                name: "thumbnail", label: "Thumbnail",
                width: 90, height: 90, required: false,
                recommended: style == .generic || style == .eventTicket,
                hint: "Square artwork beside fields · 90×90 pt"
            ),
            ImageSlot(
                name: "background", label: "Background",
                width: 180, height: 220, required: false,
                recommended: style == .eventTicket,
                hint: "Full-pass background artwork · 180×220 pt"
            ),
            ImageSlot(
                name: "footer", label: "Footer",
                width: 286, height: 15, required: false,
                recommended: style == .boardingPass,
                hint: "Artwork above the barcode · 286×15 pt"
            ),
        ]
    }

    static func localized(for style: PassStyle, languages: [String], posterEvent: Bool) -> [ImageSlot] {
        languages.flatMap { language in
            standard(for: style, posterEvent: posterEvent).map { slot in
                ImageSlot(
                    name: "\(language).lproj/\(slot.name)",
                    label: "\(slot.label) · \(language)",
                    width: slot.width,
                    height: slot.height,
                    required: false,
                    recommended: false,
                    hint: "Localized \(slot.hint.lowercased())"
                )
            }
        }
    }

    static let personalizationLogo = ImageSlot(
        name: "personalizationLogo", label: "Personalization logo",
        width: 150, height: 40, required: false, recommended: true,
        hint: "Shown while Wallet collects personalization details · 150×40 pt"
    )
}
