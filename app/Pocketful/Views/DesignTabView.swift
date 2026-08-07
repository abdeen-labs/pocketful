// Design tab: templates, pass format, identity, colors, artwork.

import Foundation
import SwiftUI

struct DesignTabView: View {
    @Bindable var state: EditorState
    let onTemplate: (PassTemplate) -> Void

    private static let styleOptions: [(value: PassStyle, label: String)] = [
        (.generic, "Generic"),
        (.storeCard, "Store card"),
        (.coupon, "Coupon"),
        (.eventTicket, "Event ticket"),
        (.boardingPass, "Boarding pass"),
    ]

    private static let transitOptions: [(value: TransitType, label: String)] = [
        (.generic, "Generic"),
        (.air, "Air"),
        (.train, "Train"),
        (.bus, "Bus"),
        (.boat, "Boat"),
    ]

    private static let eventSchemes: [(value: PreferredStyleScheme, label: String)] = [
        (.eventTicket, "Classic event"),
        (.posterEventTicket, "Poster event"),
    ]

    private static let boardingSchemes: [(value: PreferredStyleScheme, label: String)] = [
        (.boardingPass, "Classic boarding"),
        (.semanticBoardingPass, "Enhanced boarding"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            PocketfulSection(
                title: "Templates",
                description: state.lastAppliedTemplateId != nil
                    ? "A polished starting point is applied. Expand to switch it."
                    : "Pick a polished starting point, then make every detail yours.",
                badge: state.lastAppliedTemplateId != nil ? "Applied" : "Curated",
                collapsed: $state.templatesCollapsed
            ) {
                TemplateGalleryView(lastAppliedId: state.lastAppliedTemplateId, onApply: onTemplate)
            }

            PocketfulSection(
                title: "Pass format",
                description: "Choose Wallet's visual template and modern layout preference.",
                badge: "Core"
            ) {
                ChipRow(options: Self.styleOptions, value: state.style) { state.selectStyle($0) }
                if state.style == .boardingPass {
                    MicroLabel("Transit type")
                    ChipRow(options: Self.transitOptions, value: state.transitType) { state.transitType = $0 }
                    MicroLabel("Preferred layouts")
                    MultiChipRow(options: Self.boardingSchemes, values: state.preferredStyleSchemes) {
                        state.preferredStyleSchemes = $0
                    }
                }
                if state.style == .eventTicket {
                    MicroLabel("Preferred layouts")
                    MultiChipRow(options: Self.eventSchemes, values: state.preferredStyleSchemes) {
                        state.preferredStyleSchemes = $0
                    }
                }
            }

            PocketfulSection(
                title: "Identity",
                description: "The pass name, issuer, and stable identity used by Wallet."
            ) {
                PocketfulInput("Wallet description · required", text: $state.descriptionText, placeholder: "Coffee rewards card", capitalization: .sentences)
                PocketfulInput("Organization name", text: $state.organizationName, placeholder: "Pocketful Coffee", capitalization: .words)
                PocketfulInput("Logo text", text: $state.logoText, placeholder: "Pocketful", capitalization: .words)
                PocketfulInput("Serial number", text: $state.serialNumber, placeholder: "Generated automatically when blank", helper: "Supply this when you need a stable identifier for updates; otherwise the server creates a UUID.")
            }

            PocketfulSection(
                title: "Color system",
                description: "Wallet uses these colors across the front, labels, strips, and modern event footer."
            ) {
                HStack(spacing: 0) {
                    ForEach(Array([state.bgColor, state.fgColor, state.labelColor].enumerated()), id: \.offset) { _, color in
                        Rectangle()
                            .fill(color.range(of: EditorState.hexColorPattern, options: .regularExpression) != nil
                                  ? Color(hex: color)
                                  : PocketfulTheme.border)
                    }
                }
                .frame(height: 42)
                .clipShape(RoundedRectangle(cornerRadius: Radii.control))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.control)
                        .stroke(PocketfulTheme.border, lineWidth: 1)
                )
                PocketfulInput("Background", text: $state.bgColor, placeholder: "#131822")
                PocketfulInput("Foreground text", text: $state.fgColor, placeholder: "#ffffff")
                PocketfulInput("Labels", text: $state.labelColor, placeholder: "#a9b2c0")
                PocketfulDisclosure("Specialized colors", description: "Optional strip-field and poster-event footer colors") {
                    PocketfulInput("Strip text color", text: $state.stripColor, placeholder: "Optional #ffffff")
                    PocketfulInput("Event footer background", text: $state.footerColor, placeholder: "Optional #0c1017")
                }
            }

            PocketfulSection(
                title: "Artwork",
                description: "Every standard Wallet asset is resized and exported at 1×, 2×, and 3×.",
                badge: "PNG"
            ) {
                ImagesSectionView(slots: state.recommendedSlots, state: state)
                PocketfulDisclosure("More standard artwork", description: "Strip, thumbnail, background, and footer slots that are less common for this format") {
                    ImagesSectionView(slots: state.optionalSlots, state: state)
                }
                if !state.localizedSlots.isEmpty {
                    PocketfulDisclosure("Localized artwork", description: "\(state.localizationLanguages.count) language-specific asset sets") {
                        ImagesSectionView(slots: state.localizedSlots, state: state)
                    }
                }
                if state.personalizationEnabled {
                    PocketfulDisclosure("Personalization artwork", description: "Required alongside NFC and personalization.json", defaultOpen: true) {
                        ImagesSectionView(slots: [Slots.personalizationLogo], state: state)
                    }
                }
            }
        }
    }
}
