// Advanced tab: pass behavior, style-specific experiences, localization,
// personalization, and server settings.

import SwiftUI
import UIKit

struct AdvancedTabView: View {
    @Bindable var state: EditorState

    private static let personalizationOptions: [(value: PersonalizationField, label: String)] = [
        (.name, "Name"),
        (.postalCode, "Postal code"),
        (.emailAddress, "Email"),
        (.phoneNumber, "Phone"),
    ]

    private func eventOptionBinding(_ key: String) -> Binding<String> {
        Binding(
            get: { state.eventOptions[key] ?? "" },
            set: { state.eventOptions[key] = $0 }
        )
    }

    private func boardingOptionBinding(_ key: String) -> Binding<String> {
        Binding(
            get: { state.boardingOptions[key] ?? "" },
            set: { state.boardingOptions[key] = $0 }
        )
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            AxisSection(
                title: "Pass behavior",
                description: "App launching, grouping, sharing, relevance radius, update services, and custom metadata."
            ) {
                AxisInput("App launch URL", text: $state.appLaunchURL, placeholder: "pocketful://pass/123", keyboard: .URL)
                AxisInput("Grouping identifier", text: $state.groupingIdentifier, placeholder: "membership-cards")
                AxisInput("Maximum relevance distance", text: $state.maxDistance, placeholder: "Meters", keyboard: .decimalPad)
                AxisInput("Associated App Store IDs", text: $state.associatedStoreIdentifiers, placeholder: "123456789, 987654321", keyboard: .numbersAndPunctuation)
                AxisToggleRow("Mark pass as voided", description: "Wallet renders a prominent voided state.", value: $state.voided)
                AxisToggleRow("Prohibit sharing", value: $state.sharingProhibited)
                AxisToggleRow("Suppress strip shine", value: $state.suppressStripShine)
                AxisDisclosure("Web service updates", description: "Let the signing server push changes to this pass after it is in Wallet") {
                    AxisToggleRow("Updatable (OTA)", description: "The server keeps this pass, manages its update credentials, and can push new versions to Wallet.", value: $state.updatable)
                    if !state.updatable {
                        AxisInput("Web service URL", text: $state.webServiceURL, placeholder: "https://passes.example/v1", keyboard: .URL)
                        AxisInput("Authentication token", text: $state.authenticationToken, placeholder: "At least 16 characters recommended", secure: true)
                    }
                }
                AxisDisclosure("Custom user info", description: "App-defined JSON stored inside pass.json") {
                    AxisInput("User info · JSON", text: $state.userInfoJson, placeholder: "{\n  \"accountId\": \"abc-123\",\n  \"tier\": \"gold\"\n}", multiline: true)
                }
            }

            if state.style == .eventTicket {
                AxisSection(
                    title: "Event experience",
                    description: "Poster layout, Event Guide actions, contact details, and ticket menu actions.",
                    badge: "iOS 18+"
                ) {
                    AxisToggleRow("Use automatic colors", description: "Derive foreground and label colors from poster artwork.", value: $state.eventAutomaticColors)
                    AxisToggleRow("Suppress header darkening", value: $state.suppressHeaderDarkening)
                    AxisInput("Poster event logo text", text: $state.eventLogoText, placeholder: "Pocketful Live")
                    AxisInput("Auxiliary App Store IDs", text: $state.auxiliaryStoreIdentifiers, placeholder: "123456789, 987654321")
                    AxisDisclosure("Event Guide & ticket actions", description: "Wallet generally shows the Event Guide when at least two relevant actions are supplied") {
                        ForEach(EditorCatalog.eventOptionFields) { field in
                            AxisInput(field.label, text: eventOptionBinding(field.key), placeholder: field.placeholder, keyboard: field.keyboard)
                        }
                    }
                    if state.preferredStyleSchemes.contains(.posterEventTicket) {
                        AxisDisclosure("Upcoming pass information", description: "The complete iOS 26 poster-event entries schema") {
                            AxisInput(
                                "Upcoming entries · JSON array",
                                text: $state.upcomingPassJson,
                                placeholder: "[\n  {\n    \"type\": \"event\",\n    \"date\": \"2026-10-01T19:30:00Z\"\n  }\n]",
                                helper: "passkit-generator validates every entry against its installed iOS 26 schema.",
                                multiline: true
                            )
                        }
                    }
                }
            }

            if state.style == .boardingPass {
                AxisSection(
                    title: "Enhanced boarding",
                    description: "Seat, entertainment, baggage, lounge, Wi-Fi, accessibility, and provider actions.",
                    badge: "iOS 26+"
                ) {
                    ForEach(EditorCatalog.boardingOptionFields) { field in
                        AxisInput(field.label, text: boardingOptionBinding(field.key), placeholder: field.placeholder, keyboard: field.keyboard)
                    }
                }
            }

            AxisSection(
                title: "Localization",
                description: "Generate pass.strings for every language and enable localized artwork folders.",
                badge: "\(state.localizations.count) languages"
            ) {
                LocalizationsEditorView(localizations: $state.localizations)
            }

            AxisSection(
                title: "Personalization",
                description: "Ask for customer information before adding an NFC pass.",
                badge: "NFC required"
            ) {
                AxisToggleRow("Enable personalization", value: $state.personalizationEnabled)
                if state.personalizationEnabled {
                    AxisNotice("Wallet only keeps personalization.json when NFC details and personalization logo artwork are also present.", title: "Three required pieces", tone: .warning)
                    AxisInput("Personalization description", text: $state.personalizationDescription, placeholder: "Personalize your membership pass")
                    MicroLabel("Information to collect")
                    MultiChipRow(options: Self.personalizationOptions, values: state.personalizationFields) {
                        state.personalizationFields = $0
                    }
                    AxisInput("Terms and conditions", text: $state.personalizationTerms, placeholder: "Optional terms shown during personalization", multiline: true)
                }
            }

            AxisSection(
                title: "Server",
                description: "The signing service remains the authority for certificates, team ID, and pass type ID.",
                badge: "Secure"
            ) {
                AxisInput("Pass server URL", text: $state.serverUrl, placeholder: "https://pass.abdeen.dev", keyboard: .URL)
                AxisInput("API token", text: $state.apiToken, placeholder: "Only when configured on the server", secure: true)
                AxisNotice("Signing certificates never enter the app or pass payload. The server supplies the pass type identifier, team identifier, and signing chain.")
            }
        }
    }
}
