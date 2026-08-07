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
            PocketfulSection(
                title: "Pass behavior",
                description: "App launching, grouping, sharing, relevance radius, update services, and custom metadata."
            ) {
                PocketfulInput("App launch URL", text: $state.appLaunchURL, placeholder: "pocketful://pass/123", keyboard: .URL)
                PocketfulInput("Grouping identifier", text: $state.groupingIdentifier, placeholder: "membership-cards")
                PocketfulInput("Maximum relevance distance", text: $state.maxDistance, placeholder: "Meters", keyboard: .decimalPad)
                PocketfulInput("Associated App Store IDs", text: $state.associatedStoreIdentifiers, placeholder: "123456789, 987654321", keyboard: .numbersAndPunctuation)
                PocketfulToggleRow("Mark pass as voided", description: "Wallet renders a prominent voided state.", value: $state.voided)
                PocketfulToggleRow("Prohibit sharing", value: $state.sharingProhibited)
                PocketfulToggleRow("Suppress strip shine", value: $state.suppressStripShine)
                PocketfulDisclosure("Web service updates", description: "Let the signing server push changes to this pass after it is in Wallet") {
                    PocketfulToggleRow("Updatable (OTA)", description: "The server keeps this pass, manages its update credentials, and can push new versions to Wallet.", value: $state.updatable)
                    if !state.updatable {
                        PocketfulInput("Web service URL", text: $state.webServiceURL, placeholder: "https://passes.example/v1", keyboard: .URL)
                        PocketfulInput("Authentication token", text: $state.authenticationToken, placeholder: "At least 16 characters recommended", secure: true)
                    }
                }
                PocketfulDisclosure("Custom user info", description: "App-defined JSON stored inside pass.json") {
                    PocketfulInput("User info · JSON", text: $state.userInfoJson, placeholder: "{\n  \"accountId\": \"abc-123\",\n  \"tier\": \"gold\"\n}", multiline: true)
                }
            }

            if state.style == .eventTicket {
                PocketfulSection(
                    title: "Event experience",
                    description: "Poster layout, Event Guide actions, contact details, and ticket menu actions.",
                    badge: "iOS 18+"
                ) {
                    PocketfulToggleRow("Use automatic colors", description: "Derive foreground and label colors from poster artwork.", value: $state.eventAutomaticColors)
                    PocketfulToggleRow("Suppress header darkening", value: $state.suppressHeaderDarkening)
                    PocketfulInput("Poster event logo text", text: $state.eventLogoText, placeholder: "Pocketful Live")
                    PocketfulInput("Auxiliary App Store IDs", text: $state.auxiliaryStoreIdentifiers, placeholder: "123456789, 987654321")
                    PocketfulDisclosure("Event Guide & ticket actions", description: "Wallet generally shows the Event Guide when at least two relevant actions are supplied") {
                        ForEach(EditorCatalog.eventOptionFields) { field in
                            PocketfulInput(field.label, text: eventOptionBinding(field.key), placeholder: field.placeholder, keyboard: field.keyboard)
                        }
                    }
                    if state.preferredStyleSchemes.contains(.posterEventTicket) {
                        PocketfulDisclosure("Upcoming pass information", description: "The complete iOS 26 poster-event entries schema") {
                            PocketfulInput(
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
                PocketfulSection(
                    title: "Enhanced boarding",
                    description: "Seat, entertainment, baggage, lounge, Wi-Fi, accessibility, and provider actions.",
                    badge: "iOS 26+"
                ) {
                    ForEach(EditorCatalog.boardingOptionFields) { field in
                        PocketfulInput(field.label, text: boardingOptionBinding(field.key), placeholder: field.placeholder, keyboard: field.keyboard)
                    }
                }
            }

            PocketfulSection(
                title: "Localization",
                description: "Generate pass.strings for every language and enable localized artwork folders.",
                badge: "\(state.localizations.count) languages"
            ) {
                LocalizationsEditorView(localizations: $state.localizations)
            }

            PocketfulSection(
                title: "Personalization",
                description: "Ask for customer information before adding an NFC pass.",
                badge: "NFC required"
            ) {
                PocketfulToggleRow("Enable personalization", value: $state.personalizationEnabled)
                if state.personalizationEnabled {
                    PocketfulNotice("Wallet only keeps personalization.json when NFC details and personalization logo artwork are also present.", title: "Three required pieces", tone: .warning)
                    PocketfulInput("Personalization description", text: $state.personalizationDescription, placeholder: "Personalize your membership pass")
                    MicroLabel("Information to collect")
                    MultiChipRow(options: Self.personalizationOptions, values: state.personalizationFields) {
                        state.personalizationFields = $0
                    }
                    PocketfulInput("Terms and conditions", text: $state.personalizationTerms, placeholder: "Optional terms shown during personalization", multiline: true)
                }
            }

            PocketfulSection(
                title: "Server",
                description: "The signing service remains the authority for certificates, team ID, and pass type ID.",
                badge: "Secure"
            ) {
                PocketfulInput("Pass server URL", text: $state.serverUrl, placeholder: "https://pass.abdeen.dev", keyboard: .URL)
                PocketfulInput("API token", text: $state.apiToken, placeholder: "Only when configured on the server", secure: true)
                PocketfulNotice("Signing certificates never enter the app or pass payload. The server supplies the pass type identifier, team identifier, and signing chain.")
            }
        }
    }
}
